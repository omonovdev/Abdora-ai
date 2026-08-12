const { prisma } = require('../config/db');
const { success, error } = require('../utils/apiResponse');

const STATUSES = ['new', 'contacted', 'trial', 'enrolled', 'frozen', 'archived', 'lost'];
const SOURCES = ['instagram', 'telegram', 'referral', 'walkin', 'landing', 'other'];
// Statuses that take a lead off the active board.
const CLOSED_STATUSES = ['archived', 'lost'];

// Managers only see leads in the branches they run; admin sees everything.
const scopeFor = (user) => (user.role === 'manager' ? { managerId: user.userId } : {});

const startOfWeek = (now = new Date()) => {
  const d = new Date(now);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
};

const createLead = async (req, res, next) => {
  try {
    const { name, phone, source, interestedIn, note, branchId, status } = req.body;
    if (!name?.trim()) return error(res, 'Ism kiritilmagan', 400);
    if (!phone?.trim()) return error(res, 'Telefon raqam kiritilmagan', 400);
    if (source && !SOURCES.includes(source)) return error(res, 'Manba noto\'g\'ri', 400);
    if (status && !STATUSES.includes(status)) return error(res, 'Status noto\'g\'ri', 400);

    const lead = await prisma.lead.create({
      data: {
        name: name.trim(),
        phone: phone.trim(),
        source: source || 'other',
        status: status || 'new',
        interestedIn: interestedIn?.trim() || null,
        note: note?.trim() || null,
        branchId: branchId || null,
        managerId: req.user.role === 'manager' ? req.user.userId : null,
      },
      include: { branch: { select: { id: true, name: true } } },
    });

    return success(res, lead, 'Lid qo\'shildi', 201);
  } catch (err) { next(err); }
};

// GET /leads?status=new&search=ali
const getLeads = async (req, res, next) => {
  try {
    const { status, search, branchId } = req.query;
    const where = { ...scopeFor(req.user) };

    if (status && status !== 'all') {
      if (!STATUSES.includes(status)) return error(res, 'Status noto\'g\'ri', 400);
      where.status = status;
    }
    if (branchId) where.branchId = branchId;
    if (search?.trim()) {
      where.OR = [
        { name: { contains: search.trim(), mode: 'insensitive' } },
        { phone: { contains: search.trim() } },
      ];
    }

    const leads = await prisma.lead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { branch: { select: { id: true, name: true } } },
    });

    return success(res, leads);
  } catch (err) { next(err); }
};

// GET /leads/stats — the manager's board counters.
const getLeadStats = async (req, res, next) => {
  try {
    const where = scopeFor(req.user);
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
    if (req.user.role === 'manager' && existing.managerId && existing.managerId !== req.user.userId) {
      return error(res, 'Bu lid sizga tegishli emas', 403);
    }
    if (status && !STATUSES.includes(status)) return error(res, 'Status noto\'g\'ri', 400);
    if (source && !SOURCES.includes(source)) return error(res, 'Manba noto\'g\'ri', 400);

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
        ...(branchId !== undefined && { branchId: branchId || null }),
        ...(frozenUntil !== undefined && { frozenUntil: frozenUntil ? new Date(frozenUntil) : null }),
        ...(isClosing && { closedAt: new Date(), closeReason: closeReason?.trim() || note?.trim() || null }),
        ...(isReopening && { closedAt: null, closeReason: null }),
      },
      include: { branch: { select: { id: true, name: true } } },
    });

    return success(res, lead, 'Lid yangilandi');
  } catch (err) { next(err); }
};

const deleteLead = async (req, res, next) => {
  try {
    const existing = await prisma.lead.findUnique({ where: { id: req.params.id } });
    if (!existing) return error(res, 'Lid topilmadi', 404);
    if (req.user.role === 'manager' && existing.managerId && existing.managerId !== req.user.userId) {
      return error(res, 'Bu lid sizga tegishli emas', 403);
    }
    await prisma.lead.delete({ where: { id: req.params.id } });
    return success(res, null, 'Lid o\'chirildi');
  } catch (err) { next(err); }
};

module.exports = { createLead, getLeads, getLeadStats, updateLead, deleteLead, STATUSES, SOURCES };
