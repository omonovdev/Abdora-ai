const { prisma } = require('../config/db');
const { success, error } = require('../utils/apiResponse');

const EXPENSE_CATEGORIES = ['rent', 'utilities', 'marketing', 'equipment', 'salary', 'tax', 'other'];
const PAYMENT_METHODS = ['cash', 'click', 'payme', 'bank', 'other'];

const monthKey = (date) => new Date(date).toISOString().slice(0, 7);

// "2026-08" -> [inclusive start, exclusive end) so date filters stay index-friendly.
const monthRange = (month) => {
  const [year, mon] = month.split('-').map(Number);
  return { start: new Date(Date.UTC(year, mon - 1, 1)), end: new Date(Date.UTC(year, mon, 1)) };
};

const lastMonths = (count, endMonth) => {
  const [year, mon] = (endMonth || monthKey(new Date())).split('-').map(Number);
  const months = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(year, mon - 1 - i, 1));
    months.push(d.toISOString().slice(0, 7));
  }
  return months;
};

// Reception and managers are limited to the branches they are responsible for;
// admin sees the whole business.
const branchFilter = (user) => {
  if (user.role === 'reception') return { receptionId: user.userId };
  if (user.role === 'manager') return { managerId: user.userId };
  return null;
};

// Payments predate the branchId column, so scope them through the student's
// group instead of relying on Payment.branchId being populated.
const paymentScope = (user, branchId) => {
  const branch = branchFilter(user);
  if (!branch && !branchId) return {};
  const where = { ...(branch || {}), ...(branchId ? { id: branchId } : {}) };
  return { student: { group: { is: { branch: { is: where } } } } };
};

const expenseScope = (user, branchId) => {
  const branch = branchFilter(user);
  if (!branch && !branchId) return {};
  return { branch: { is: { ...(branch || {}), ...(branchId ? { id: branchId } : {}) } } };
};

/* ---------------------------------------------------------------- expenses */

const createExpense = async (req, res, next) => {
  try {
    const { category, title, amount, date, note, branchId, method } = req.body;
    if (!title?.trim()) return error(res, 'Xarajat nomi kiritilmagan', 400);
    if (!EXPENSE_CATEGORIES.includes(category)) {
      return error(res, `Toifa noto'g'ri. Ruxsat etilgan: ${EXPENSE_CATEGORIES.join(', ')}`, 400);
    }
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) return error(res, 'Summa 0 dan katta bo\'lishi kerak', 400);
    if (method && !PAYMENT_METHODS.includes(method)) return error(res, 'To\'lov turi noto\'g\'ri', 400);

    const expense = await prisma.expense.create({
      data: {
        category,
        title: title.trim(),
        amount: Math.round(parsed),
        date: date ? new Date(date) : new Date(),
        note: note?.trim() || null,
        method: method || 'cash',
        branchId: branchId || null,
        createdById: req.user.userId,
      },
      include: { branch: { select: { id: true, name: true } } },
    });

    return success(res, expense, 'Xarajat qo\'shildi', 201);
  } catch (err) { next(err); }
};

// GET /finance/expenses?month=2026-08&category=rent
const getExpenses = async (req, res, next) => {
  try {
    const { month, category, branchId } = req.query;
    const where = { ...expenseScope(req.user, branchId) };

    if (month) {
      const { start, end } = monthRange(month);
      where.date = { gte: start, lt: end };
    }
    if (category && category !== 'all') {
      if (!EXPENSE_CATEGORIES.includes(category)) return error(res, 'Toifa noto\'g\'ri', 400);
      where.category = category;
    }

    const expenses = await prisma.expense.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        branch: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    const byCategory = expenses.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.amount;
      return acc;
    }, {});

    return success(res, {
      expenses,
      total: expenses.reduce((s, e) => s + e.amount, 0),
      byCategory,
    });
  } catch (err) { next(err); }
};

const updateExpense = async (req, res, next) => {
  try {
    const { category, title, amount, date, note, branchId, method } = req.body;
    const existing = await prisma.expense.findUnique({ where: { id: req.params.id } });
    if (!existing) return error(res, 'Xarajat topilmadi', 404);
    if (category !== undefined && !EXPENSE_CATEGORIES.includes(category)) return error(res, 'Toifa noto\'g\'ri', 400);
    if (method !== undefined && !PAYMENT_METHODS.includes(method)) return error(res, 'To\'lov turi noto\'g\'ri', 400);

    let parsedAmount;
    if (amount !== undefined) {
      const n = Number(amount);
      if (!Number.isFinite(n) || n <= 0) return error(res, 'Summa 0 dan katta bo\'lishi kerak', 400);
      parsedAmount = Math.round(n);
    }

    const expense = await prisma.expense.update({
      where: { id: req.params.id },
      data: {
        ...(category !== undefined && { category }),
        ...(title !== undefined && { title: title.trim() }),
        ...(parsedAmount !== undefined && { amount: parsedAmount }),
        ...(date !== undefined && { date: new Date(date) }),
        ...(note !== undefined && { note: note?.trim() || null }),
        ...(method !== undefined && { method }),
        ...(branchId !== undefined && { branchId: branchId || null }),
      },
      include: { branch: { select: { id: true, name: true } } },
    });

    return success(res, expense, 'Xarajat yangilandi');
  } catch (err) { next(err); }
};

const deleteExpense = async (req, res, next) => {
  try {
    const existing = await prisma.expense.findUnique({ where: { id: req.params.id } });
    if (!existing) return error(res, 'Xarajat topilmadi', 404);
    await prisma.expense.delete({ where: { id: req.params.id } });
    return success(res, null, 'Xarajat o\'chirildi');
  } catch (err) { next(err); }
};

/* ----------------------------------------------------------------- payroll */

// What each teacher earns for a month. Percent-based teachers are paid a share
// of what their own groups actually collected, so an unpaid student reduces the
// teacher's cut too - which is how these centres normally operate.
const computePayroll = async (user, month, branchId) => {
  const branch = branchFilter(user);
  const groupWhere = {
    isActive: true,
    ...((branch || branchId) ? { branch: { is: { ...(branch || {}), ...(branchId ? { id: branchId } : {}) } } } : {}),
  };

  const groups = await prisma.group.findMany({
    where: groupWhere,
    select: {
      id: true, name: true, monthlyFee: true,
      teacher: {
        select: { id: true, name: true, salaryType: true, salaryShare: true, hourlyRate: true, fixedSalary: true },
      },
      students: { where: { role: 'student', isActive: true }, select: { id: true } },
    },
  });

  const studentIds = groups.flatMap(g => g.students.map(s => s.id));
  const payments = studentIds.length > 0
    ? await prisma.payment.findMany({
      where: { month, studentId: { in: studentIds } },
      select: { studentId: true, amount: true },
    })
    : [];

  const paidByStudent = {};
  payments.forEach(p => { paidByStudent[p.studentId] = (paidByStudent[p.studentId] || 0) + (p.amount || 0); });

  const byTeacher = new Map();

  groups.forEach(g => {
    if (!g.teacher) return;
    const collected = g.students.reduce((s, st) => s + (paidByStudent[st.id] || 0), 0);
    const expected = g.students.length * (g.monthlyFee || 0);

    if (!byTeacher.has(g.teacher.id)) {
      byTeacher.set(g.teacher.id, {
        teacherId: g.teacher.id,
        name: g.teacher.name,
        salaryType: g.teacher.salaryType || 'percent',
        salaryShare: g.teacher.salaryShare ?? 50,
        hourlyRate: g.teacher.hourlyRate,
        fixedSalary: g.teacher.fixedSalary,
        groups: [],
        collected: 0,
        expected: 0,
        studentCount: 0,
      });
    }

    const row = byTeacher.get(g.teacher.id);
    row.groups.push({ id: g.id, name: g.name, collected, expected, studentCount: g.students.length });
    row.collected += collected;
    row.expected += expected;
    row.studentCount += g.students.length;
  });

  return [...byTeacher.values()].map(row => {
    let salary;
    if (row.salaryType === 'fixed') salary = row.fixedSalary || 0;
    else if (row.salaryType === 'hourly') salary = 0; // needs logged hours; reported separately
    else salary = Math.round((row.collected * row.salaryShare) / 100);

    return {
      ...row,
      salary,
      centerShare: row.salaryType === 'percent' ? row.collected - salary : row.collected - salary,
      // Text the manager sees, e.g. "50/50" or "1/3".
      shareLabel: row.salaryType === 'percent'
        ? (row.salaryShare === 33 ? '1/3' : row.salaryShare === 67 ? '2/3' : `${row.salaryShare}/${100 - row.salaryShare}`)
        : row.salaryType,
    };
  }).sort((a, b) => b.salary - a.salary);
};

// GET /finance/payroll?month=2026-08
const getPayroll = async (req, res, next) => {
  try {
    const month = req.query.month || monthKey(new Date());
    const rows = await computePayroll(req.user, month, req.query.branchId);

    return success(res, {
      month,
      teachers: rows,
      totalSalary: rows.reduce((s, r) => s + r.salary, 0),
      totalCollected: rows.reduce((s, r) => s + r.collected, 0),
      hourlyTeachersNeedHours: rows.filter(r => r.salaryType === 'hourly').map(r => r.name),
    });
  } catch (err) { next(err); }
};

// PUT /finance/teachers/:id/salary — manager sets 1/3, 50/50, 2/3 etc.
const setTeacherSalary = async (req, res, next) => {
  try {
    const { salaryType, salaryShare, hourlyRate, fixedSalary } = req.body;

    if (salaryType !== undefined && !['percent', 'hourly', 'fixed'].includes(salaryType)) {
      return error(res, 'Ish haqi turi noto\'g\'ri (percent | hourly | fixed)', 400);
    }
    if (salaryShare !== undefined) {
      const n = Number(salaryShare);
      if (!Number.isFinite(n) || n < 0 || n > 100) return error(res, 'Foiz 0 va 100 orasida bo\'lishi kerak', 400);
    }

    const teacher = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true, role: true } });
    if (!teacher || teacher.role !== 'teacher') return error(res, 'O\'qituvchi topilmadi', 404);

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        ...(salaryType !== undefined && { salaryType }),
        ...(salaryShare !== undefined && { salaryShare: Math.round(Number(salaryShare)) }),
        ...(hourlyRate !== undefined && { hourlyRate: hourlyRate === null ? null : Math.round(Number(hourlyRate)) }),
        ...(fixedSalary !== undefined && { fixedSalary: fixedSalary === null ? null : Math.round(Number(fixedSalary)) }),
      },
      select: { id: true, name: true, salaryType: true, salaryShare: true, hourlyRate: true, fixedSalary: true },
    });

    return success(res, updated, 'Ish haqi shartlari saqlandi');
  } catch (err) { next(err); }
};

/* --------------------------------------------------------------- dashboard */

const buildSummary = async (user, { month, months: historyLength = 6, branchId } = {}) => {
  const months = lastMonths(Math.min(Math.max(historyLength, 2), 24), month);
  const targetMonth = months[months.length - 1];

  const pScope = paymentScope(user, branchId);
  const eScope = expenseScope(user, branchId);

  const [payments, expenses] = await Promise.all([
    prisma.payment.findMany({
      where: { ...pScope, month: { in: months } },
      select: { month: true, amount: true, expectedAmount: true, status: true, method: true },
    }),
    prisma.expense.findMany({
      where: {
        ...eScope,
        date: { gte: monthRange(months[0]).start, lt: monthRange(targetMonth).end },
      },
      select: { date: true, amount: true, category: true },
    }),
  ]);

  const series = months.map(m => ({ month: m, income: 0, expense: 0, expected: 0, profit: 0 }));
  const indexOf = Object.fromEntries(months.map((m, i) => [m, i]));

  payments.forEach(p => {
    const i = indexOf[p.month];
    if (i === undefined) return;
    series[i].income += p.amount || 0;
    series[i].expected += p.expectedAmount || 0;
  });

  expenses.forEach(e => {
    const i = indexOf[monthKey(e.date)];
    if (i === undefined) return;
    series[i].expense += e.amount;
  });

  series.forEach(s => { s.profit = s.income - s.expense; });

  const current = series[series.length - 1];
  const previous = series.length > 1 ? series[series.length - 2] : null;

  const expensesByCategory = expenses
    .filter(e => monthKey(e.date) === targetMonth)
    .reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.amount;
      return acc;
    }, {});

  const currentPayments = payments.filter(p => p.month === targetMonth);
  const incomeByMethod = currentPayments.reduce((acc, p) => {
    if (!p.amount) return acc;
    acc[p.method || 'cash'] = (acc[p.method || 'cash'] || 0) + p.amount;
    return acc;
  }, {});

  const outstanding = currentPayments.reduce(
    (s, p) => s + Math.max(0, (p.expectedAmount || 0) - (p.amount || 0)), 0,
  );

  // Naive but honest forecast: the average of the months that actually have data.
  const withData = series.filter(s => s.income > 0 || s.expense > 0);
  const avgIncome = withData.length ? Math.round(withData.reduce((s, x) => s + x.income, 0) / withData.length) : 0;
  const avgExpense = withData.length ? Math.round(withData.reduce((s, x) => s + x.expense, 0) / withData.length) : 0;

  const pctChange = (now, before) => (before > 0 ? Math.round(((now - before) / before) * 100) : null);

  return {
    month: targetMonth,
    series,
    current,
    previous,
    change: previous
      ? { income: pctChange(current.income, previous.income), expense: pctChange(current.expense, previous.expense) }
      : { income: null, expense: null },
    expensesByCategory,
    incomeByMethod,
    outstanding,
    forecast: {
      basedOnMonths: withData.length,
      expectedIncome: avgIncome,
      expectedExpense: avgExpense,
      expectedProfit: avgIncome - avgExpense,
    },
  };
};

// GET /finance/summary?month=2026-08&months=6
const getSummary = async (req, res, next) => {
  try {
    const summary = await buildSummary(req.user, {
      month: req.query.month || monthKey(new Date()),
      months: parseInt(req.query.months, 10) || 6,
      branchId: req.query.branchId,
    });
    return success(res, summary);
  } catch (err) { next(err); }
};

// GET /finance/by-group?month=2026-08 — which courses actually bring money in.
const getGroupRevenue = async (req, res, next) => {
  try {
    const month = req.query.month || monthKey(new Date());
    const branch = branchFilter(req.user);
    const branchId = req.query.branchId;

    const groups = await prisma.group.findMany({
      where: {
        isActive: true,
        ...((branch || branchId) ? { branch: { is: { ...(branch || {}), ...(branchId ? { id: branchId } : {}) } } } : {}),
      },
      select: {
        id: true, name: true, subject: true, monthlyFee: true, level: true,
        teacher: { select: { id: true, name: true, salaryType: true, salaryShare: true } },
        branch: { select: { id: true, name: true } },
        students: { where: { role: 'student', isActive: true }, select: { id: true, isFrozen: true } },
      },
    });

    const studentIds = groups.flatMap(g => g.students.map(s => s.id));
    const payments = studentIds.length > 0
      ? await prisma.payment.findMany({
        where: { month, studentId: { in: studentIds } },
        select: { studentId: true, amount: true, expectedAmount: true },
      })
      : [];

    const paid = {};
    payments.forEach(p => { paid[p.studentId] = (paid[p.studentId] || 0) + (p.amount || 0); });

    const rows = groups.map(g => {
      const active = g.students.filter(s => !s.isFrozen);
      const collected = g.students.reduce((s, st) => s + (paid[st.id] || 0), 0);
      const expected = active.length * (g.monthlyFee || 0);
      const share = g.teacher?.salaryType === 'percent' ? (g.teacher.salaryShare ?? 50) : 0;
      const teacherCut = Math.round((collected * share) / 100);

      return {
        groupId: g.id,
        name: g.name,
        subject: g.subject,
        level: g.level,
        teacher: g.teacher ? { id: g.teacher.id, name: g.teacher.name } : null,
        branch: g.branch,
        studentCount: g.students.length,
        activeCount: active.length,
        monthlyFee: g.monthlyFee || 0,
        collected,
        expected,
        debt: Math.max(0, expected - collected),
        collectionRate: expected > 0 ? Math.round((collected / expected) * 100) : 0,
        teacherCut,
        centerNet: collected - teacherCut,
      };
    }).sort((a, b) => b.centerNet - a.centerNet);

    return success(res, { month, groups: rows });
  } catch (err) { next(err); }
};

// GET /finance/cash?date=2026-08-12 — one day's till: what came in, what went out.
const getCashReport = async (req, res, next) => {
  try {
    const dateStr = req.query.date || new Date().toISOString().slice(0, 10);
    const start = new Date(`${dateStr}T00:00:00.000Z`);
    if (Number.isNaN(start.getTime())) return error(res, 'Sana noto\'g\'ri', 400);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);

    const [payments, expenses] = await Promise.all([
      prisma.payment.findMany({
        where: { ...paymentScope(req.user, req.query.branchId), paidAt: { gte: start, lt: end }, amount: { gt: 0 } },
        select: {
          id: true, amount: true, method: true, month: true, paidAt: true, note: true,
          student: { select: { id: true, name: true, group: { select: { id: true, name: true } } } },
        },
        orderBy: { paidAt: 'desc' },
      }),
      prisma.expense.findMany({
        where: { ...expenseScope(req.user, req.query.branchId), date: { gte: start, lt: end } },
        select: { id: true, title: true, category: true, amount: true, method: true, date: true, note: true },
        orderBy: { date: 'desc' },
      }),
    ]);

    const incomeTotal = payments.reduce((s, p) => s + (p.amount || 0), 0);
    const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0);

    const sumByMethod = (rows) => rows.reduce((acc, r) => {
      acc[r.method || 'cash'] = (acc[r.method || 'cash'] || 0) + (r.amount || 0);
      return acc;
    }, {});

    return success(res, {
      date: dateStr,
      income: { total: incomeTotal, byMethod: sumByMethod(payments), entries: payments },
      expense: { total: expenseTotal, byMethod: sumByMethod(expenses), entries: expenses },
      balance: incomeTotal - expenseTotal,
    });
  } catch (err) { next(err); }
};

/* -------------------------------------------------------------- AI advisor */

// GET /finance/advice?month=2026-08
const getFinancialAdvice = async (req, res, next) => {
  try {
    const month = req.query.month || monthKey(new Date());
    const cache = require('../utils/simpleCache');
    const cacheKey = `finance-advice:${req.user.userId}:${month}`;

    const cached = cache.get(cacheKey);
    if (cached) return success(res, cached);

    const summary = await buildSummary(req.user, { month, months: 6, branchId: req.query.branchId });

    const hasData = summary.series.some(s => s.income > 0 || s.expense > 0);
    if (!hasData) {
      return success(res, { month, advice: null, message: 'Tahlil uchun yetarli ma\'lumot yo\'q' });
    }

    const { getFinanceAdvicePrompt } = require('../services/ai/prompts');
    const { getModel } = require('../config/gemini');

    let advice = null;
    try {
      const model = getModel(true);
      const result = await model.generateContent(getFinanceAdvicePrompt(summary, month));
      advice = JSON.parse(result.response.text());
    } catch (e) {
      console.error('Finance advice error:', e.message);
    }

    const payload = { month, advice, summary: { current: summary.current, change: summary.change } };
    if (advice) cache.set(cacheKey, payload, 60 * 60 * 1000);

    return success(res, payload);
  } catch (err) { next(err); }
};

module.exports = {
  createExpense, getExpenses, updateExpense, deleteExpense,
  getPayroll, setTeacherSalary,
  getSummary, getGroupRevenue, getCashReport, getFinancialAdvice,
  EXPENSE_CATEGORIES,
};
