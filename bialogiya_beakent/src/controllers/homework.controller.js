const { prisma } = require('../config/db');
const { success, error } = require('../utils/apiResponse');
const { saveFilesAsAttachments } = require('../utils/fileStorage');

const createHomework = async (req, res, next) => {
  try {
    const { title, description, groupId, lessonId, dueDate, maxScore } = req.body;
    if (!title || !groupId || !dueDate) return error(res, 'Title, group and due date required', 400);

    const attachments = await saveFilesAsAttachments(req.files);

    // Normalize and validate maxScore (Prisma expects an Int)
    let parsedMaxScore = 100;
    if (maxScore !== undefined && maxScore !== null && maxScore !== '') {
      const n = parseInt(maxScore, 10);
      if (Number.isNaN(n)) return error(res, 'Invalid maxScore value; must be a number', 400);
      parsedMaxScore = n;
    }

    const hw = await prisma.homework.create({
      data: { title, description, groupId, lessonId: lessonId || null, teacherId: req.user.userId, dueDate: new Date(dueDate), maxScore: parsedMaxScore, attachments },
      include: { group: { select: { id: true, name: true } }, teacher: { select: { id: true, name: true } } },
    });
    return success(res, hw, 'Homework created', 201);
  } catch (err) { next(err); }
};

const getHomeworkByGroup = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const hw = await prisma.homework.findMany({
      where: { groupId, isActive: true },
      orderBy: { dueDate: 'asc' },
      include: { lesson: { select: { id: true, title: true } }, _count: { select: { submissions: true } } },
    });
    return success(res, hw);
  } catch (err) { next(err); }
};

const getTeacherHomework = async (req, res, next) => {
  try {
    const hw = await prisma.homework.findMany({
      where: { teacherId: req.user.userId, isActive: true },
      orderBy: { createdAt: 'desc' },
      include: { group: { select: { id: true, name: true } }, _count: { select: { submissions: true } } },
    });
    return success(res, hw);
  } catch (err) { next(err); }
};

const getMyHomework = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.userId }, select: { groupId: true } });
    if (!user?.groupId) return success(res, []);

    const hw = await prisma.homework.findMany({
      where: { groupId: user.groupId, isActive: true },
      orderBy: { dueDate: 'asc' },
      include: {
        lesson: { select: { id: true, title: true } },
        submissions: { where: { studentId: req.user.userId }, select: { id: true, status: true, finalScore: true, createdAt: true } },
      },
    });
    return success(res, hw);
  } catch (err) { next(err); }
};

const getHomeworkById = async (req, res, next) => {
  try {
    const hw = await prisma.homework.findUnique({
      where: { id: req.params.id },
      include: { group: { select: { id: true, name: true } }, teacher: { select: { id: true, name: true } } },
    });
    if (!hw) return error(res, 'Homework not found', 404);
    return success(res, hw);
  } catch (err) { next(err); }
};

const submitHomework = async (req, res, next) => {
  try {
    const { homeworkId } = req.params;
    const { answerText } = req.body;

    const hw = await prisma.homework.findUnique({ where: { id: homeworkId } });
    if (!hw) return error(res, 'Homework not found', 404);

    const filePaths = await saveFilesAsAttachments(req.files);
    const submittedAt = new Date();
    const isLate = submittedAt > new Date(hw.dueDate);

    const existing = await prisma.submission.findUnique({
      where: { homeworkId_studentId: { homeworkId, studentId: req.user.userId } },
    });

    let submission;
    if (existing) {
      submission = await prisma.submission.update({
        where: { id: existing.id },
        data: { answerText, filePaths, isLate, submittedAt, status: 'submitted' },
      });
    } else {
      submission = await prisma.submission.create({
        data: { homeworkId, studentId: req.user.userId, answerText, filePaths, isLate, submittedAt, status: 'submitted' },
      });
      // Award XP
      try {
        const { awardXP } = require('../services/gamification.service');
        await awardXP(req.user.userId, 20, 'homework_submit');
      } catch (_) {}
    }

    // Async AI grading
    if (hw.description || answerText) {
      setImmediate(async () => {
        try {
          const { gradeHomework } = require('../services/ai/gradingAI.service');
          const aiGrade = await gradeHomework(hw.description || hw.title, answerText || '');
          await prisma.submission.update({ where: { id: submission.id }, data: { aiGrade, status: 'ai_graded' } });
        } catch (_) {}
      });
    }

    return success(res, submission, 'Submitted');
  } catch (err) { next(err); }
};

const getSubmissions = async (req, res, next) => {
  try {
    const { homeworkId } = req.params;
    const subs = await prisma.submission.findMany({
      where: { homeworkId },
      include: {
        student: { select: { id: true, name: true, username: true } },
        // dueDate lets the teacher UI show how long before/after the deadline
        // each student actually submitted.
        homework: { select: { id: true, title: true, dueDate: true, maxScore: true } },
      },
      orderBy: { submittedAt: 'desc' },
    });
    return success(res, subs);
  } catch (err) { next(err); }
};

const gradeSubmission = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { score, feedback } = req.body;

    const sub = await prisma.submission.update({
      where: { id },
      data: { finalScore: score, teacherGrade: { score, feedback }, status: 'graded' },
      include: { student: { select: { id: true, name: true } } },
    });

    return success(res, sub, 'Graded');
  } catch (err) { next(err); }
};

const updateHomework = async (req, res, next) => {
  try {
    const { title, description, dueDate, maxScore } = req.body;
    const hw = await prisma.homework.update({
      where: { id: req.params.id },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(dueDate && { dueDate: new Date(dueDate) }),
        ...(maxScore && { maxScore: parseInt(maxScore) }),
      },
      include: { group: { select: { id: true, name: true } } },
    });
    return success(res, hw, 'Homework updated');
  } catch (err) { next(err); }
};

const deleteHomework = async (req, res, next) => {
  try {
    await prisma.homework.update({ where: { id: req.params.id }, data: { isActive: false } });
    return success(res, null, 'Homework deleted');
  } catch (err) { next(err); }
};

module.exports = { createHomework, getHomeworkByGroup, getTeacherHomework, getMyHomework, getHomeworkById, submitHomework, getSubmissions, gradeSubmission, updateHomework, deleteHomework };
