const bcrypt = require('bcryptjs');
const { prisma } = require('../config/db');
const { success, error } = require('../utils/apiResponse');
const { getOwnBranchIds, resolveBranchScope } = require('../utils/branchScope');

const STATUSES = ['new', 'contacted', 'trial', 'enrolled', 'frozen', 'archived', 'lost'];
const SOURCES = ['instagram', 'telegram', 'referral', 'walkin', 'landing', 'other'];
// Statuses that take a lead off the active board.
const CLOSED_STATUSES = ['archived', 'lost'];

const LEAD_INCLUDE = {
  branch: { select: { id: true, name: true } },
  student: {
    select: {
      id: true, name: true, username: true, phone: true, isActive: true,
      group: { select: { id: true, name: true } },
    },
  },
};

const startOfWeek = (now = new Date()) => {
  const d = new Date(now);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
};

// Leads belong to a branch, not to a person. Scoping by managerId alone meant a
// manager running several centers saw every center's leads in one list, so the
// branch is what the filter has to key on.
const leadWhere = (branchIds) => (branchIds ? { branchId: { in: branchIds } } : {});

// A lead is reachable if it sits in one of the caller's branches. Admin sees all.
const assertLeadAccess = async (lead, user) => {
  const ownBranchIds = await getOwnBranchIds(user);
  if (!ownBranchIds) return null;
  if (!lead.branchId || !ownBranchIds.includes(lead.branchId)) return 'Bu lid sizning markazingizga tegishli emas';
  return null;
};

const createLead = async (req, res, next) => {
  try {
    const { name, phone, source, interestedIn, note, branchId, status } = req.body;
    if (!name?.trim()) return error(res, 'Ism kiritilmagan', 400);
    if (!phone?.trim()) return error(res, 'Telefon raqam kiritilmagan', 400);
    if (source && !SOURCES.includes(source)) return error(res, 'Manba noto\'g\'ri', 400);
    if (status && !STATUSES.includes(status)) return error(res, 'Status noto\'g\'ri', 400);

    // Every lead must land in a specific center, otherwise it shows up in none
    // of the branch-filtered views (or, worse, in all of them).
    // A single-center account does not need to pick; everyone else must.
    const ownBranchIds = await getOwnBranchIds(req.user);
    const targetBranchId = branchId || (ownBranchIds?.length === 1 ? ownBranchIds[0] : null);
    if (!targetBranchId) return error(res, 'Markazni tanlang', 400);
    if (ownBranchIds && !ownBranchIds.includes(targetBranchId)) {
      return error(res, 'Bu markaz sizga tegishli emas', 403);
    }

    const lead = await prisma.lead.create({
      data: {
        name: name.trim(),
        phone: phone.trim(),
        source: source || 'other',
        status: status || 'new',
        interestedIn: interestedIn?.trim() || null,
        note: note?.trim() || null,
        branchId: targetBranchId,
        managerId: req.user.role === 'manager' ? req.user.userId : null,
      },
      include: LEAD_INCLUDE,
    });

    return success(res, lead, 'Lid qo\'shildi', 201);
  } catch (err) { next(err); }
};

// GET /leads?status=new&search=ali&branchId=...
const getLeads = async (req, res, next) => {
  try {
    const { status, search, branchId } = req.query;
    const { branchIds, forbidden } = await resolveBranchScope(req.user, branchId);
    if (forbidden) return error(res, 'Bu markaz sizga tegishli emas', 403);

    const where = leadWhere(branchIds);

    if (status && status !== 'all') {
      if (!STATUSES.includes(status)) return error(res, 'Status noto\'g\'ri', 400);
      where.status = status;
    }
    if (search?.trim()) {
      where.OR = [
        { name: { contains: search.trim(), mode: 'insensitive' } },
        { phone: { contains: search.trim() } },
      ];
    }

    const leads = await prisma.lead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: LEAD_INCLUDE,
    });

    return success(res, leads);
  } catch (err) { next(err); }
};

// GET /leads/stats — the board counters, for the selected center only.
const getLeadStats = async (req, res, next) => {
  try {
    const { branchId } = req.query;
    const { branchIds, forbidden } = await resolveBranchScope(req.user, branchId);
    if (forbidden) return error(res, 'Bu markaz sizga tegishli emas', 403);

    const where = leadWhere(branchIds);
    const weekStart = startOfWeek();

    const [byStatus, thisWeek, total] = await Promise.all([
      prisma.lead.groupBy({ by: ['status'], where, _count: { _all: true } }),
      prisma.lead.count({ where: { ...where, createdAt: { gte: weekStart } } }),
      prisma.lead.count({ where }),
    ]);

    const counts = STATUSES.reduce((acc, s) => ({ ...acc, [s]: 0 }), {});
    byStatus.forEach(row => { counts[row.status] = row._count._all; });

    const active = total - counts.archived - counts.lost;
    // Of the leads that reached a decision, how many enrolled.
    const decided = counts.enrolled + counts.archived + counts.lost;

    return success(res, {
      counts,
      total,
      active,
      thisWeek,
      weekStart,
      conversionRate: decided > 0 ? Math.round((counts.enrolled / decided) * 100) : 0,
    });
  } catch (err) { next(err); }
};

const updateLead = async (req, res, next) => {
  try {
    const { name, phone, source, status, interestedIn, note, branchId, frozenUntil, closeReason } = req.body;

    const existing = await prisma.lead.findUnique({ where: { id: req.params.id } });
    if (!existing) return error(res, 'Lid topilmadi', 404);
    const accessErr = await assertLeadAccess(existing, req.user);
    if (accessErr) return error(res, accessErr, 403);
    if (status && !STATUSES.includes(status)) return error(res, 'Status noto\'g\'ri', 400);
    if (source && !SOURCES.includes(source)) return error(res, 'Manba noto\'g\'ri', 400);

    if (branchId !== undefined && branchId) {
      const ownBranchIds = await getOwnBranchIds(req.user);
      if (ownBranchIds && !ownBranchIds.includes(branchId)) {
        return error(res, 'Bu markaz sizga tegishli emas', 403);
      }
    }

    const isClosing = status && CLOSED_STATUSES.includes(status);
    const isReopening = status && !CLOSED_STATUSES.includes(status) && CLOSED_STATUSES.includes(existing.status);

    const lead = await prisma.lead.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(phone !== undefined && { phone: phone.trim() }),
        ...(source !== undefined && { source }),
        ...(status !== undefined && { status }),
        ...(interestedIn !== undefined && { interestedIn: interestedIn?.trim() || null }),
        ...(note !== undefined && { note: note?.trim() || null }),
        ...(branchId !== undefined && branchId && { branchId }),
        ...(frozenUntil !== undefined && { frozenUntil: frozenUntil ? new Date(frozenUntil) : null }),
        ...(isClosing && { closedAt: new Date(), closeReason: closeReason?.trim() || note?.trim() || null }),
        ...(isReopening && { closedAt: null, closeReason: null }),
      },
      include: LEAD_INCLUDE,
    });

    return success(res, lead, 'Lid yangilandi');
  } catch (err) { next(err); }
};

const deleteLead = async (req, res, next) => {
  try {
    const existing = await prisma.lead.findUnique({ where: { id: req.params.id } });
    if (!existing) return error(res, 'Lid topilmadi', 404);
    const accessErr = await assertLeadAccess(existing, req.user);
    if (accessErr) return error(res, accessErr, 403);
    await prisma.lead.delete({ where: { id: req.params.id } });
    return success(res, null, 'Lid o\'chirildi');
  } catch (err) { next(err); }
};

// POST /leads/:id/convert — turn the lead into a real student account and keep
// the two linked, so the CRM can still answer "where did this student come
// from?" after enrolment. Either creates a new student in the chosen group, or
// attaches an existing student account via studentId.
const convertLead = async (req, res, next) => {
  try {
    const { groupId, studentId, password } = req.body;

    const lead = await prisma.lead.findUnique({ where: { id: req.params.id }, include: { student: { select: { id: true } } } });
    if (!lead) return error(res, 'Lid topilmadi', 404);
    const accessErr = await assertLeadAccess(lead, req.user);
    if (accessErr) return error(res, accessErr, 403);
    if (lead.studentId) return error(res, 'Bu lid allaqachon o\'quvchiga bog\'langan', 400);

    const ownBranchIds = await getOwnBranchIds(req.user);

    // Path A: link an already-existing student account to this lead.
    if (studentId) {
      const student = await prisma.user.findUnique({
        where: { id: studentId },
        select: { id: true, role: true, name: true, username: true, phone: true, group: { select: { id: true, name: true, branchId: true } } },
      });
      if (!student || student.role !== 'student') return error(res, 'O\'quvchi topilmadi', 404);
      if (ownBranchIds && (!student.group?.branchId || !ownBranchIds.includes(student.group.branchId))) {
        return error(res, 'Bu o\'quvchi sizning markazingizga tegishli emas', 403);
      }
      const alreadyLinked = await prisma.lead.findFirst({ where: { studentId, NOT: { id: lead.id } }, select: { id: true } });
      if (alreadyLinked) return error(res, 'Bu o\'quvchi boshqa lidga bog\'langan', 400);

      const updated = await prisma.lead.update({
        where: { id: lead.id },
        data: { studentId, status: 'enrolled', closedAt: null, closeReason: null },
        include: LEAD_INCLUDE,
      });
      return success(res, { lead: updated, credentials: null }, 'Lid o\'quvchiga bog\'landi');
    }

    // Path B: create a brand new student account from the lead's details.
    if (!groupId) return error(res, 'Guruhni tanlang', 400);
    const group = await prisma.group.findUnique({ where: { id: groupId }, select: { id: true, name: true, branchId: true, teacherId: true } });
    if (!group) return error(res, 'Guruh topilmadi', 404);
    if (ownBranchIds && (!group.branchId || !ownBranchIds.includes(group.branchId))) {
      return error(res, 'Bu guruh sizning markazingizga tegishli emas', 403);
    }
    // The student must end up in the same center the lead was tracked in.
    if (lead.branchId && group.branchId && lead.branchId !== group.branchId) {
      return error(res, 'Guruh lid bilan bir markazda emas', 400);
    }

    const digits = (lead.phone || '').replace(/\D/g, '');
    const last4 = digits.slice(-4);
    const code = password?.trim() || last4;
    if (!code || code.length < 4) return error(res, 'Telefon raqami noto\'g\'ri (kamida 4 ta raqam kerak)', 400);

    const baseName = lead.name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '') || 'oquvchi';
    let finalUsername = `${baseName}_${last4}`;
    const taken = await prisma.user.findUnique({ where: { username: finalUsername }, select: { id: true } });
    if (taken) finalUsername = `${finalUsername}${Math.floor(10 + Math.random() * 90)}`;

    const passwordHash = await bcrypt.hash(code, 10);

    // Creating the student and linking the lead must not half-apply: a student
    // with no lead link would silently lose its CRM origin.
    const { student, updatedLead } = await prisma.$transaction(async (tx) => {
      const student = await tx.user.create({
        data: {
          name: lead.name,
          username: finalUsername,
          passwordHash,
          role: 'student',
          phone: lead.phone,
          groupId: group.id,
          teacherId: group.teacherId,
        },
        select: { id: true, name: true, username: true, phone: true },
      });
      const updatedLead = await tx.lead.update({
        where: { id: lead.id },
        data: { studentId: student.id, status: 'enrolled', closedAt: null, closeReason: null },
        include: LEAD_INCLUDE,
      });
      return { student, updatedLead };
    });

    return success(
      res,
      { lead: updatedLead, student, credentials: { username: finalUsername, password: code } },
      'O\'quvchi yaratildi va lidga bog\'landi',
      201,
    );
  } catch (err) { next(err); }
};

// DELETE /leads/:id/convert — unlink without deleting the student account.
const unlinkLeadStudent = async (req, res, next) => {
  try {
    const lead = await prisma.lead.findUnique({ where: { id: req.params.id } });
    if (!lead) return error(res, 'Lid topilmadi', 404);
    const accessErr = await assertLeadAccess(lead, req.user);
    if (accessErr) return error(res, accessErr, 403);
    if (!lead.studentId) return error(res, 'Bu lid o\'quvchiga bog\'lanmagan', 400);

    const updated = await prisma.lead.update({
      where: { id: lead.id },
      data: { studentId: null },
      include: LEAD_INCLUDE,
    });
    return success(res, updated, 'Bog\'lanish uzildi');
  } catch (err) { next(err); }
};

module.exports = {
  createLead, getLeads, getLeadStats, updateLead, deleteLead,
  convertLead, unlinkLeadStudent, STATUSES, SOURCES,
};
