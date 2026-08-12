// One-off backfill for payment rows created before the amount/status columns
// existed. Those rows only carried the isPaid boolean, so `db push` gave them
// the column defaults (status 'paid', amount 0) regardless of what really
// happened - which reports an unpaid month as paid and hides real income.
//
//   node src/utils/backfillPayments.js           # dry run, prints the plan
//   node src/utils/backfillPayments.js --apply   # writes the changes
//
// Safe to re-run: rows that already carry a real amount are left alone.

require('dotenv').config();
const { prisma } = require('../config/db');

const apply = process.argv.includes('--apply');

const run = async () => {
  const payments = await prisma.payment.findMany({
    select: {
      id: true, month: true, isPaid: true, status: true, amount: true, expectedAmount: true,
      student: { select: { name: true, group: { select: { monthlyFee: true, branchId: true } } } },
    },
    orderBy: { month: 'asc' },
  });

  const planned = [];

  for (const p of payments) {
    // Anything with a real amount was written by the new UI - don't touch it.
    if (p.amount > 0) continue;

    const fee = p.student?.group?.monthlyFee || 0;
    const expectedAmount = p.expectedAmount > 0 ? p.expectedAmount : fee;
    const amount = p.isPaid ? expectedAmount : 0;
    const status = p.isPaid ? 'paid' : 'unpaid';

    const changed = status !== p.status || amount !== p.amount || expectedAmount !== p.expectedAmount;
    if (!changed) continue;

    planned.push({
      id: p.id,
      who: `${p.student?.name || '?'} ${p.month}`,
      from: `status=${p.status} amount=${p.amount} expected=${p.expectedAmount}`,
      to: `status=${status} amount=${amount} expected=${expectedAmount}`,
      data: { status, amount, expectedAmount, branchId: p.student?.group?.branchId || null },
    });
  }

  console.log(`${payments.length} ta to'lov ko'rildi, ${planned.length} tasi yangilanadi:\n`);
  planned.forEach(x => console.log(`  ${x.who}\n    ${x.from}  ->  ${x.to}`));

  const noFee = planned.filter(x => x.data.expectedAmount === 0 && x.data.status === 'paid');
  if (noFee.length > 0) {
    console.log(`\nDiqqat: ${noFee.length} ta yozuv "to'langan", lekin guruhga oylik to'lov`
      + ` belgilanmagani uchun summa 0 bo'lib qoladi. Guruhga monthlyFee qo'ying va skriptni qayta ishga tushiring.`);
  }

  if (!apply) {
    console.log('\nDry run - hech narsa o\'zgartirilmadi. Qo\'llash uchun: --apply');
    return;
  }

  for (const x of planned) {
    await prisma.payment.update({ where: { id: x.id }, data: x.data });
  }
  console.log(`\n${planned.length} ta yozuv yangilandi.`);
};

run()
  .catch(err => { console.error('Backfill xatosi:', err.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
