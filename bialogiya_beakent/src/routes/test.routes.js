const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth.middleware');
const { createTest, getTests, getTestById, submitTest, getTestResults, getMyResults, getTestAnalysis, deleteTest } = require('../controllers/test.controller');

router.get('/', verifyToken, getTests);
router.get('/results', verifyToken, requireRole('student'), getMyResults);
router.get('/:id', verifyToken, getTestById);
router.post('/', verifyToken, requireRole('teacher', 'admin'), createTest);
router.post('/:id/submit', verifyToken, requireRole('student'), submitTest);
router.get('/:id/results', verifyToken, getTestResults);
router.get('/:id/analysis', verifyToken, requireRole('teacher', 'admin'), getTestAnalysis);
router.delete('/:id', verifyToken, requireRole('teacher', 'admin'), deleteTest);

module.exports = router;
