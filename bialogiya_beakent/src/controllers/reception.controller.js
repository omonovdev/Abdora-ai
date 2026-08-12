const bcrypt = require('bcryptjs');
const { prisma } = require('../config/db');
const { success, error } = require('../utils/apiResponse');
const { generateUsername, generatePassword } = require('../utils/generateCredentials');

// Reception's ONLY user-management capability: creating teacher accounts.
// They cannot create students, admins, or other reception accounts.
const createTeacher = async (req, res, next) => {
  try {
    const { name, email, phone, language } = req.body;
    if (!name) return error(res, 'Name required', 400);

    const username = generateUsername(name);
    const password = generatePassword(8);
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { name, email, phone: phone || null, username, passwordHash, role: 'teacher', language: language || 'uz' },
      select: { id: true, name: true, username: true, email: true, phone: true, role: true, createdAt: true },
    });

    return success(res, { user, credentials: { username, password } }, 'Teacher created', 201);
  } catch (err) { next(err); }
};

const getTeachers = async (req, res, next) => {
  try {
    const teachers = await prisma.user.findMany({
      where: { role: 'teacher' },
      select: { id: true, name: true, username: true, phone: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    return success(res, teachers);
  } catch (err) { next(err); }
};

// So reception can pick a group to view/mark payments for. Schedule and course
// progress ride along so reception can answer "where is this group up to?"
// without opening each one.
const getGroups = async (req, res, next) => {
  try {
    const where = req.user.role === 'reception' ? { branch: { receptionId: req.user.userId } } : {};
    const groups = await prisma.group.findMany({
      where: { ...where, isActive: true },
      select: {
        id: true, name: true, subject: true, monthlyFee: true,
        weekDays: true, startTime: true, endTime: true, room: true,
        totalLessons: true, level: true, startDate: true,
        teacher: { select: { id: true, name: true } }, branch: { select: { id: true, name: true } },
        _count: { select: { students: true } },
      },
      orderBy: { name: 'asc' },
    });

    // One grouped count instead of a query per group.
    const heldCounts = await prisma.attendance.groupBy({
      by: ['groupId'],
      where: { groupId: { in: groups.map(g => g.id) } },
      _count: { _all: true },
    });
    const heldByGroup = Object.fromEntries(heldCounts.map(row => [row.groupId, row._count._all]));

    const withProgress = groups.map(g => {
      const lessonsHeld = heldByGroup[g.id] || 0;
      const percent = g.totalLessons > 0 ? Math.min(100, Math.round((lessonsHeld / g.totalLessons) * 100)) : null;
      return {
        ...g,
        weekDays: g.weekDays ? JSON.parse(g.weekDays) : [],
        progress: {
          lessonsHeld,
          totalLessons: g.totalLessons,
          percent,
          remaining: g.totalLessons ? Math.max(0, g.totalLessons - lessonsHeld) : null,
        },
      };
    });

    return success(res, withProgress);
  } catch (err) { next(err); }
};

// GET /reception/branches - the requesting reception user's own branches
// (admin sees all, for oversight).
const getMyBranches = async (req, res, next) => {
  try {
    const where = req.user.role === 'reception' ? { receptionId: req.user.userId } : {};
    const branches = await prisma.branch.findMany({
      where: { ...where, isActive: true },
      include: {
        reception: { select: { id: true, name: true } },
        _count: { select: { groups: true, teachers: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return success(res, branches);
  } catch (err) { next(err); }
};

const getBranchDetail = async (req, res, next) => {
  try {
    const branch = await prisma.branch.findFirst({
      where: { id: req.params.id, isActive: true },
      include: {
        reception: { select: { id: true, name: true } },
        teachers: { select: { id: true, name: true, username: true, phone: true, isActive: true } },
        groups: {
          select: {
            id: true,
            name: true,
            monthlyFee: true,
            weekDays: true,
            startTime: true,
            endTime: true,
            room: true,
            _count: { select: { students: true } },
          },
          orderBy: { name: 'asc' },
        },
      },
    });
    if (!branch) return error(res, 'Branch not found', 404);
    if (req.user.role === 'reception' && branch.receptionId !== req.user.userId) return error(res, 'Forbidden', 403);

    const studentsCount = await prisma.user.count({
      where: { role: 'student', group: { branchId: branch.id }, isActive: true },
    });

    return success(res, { ...branch, studentsCount });
  } catch (err) { next(err); }
};

// POST /reception/branches - reception-only (not admin): capped at the
// admin-configured maxBranches for this reception account (default 3).
const createBranch = async (req, res, next) => {
  try {
    const { name, address, studentCapacity } = req.body;
    if (!name) return error(res, 'Branch name required', 400);

    const [count, self] = await Promise.all([
      prisma.branch.count({ where: { receptionId: req.user.userId, isActive: true } }),
      prisma.user.findUnique({ where: { id: req.user.userId }, select: { maxBranches: true } }),
    ]);
    const limit = self?.maxBranches ?? 3;
    if (count >= limit) {
      return error(res, `Sizga ko'pi bilan ${limit} ta filial ochish ruxsat etilgan. Ko'proq kerak bo'lsa, administratorga murojaat qiling.`, 400);
    }

    const branch = await prisma.branch.create({
      data: {
        name,
        address,
        studentCapacity: Number.isFinite(Number(studentCapacity)) ? Number(studentCapacity) : undefined,
        receptionId: req.user.userId,
      },
    });
    return success(res, branch, 'Branch created', 201);
  } catch (err) { next(err); }
};

// PUT /reception/branches/:id - only the owning reception account (or admin) can edit
const updateBranch = async (req, res, next) => {
  try {
    const { name, address, studentCapacity } = req.body;
    const branch = await prisma.branch.findUnique({ where: { id: req.params.id } });
    if (!branch) return error(res, 'Branch not found', 404);
    if (req.user.role === 'reception' && branch.receptionId !== req.user.userId) return error(res, 'Forbidden', 403);

    const updated = await prisma.branch.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(address !== undefined && { address }),
        ...(studentCapacity !== undefined && { studentCapacity: Number.isFinite(Number(studentCapacity)) ? Number(studentCapacity) : null }),
      },
    });
    return success(res, updated, 'Branch updated');
  } catch (err) { next(err); }
};

// DELETE /reception/branches/:id - soft delete (isActive: false), same
// pattern as everywhere else in the app.
const deleteBranch = async (req, res, next) => {
  try {
    const branch = await prisma.branch.findUnique({ where: { id: req.params.id } });
    if (!branch) return error(res, 'Branch not found', 404);
    if (req.user.role === 'reception' && branch.receptionId !== req.user.userId) return error(res, 'Forbidden', 403);

    await prisma.branch.update({ where: { id: req.params.id }, data: { isActive: false } });
    return success(res, null, 'Branch deleted');
  } catch (err) { next(err); }
};

module.exports = { createTeacher, getTeachers, getGroups, getMyBranches, getBranchDetail, createBranch, updateBranch, deleteBranch };
