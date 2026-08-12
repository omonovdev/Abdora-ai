const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth.middleware');
const {
  createExpense, getExpenses, updateExpense, deleteExpense,
  getPayroll, setTeacherSalary,
  getSummary, getGroupRevenue, getCashReport, getFinancialAdvice,
} = require('../controllers/finance.controller');

// Finance is management-only: teachers and students never see it.
const FINANCE_ROLES = ['admin', 'manager', 'reception'];
// Only admin and manager decide what a teacher is paid.
const PAYROLL_ROLES = ['admin', 'manager'];

router.get('/summary', verifyToken, requireRole(...FINANCE_ROLES), getSummary);
router.get('/by-group', verifyToken, requireRole(...FINANCE_ROLES), getGroupRevenue);
router.get('/cash', verifyToken, requireRole(...FINANCE_ROLES), getCashReport);
router.get('/advice', verifyToken, requireRole(...FINANCE_ROLES), getFinancialAdvice);

router.get('/expenses', verifyToken, requireRole(...FINANCE_ROLES), getExpenses);
router.post('/expenses', verifyToken, requireRole(...FINANCE_ROLES), createExpense);
router.put('/expenses/:id', verifyToken, requireRole(...FINANCE_ROLES), updateExpense);
router.delete('/expenses/:id', verifyToken, requireRole(...PAYROLL_ROLES), deleteExpense);

router.get('/payroll', verifyToken, requireRole(...PAYROLL_ROLES), getPayroll);
router.put('/teachers/:id/salary', verifyToken, requireRole(...PAYROLL_ROLES), setTeacherSalary);

module.exports = router;
