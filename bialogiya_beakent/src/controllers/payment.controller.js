const { prisma } = require('../config/db');
const { success, error } = require('../utils/apiResponse');
const ExcelJS = require('exceljs');

const PAYMENT_METHODS = ['cash', 'click', 'payme', 'bank', 'other'];

// A month is only "paid" once the full expected fee is covered; anything in
// between is explicitly partial so reception can see who still owes what.
const deriveStatus = (amount, expectedAmount) => {
  if (expectedAmount > 0 && amount >= expectedAmount) return 'paid';
  if (amount > 0) return 'partial';
  return 'unpaid';
};

// GET /payments/group/:groupId?month=2026-07
const getGroupPayments = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const month = req.query.month || new Date().toISOString().slice(0, 7); // "2026-07"

    const group = await prisma.group.findUnique({ where: { id: groupId }, select: { monthlyFee: true, name: true } });
    if (!group) return error(res, 'Group not found', 404);

    const students = await prisma.user.findMany({
      where: { groupId, role: 'student', isActive: true },
      select: { id: true, name: true, username: true, phone: true, isFrozen: true },
      orderBy: { name: 'asc' },
    });

    const payments = await prisma.payment.findMany({
      where: {
        studentId: { in: students.map(s => s.id) },
        month,
      },
    });

    const paymentMap = {};
    payments.forEach(p => { paymentMap[p.studentId] = p; });

    const monthlyFee = group.monthlyFee || 0;

    const result = students.map(s => {
      const payment = paymentMap[s.id] || null;
      const expected = payment?.expectedAmount || monthlyFee;
      const paid = payment?.amount || 0;
      return {
        ...s,
        payment,
        status: payment?.status || 'unpaid',
        paidAmount: paid,
        expectedAmount: expected,
        // Frozen students are not chased for the month they are frozen.
        debt: s.isFrozen ? 0 : Math.max(0, expected - paid),
        isPaid: (payment?.status || 'unpaid') === 'paid',
      };
    });

    const totals = result.reduce((acc, r) => ({
      expected: acc.expected + (r.isFrozen ? 0 : r.expectedAmount),
      collected: acc.collected + r.paidAmount,
      debt: acc.debt + r.debt,
    }), { expected: 0, collected: 0, debt: 0 });

    return success(res, {
      students: result,
      monthlyFee,
      groupName: group.name,
      month,
      totals,
    });
  } catch (err) { next(err); }
};

// POST /payments — upsert payment for student+month
const markPayment = async (req, res, next) => {
  try {
    const { studentId, month, amount, expectedAmount, method, note, isPaid } = req.body;
    if (!studentId || !month) return error(res, 'studentId and month required', 400);

    const student = await prisma.user.findUnique({
      where: { id: studentId },
      select: { id: true, isActive: true, role: true, group: { select: { monthlyFee: true, branchId: true } } },
    });
    if (!student || student.role !== 'student' || !student.isActive) return error(res, 'Student not found or inactive', 404);

    const expected = Number.isFinite(Number(expectedAmount))
      ? Math.max(0, Number(expectedAmount))
      : (student.group?.monthlyFee || 0);

    // `amount` is authoritative. `isPaid` is still accepted so older clients
    // that only send a boolean keep working: true means the full fee came in.
    let paid;
    if (amount !== undefined && amount !== null && amount !== '') {
      const n = Number(amount);
      if (!Number.isFinite(n) || n < 0) return error(res, 'Noto\'g\'ri summa', 400);
      paid = Math.round(n);
    } else {
      paid = isPaid === false ? 0 : expected;
    }

    if (method !== undefined && !PAYMENT_METHODS.includes(method)) {
      return error(res, `To'lov turi noto'g'ri. Ruxsat etilgan: ${PAYMENT_METHODS.join(', ')}`, 400);
    }

    const status = deriveStatus(paid, expected);
    // Only chase a reason when money is actually missing. A group with no fee
    // configured has nothing outstanding, so it must not be blocked.
    if (expected > paid && !note?.trim()) {
      return error(res, "To'liq to'lanmagan bo'lsa, izoh yozing (nima sababdan to'lanmadi)", 400);
    }

    const data = {
      status,
      isPaid: status === 'paid',
      amount: paid,
      expectedAmount: expected,
      method: method || 'cash',
      note: note?.trim() || null,
      branchId: student.group?.branchId || null,
      paidAt: new Date(),
    };

    const payment = await prisma.payment.upsert({
      where: { studentId_month: { studentId, month } },
      create: { studentId, month, teacherId: req.user.userId, ...data },
      update: data,
    });

    return success(res, payment);
  } catch (err) { next(err); }
};

// GET /payments/debts?month=2026-07 — everyone who still owes money.
const getDebtors = async (req, res, next) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7);
    const branchScope = req.user.role === 'reception'
      ? { branch: { receptionId: req.user.userId } }
      : req.user.role === 'manager'
        ? { branch: { managerId: req.user.userId } }
        : {};

    const students = await prisma.user.findMany({
      where: {
        role: 'student',
        isActive: true,
        isFrozen: false,
        group: { is: { isActive: true, ...branchScope } },
      },
      select: {
        id: true, name: true, username: true, phone: true,
        group: { select: { id: true, name: true, monthlyFee: true, branch: { select: { id: true, name: true } } } },
      },
      orderBy: { name: 'asc' },
    });

    const payments = await prisma.payment.findMany({
      where: { month, studentId: { in: students.map(s => s.id) } },
    });
    const byStudent = {};
    payments.forEach(p => { byStudent[p.studentId] = p; });

    const debtors = students
      .map(s => {
        const p = byStudent[s.id];
        const expected = p?.expectedAmount || s.group?.monthlyFee || 0;
        const paid = p?.amount || 0;
        return {
          studentId: s.id,
          name: s.name,
          username: s.username,
          phone: s.phone,
          group: s.group,
          branch: s.group?.branch || null,
          expectedAmount: expected,
          paidAmount: paid,
          debt: Math.max(0, expected - paid),
          status: p?.status || 'unpaid',
          note: p?.note || null,
        };
      })
      .filter(d => d.debt > 0)
      .sort((a, b) => b.debt - a.debt);

    const totalDebt = debtors.reduce((s, d) => s + d.debt, 0);

    return success(res, { month, debtors, totalDebt, count: debtors.length });
  } catch (err) { next(err); }
};

// DELETE /payments/:studentId/:month — remove payment record
const removePayment = async (req, res, next) => {
  try {
    const { studentId, month } = req.params;
    await prisma.payment.deleteMany({ where: { studentId, month } });
    return success(res, null, 'Payment record removed');
  } catch (err) { next(err); }
};

const exportGroupPayments = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const group = await prisma.group.findUnique({ where: { id: groupId }, select: { monthlyFee: true, name: true } });
    if (!group) return error(res, 'Group not found', 404);

    const students = await prisma.user.findMany({
      where: { groupId, role: 'student', isActive: true },
      select: { id: true, name: true, username: true, phone: true },
      orderBy: { name: 'asc' },
    });

    const payments = await prisma.payment.findMany({
      where: { studentId: { in: students.map(s => s.id) } },
      orderBy: [{ month: 'desc' }, { paidAt: 'desc' }],
    });

    const studentMap = {};
    students.forEach(s => { studentMap[s.id] = s; });

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Abdora AI';
    const ws = wb.addWorksheet("To'lovlar tarixi");

    ws.columns = [
      { header: "O'quvchi", key: 'name', width: 26 },
      { header: 'Login', key: 'username', width: 18 },
      { header: 'Telefon', key: 'phone', width: 16 },
      { header: 'Oy', key: 'month', width: 12 },
      { header: 'Holati', key: 'status', width: 14 },
      { header: 'Summa (so\'m)', key: 'amount', width: 14 },
      { header: "To'langan sana", key: 'paidAt', width: 18 },
      { header: 'Izoh', key: 'note', width: 24 },
    ];
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEFF' } };

    payments.forEach(p => {
      const s = studentMap[p.studentId];
      const STATUS_LABEL = { paid: "To'langan", partial: "Qisman", unpaid: "To'lanmagan" };
      ws.addRow({
        name: s?.name || '—',
        username: s?.username || '—',
        phone: s?.phone || '—',
        month: p.month,
        status: STATUS_LABEL[p.status] || (p.isPaid ? "To'langan" : "To'lanmagan"),
        amount: p.amount || 0,
        paidAt: p.paidAt ? new Date(p.paidAt).toLocaleDateString('uz-UZ') : '—',
        note: p.note || '',
      });
    });

    if (payments.length === 0) {
      ws.addRow({ name: "Hozircha to'lov yozuvlari yo'q" });
    }

    // Summary row
    const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);
    ws.addRow({});
    const summaryRow = ws.addRow({ name: 'Jami yig\'ilgan', amount: totalPaid });
    summaryRow.font = { bold: true };

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(group.name)}-tolovlar.xlsx"`,
    });
    await wb.xlsx.write(res);
    res.end();
  } catch (err) { next(err); }
};

module.exports = { getGroupPayments, markPayment, removePayment, getDebtors, exportGroupPayments };
