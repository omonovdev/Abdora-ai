const bcrypt = require('bcryptjs');
const { prisma } = require('../config/db');
const { success, error } = require('../utils/apiResponse');
const { generateUsername, generatePassword, getPhoneCode } = require('../utils/generateCredentials');
const { getOwnBranchIds, resolveBranchScope, userBranchScope } = require('../utils/branchScope');

const safeUser = (u) => {
  if (!u) return null;
  const { passwordHash, refreshTokenHash, ...rest } = u;
  return { ...rest, streak: { current: rest.streakCurrent, longest: rest.streakLongest, lastActiveDate: rest.streakLastDate } };
};

// Every write against another account must confirm the target sits in one of
// the caller's centers, otherwise a manager could edit another center's people
// just by knowing an id. Returns an error message or null.
const assertUserInScope = async (targetId, user) => {
  const ownBranchIds = await getOwnBranchIds(user);
  if (!ownBranchIds) return null;
  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: {
      branchId: true,
      group: { select: { branchId: true } },
      branches: { select: { id: true } },
      managedBranches: { select: { id: true } },
    },
  });
  if (!target) return 'User not found';
  const attached = [
    target.branchId,
    target.group?.branchId,
    ...target.branches.map(b => b.id),
    ...target.managedBranches.map(b => b.id),
  ].filter(Boolean);
  return attached.some(id => ownBranchIds.includes(id)) ? null : 'Forbidden';
};

const createStudent = async (req, res, next) => {
  try {
    const { name, groupId, language, phone, password } = req.body;
    if (!name || !groupId) return error(res, 'Name and group required', 400);
    if (!phone) return error(res, 'Telefon raqami majburiy (login va parol uchun)', 400);

    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) return error(res, 'Group not found', 404);

    const ownBranchIds = await getOwnBranchIds(req.user);
    if (ownBranchIds && (!group.branchId || !ownBranchIds.includes(group.branchId))) {
      return error(res, 'Forbidden: not your branch', 403);
    }

    const last4 = phone.replace(/\D/g, '').slice(-4);
    const code = password?.trim() || last4;
    if (!code || code.length < 4) return error(res, 'Telefon raqami noto\'g\'ri (kamida 4 ta raqam kerak) yoki kod noto\'g\'ri', 400);

    const baseName = name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '');
    const username = `${baseName}_${last4}`;
    const passwordHash = await bcrypt.hash(code, 10);

    // If username already taken, append random 2 digits
    let finalUsername = username;
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) finalUsername = `${username}${Math.floor(10 + Math.random() * 90)}`;

    const user = await prisma.user.create({
      data: { name, username: finalUsername, passwordHash, role: 'student', language: language || 'uz', groupId, teacherId: group.teacherId, phone: phone || null },
    });

    return success(res, { user: safeUser(user), credentials: { username: finalUsername, password: code } }, 'Student created', 201);
  } catch (err) { next(err); }
};

const createTeacher = async (req, res, next) => {
  try {
    const { name, email, phone, language, password } = req.body;
    if (!name || !phone) return error(res, 'Name and phone required', 400);

    const code = password?.trim() || getPhoneCode(phone);
    if (!code || code.length < 4) return error(res, 'Phone must include at least 4 digits or provide a valid code', 400);

    const username = generateUsername(name, phone);
    const passwordHash = await bcrypt.hash(code, 10);

    const user = await prisma.user.create({
      data: { name, email, phone: phone || null, username, passwordHash, role: 'teacher', language: language || 'uz' },
    });

    return success(res, { user: safeUser(user), credentials: { username, password: code } }, 'Teacher created', 201);
  } catch (err) { next(err); }
};

const createManager = async (req, res, next) => {
  try {
    const { name, email, phone, gender, age, address, language, password, branchId } = req.body;
    if (!name || !phone) return error(res, 'Name and phone required', 400);
    if (age !== undefined && age !== null && Number.isNaN(Number(age))) return error(res, 'Age must be a number', 400);

    const code = password?.trim() || getPhoneCode(phone);
    if (!code || code.length < 4) return error(res, 'Phone must include at least 4 digits or provide a valid code', 400);

    let branch = null;
    if (branchId) {
      branch = await prisma.branch.findUnique({ where: { id: branchId } });
      if (!branch) return error(res, 'Branch not found', 404);
      if (branch.managerId) return error(res, 'Branch already assigned to another manager', 400);
    }

    const username = generateUsername(name, phone);
    const passwordHash = await bcrypt.hash(code, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email: email || null,
        phone: phone || null,
        gender: gender || null,
        age: age ? Number(age) : null,
        address: address || null,
        username,
        passwordHash,
        role: 'manager',
        language: language || 'uz',
        ...(branchId ? { managedBranches: { connect: { id: branchId } } } : {}),
      },
    });

    return success(res, { user: safeUser(user), credentials: { username, password: code } }, 'Manager created', 201);
  } catch (err) { next(err); }
};

const getStudentsByTeacher = async (req, res, next) => {
  try {
    const students = await prisma.user.findMany({
      where: { teacherId: req.user.userId, role: 'student', isActive: true },
      include: { group: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
    });
    return success(res, students.map(safeUser));
  } catch (err) { next(err); }
};

const getAllUsers = async (req, res, next) => {
  try {
    const { role, branchId } = req.query;
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    // Add pagination and limit fields returned to reduce payload
    const page = Math.max(1, Number(req.query.page) || 1);
    const perPage = Math.min(100, Math.max(10, Number(req.query.perPage) || 50));

    const { branchIds, forbidden } = await resolveBranchScope(req.user, branchId);
    if (forbidden) return error(res, 'Bu markaz sizga tegishli emas', 403);

    // Search and branch scope can each produce an OR clause, so they are ANDed
    // together rather than merged - collapsing them would drop the branch
    // filter and leak other centers' users.
    const where = {
      ...(role ? { role } : {}),
      AND: [
        userBranchScope(branchIds, role),
        ...(search
          ? [{
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { username: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } },
              ],
            }]
          : []),
      ],
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true, name: true, username: true, email: true, phone: true, role: true,
          avatar: true, isActive: true, isFrozen: true, groupId: true, branchId: true, createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      prisma.user.count({ where }),
    ]);

    return success(res, users, 'Success', 200, { page, perPage, total });
  } catch (err) { next(err); }
};

const getUserById = async (req, res, next) => {
  try {
    const id = req.params.id;
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { id },
          { username: id },
          { phone: id },
        ],
      },
      include: {
        group: { select: { id: true, name: true, branch: { select: { id: true, name: true } } } },
        branch: { select: { id: true, name: true } },
        teacher: { select: { id: true, name: true, username: true } },
        branches: { select: { id: true, name: true } },
        managedBranches: { select: { id: true, name: true } },
        _count: { select: { students: true, taughtGroups: true } },
      },
    });
    if (!user) return error(res, 'User not found', 404);

    // A user is visible only if they belong to one of the caller's centers,
    // by whichever route ties them to a branch.
    const ownBranchIds = await getOwnBranchIds(req.user);
    if (ownBranchIds) {
      const attached = [
        user.branchId,
        user.group?.branch?.id,
        ...user.branches.map(b => b.id),
        ...user.managedBranches.map(b => b.id),
      ].filter(Boolean);
      if (!attached.some(id => ownBranchIds.includes(id))) return error(res, 'User not found', 404);
    }

    return success(res, safeUser(user));
  } catch (err) { next(err); }
};

const updateProfile = async (req, res, next) => {
  try {
    const { name, language, avatar, phone, gender, age, address } = req.body;
    const user = await prisma.user.update({
      where: { id: req.user.userId },
      data: { name, language, avatar, phone, gender, age: age ? Number(age) : null, address },
    });
    return success(res, safeUser(user));
  } catch (err) { next(err); }
};

const updateUser = async (req, res, next) => {
  try {
    const { name, email, isActive, groupId, language, phone, gender, age, address } = req.body;
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return error(res, 'User not found', 404);
    if (req.user.role === 'teacher' && target.teacherId !== req.user.userId) return error(res, 'Forbidden', 403);
    const scopeErr = await assertUserInScope(req.params.id, req.user);
    if (scopeErr) return error(res, scopeErr, scopeErr === 'Forbidden' ? 403 : 404);
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { name, email, isActive, groupId, language, phone, gender, age: age ? Number(age) : null, address },
    });
    return success(res, safeUser(user));
  } catch (err) { next(err); }
};

const deleteUser = async (req, res, next) => {
  try {
    const target = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, role: true, teacherId: true, branchId: true, group: { select: { branchId: true } } },
    });
    if (!target) return error(res, 'User not found', 404);
    if (req.user.role === 'teacher' && target.teacherId !== req.user.userId) return error(res, 'Forbidden', 403);

    if (req.user.role === 'reception') {
      // Never allow reception to deactivate an admin or another reception account.
      if (target.role !== 'teacher' && target.role !== 'student') return error(res, 'Forbidden', 403);
    }
    const scopeErr = await assertUserInScope(req.params.id, req.user);
    if (scopeErr) return error(res, scopeErr, scopeErr === 'Forbidden' ? 403 : 404);

    await prisma.user.update({ where: { id: req.params.id }, data: { isActive: false } });
    return success(res, null, 'User deactivated');
  } catch (err) { next(err); }
};

const resetStudentPassword = async (req, res, next) => {
  try {
    const student = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true, phone: true, username: true, name: true } });
    if (!student) return error(res, 'Student not found', 404);
    const scopeErr = await assertUserInScope(req.params.id, req.user);
    if (scopeErr) return error(res, scopeErr === 'Forbidden' ? 'Forbidden' : 'Student not found', scopeErr === 'Forbidden' ? 403 : 404);

    // Default: reset to last 4 digits of phone (the student's memorable password)
    const last4 = (student.phone || '').replace(/\D/g, '').slice(-4);
    const newPassword = (last4.length === 4 ? last4 : null) || req.body.newPassword || generatePassword(8);

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: req.params.id }, data: { passwordHash } });
    return success(res, { password: newPassword, username: student.username, name: student.name });
  } catch (err) { next(err); }
};

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return error(res, 'currentPassword va newPassword talab qilinadi', 400);
    if (newPassword.length < 6) return error(res, 'Yangi parol kamida 6 ta belgidan iborat bo\'lishi kerak', 400);

    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user) return error(res, 'Foydalanuvchi topilmadi', 404);

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) return error(res, 'Joriy parol noto\'g\'ri', 401);

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: req.user.userId }, data: { passwordHash } });

    return success(res, null, 'Parol muvaffaqiyatli o\'zgartirildi');
  } catch (err) { next(err); }
};

const freezeStudent = async (req, res, next) => {
  try {
    const student = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!student) return error(res, 'Student not found', 404);
    if (req.user.role !== 'teacher') {
      const scopeErr = await assertUserInScope(req.params.id, req.user);
      if (scopeErr) return error(res, scopeErr === 'Forbidden' ? 'Forbidden' : 'Student not found', scopeErr === 'Forbidden' ? 403 : 404);
    } else if (student.teacherId !== req.user.userId) {
      return error(res, 'Forbidden', 403);
    }
    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { isFrozen: !student.isFrozen },
    });
    return success(res, { isFrozen: updated.isFrozen }, updated.isFrozen ? 'Student frozen' : 'Student unfrozen');
  } catch (err) { next(err); }
};

const getManagers = async (req, res, next) => {
  try {
    const ownBranchIds = await getOwnBranchIds(req.user);
    const managers = await prisma.user.findMany({
      where: {
        role: 'manager',
        ...(ownBranchIds ? { managedBranches: { some: { id: { in: ownBranchIds } } } } : {}),
      },
      select: { id: true, name: true, username: true, email: true, phone: true, gender: true, age: true, address: true, isActive: true, createdAt: true, lastLogin: true },
      orderBy: { createdAt: 'desc' },
    });
    return success(res, managers);
  } catch (err) { next(err); }
};

const updateManager = async (req, res, next) => {
  try {
    const { name, email, phone, gender, age, address } = req.body;
    const manager = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!manager || manager.role !== 'manager') return error(res, 'Manager not found', 404);

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(gender !== undefined && { gender }),
        ...(age !== undefined && { age: age ? Number(age) : null }),
        ...(address !== undefined && { address }),
      },
      select: { id: true, name: true, username: true, email: true, phone: true, gender: true, age: true, address: true, isActive: true },
    });
    return success(res, updated, 'Manager updated');
  } catch (err) { next(err); }
};

const deleteManager = async (req, res, next) => {
  try {
    const manager = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!manager || manager.role !== 'manager') return error(res, 'Manager not found', 404);

    await prisma.user.update({ where: { id: req.params.id }, data: { isActive: false } });
    return success(res, null, 'Manager deactivated');
  } catch (err) { next(err); }
};

const getManagerBranches = async (req, res, next) => {
  try {
    const branches = await prisma.branch.findMany({
      where: { managerId: req.user.userId, isActive: true },
      include: {
        reception: { select: { id: true, name: true } },
        manager: { select: { id: true, name: true } },
        teachers: { select: { id: true, name: true, username: true, phone: true, isActive: true } },
        groups: {
          select: {
            id: true,
            name: true,
            subject: true,
            monthlyFee: true,
            weekDays: true,
            startTime: true,
            endTime: true,
            room: true,
            teacher: { select: { id: true, name: true } },
            _count: { select: { students: true } },
          },
          orderBy: { name: 'asc' },
        },
        _count: { select: { teachers: true } },
      },
    });

    const branchesWithCounts = await Promise.all(branches.map(async (branch) => {
      const studentsCount = await prisma.user.count({
        where: { role: 'student', group: { branchId: branch.id }, isActive: true },
      });
      return { ...branch, studentsCount };
    }));

    return success(res, branchesWithCounts);
  } catch (err) { next(err); }
};

// GET /users/my-branches - the centers the caller may act in, for the branch
// switcher. Admin gets every active branch.
const getMyBranchOptions = async (req, res, next) => {
  try {
    const ownBranchIds = await getOwnBranchIds(req.user);
    const branches = await prisma.branch.findMany({
      where: { isActive: true, ...(ownBranchIds ? { id: { in: ownBranchIds } } : {}) },
      select: { id: true, name: true, address: true },
      orderBy: { name: 'asc' },
    });
    return success(res, branches);
  } catch (err) { next(err); }
};

module.exports = { getMyBranchOptions, createStudent, createTeacher, createManager, getManagers, updateManager, deleteManager, getManagerBranches, getStudentsByTeacher, getAllUsers, getUserById, updateProfile, updateUser, deleteUser, resetStudentPassword, freezeStudent, changePassword };
