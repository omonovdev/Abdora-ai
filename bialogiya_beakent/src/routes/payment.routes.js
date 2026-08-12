const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth.middleware');
const { getGroupPayments, markPayment, removePayment, getDebtors, exportGroupPayments } = require('../controllers/payment.controller');

const STAFF = ['teacher', 'admin', 'reception', 'manager'];

router.get('/debts', verifyToken, requireRole(...STAFF), getDebtors);
router.get('/group/:groupId', verifyToken, requireRole(...STAFF), getGroupPayments);
router.get('/group/:groupId/export', verifyToken, requireRole(...STAFF), exportGroupPayments);
router.post('/', verifyToken, requireRole(...STAFF), markPayment);
router.delete('/:studentId/:month', verifyToken, requireRole(...STAFF), removePayment);

module.exports = router;
