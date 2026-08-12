const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth.middleware');
const { createLead, getLeads, getLeadStats, updateLead, deleteLead } = require('../controllers/lead.controller');

const CRM_ROLES = ['manager', 'admin', 'reception'];

router.get('/', verifyToken, requireRole(...CRM_ROLES), getLeads);
router.get('/stats', verifyToken, requireRole(...CRM_ROLES), getLeadStats);
router.post('/', verifyToken, requireRole(...CRM_ROLES), createLead);
router.put('/:id', verifyToken, requireRole(...CRM_ROLES), updateLead);
router.delete('/:id', verifyToken, requireRole('manager', 'admin'), deleteLead);

module.exports = router;
