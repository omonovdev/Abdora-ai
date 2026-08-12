const { prisma } = require('../config/db');
const { success, error } = require('../utils/apiResponse');
const { generateLessonAI, generateTestFromPDFText } = require('../services/ai/lessonAI.service');
const { saveFilesAsAttachments } = require('../utils/fileStorage');

const createLesson = async (req, res, next) => {
  try {
    const { title, content, groupId, subject, aiEnabled } = req.body;
    if (!title || !groupId) return error(res, 'Title and group required', 400);

    const attachments = await saveFilesAsAttachments(req.files);
    // multipart/form-data sends booleans as strings.
    const wantsAI = aiEnabled !== 'false' && aiEnabled !== false;

    const lesson = await prisma.lesson.create({
      data: {
        title, content, subject: subject || 'other', groupId,
        teacherId: req.user.userId, attachments, aiEnabled: wantsAI,
        aiContent: wantsAI ? { status: 'pending' } : { status: 'disabled' },
      },
      include: { group: { select: { id: true, name: true } }, teacher: { select: { id: true, name: true } } },
    });

    if (wantsAI) {
      setImmediate(() => generateLessonAI(lesson.id, title, content || '').catch(console.error));
    }

    return success(res, lesson, 'Lesson created', 201);
  } catch (err) { next(err); }
};

const getLessons = async (req, res, next) => {
  try {
    const { groupId } = req.query;
    const where = { isActive: true };
    if (groupId) where.groupId = groupId;
    if (req.user.role === 'teacher') where.teacherId = req.user.userId;
    if (req.user.role === 'student') {
      const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
      if (user?.groupId) where.groupId = user.groupId;
    }
    const lessons = await prisma.lesson.findMany({
      where, orderBy: { order: 'asc' },
      include: { teacher: { select: { id: true, name: true } }, group: { select: { id: true, name: true } } },
    });
    return success(res, lessons);
  } catch (err) { next(err); }
};

const getLessonById = async (req, res, next) => {
  try {
    const lesson = await prisma.lesson.findUnique({
      where: { id: req.params.id },
      include: { teacher: { select: { id: true, name: true } }, group: { select: { id: true, name: true } } },
    });
    if (!lesson) return error(res, 'Lesson not found', 404);

    if (req.user.role === 'student') {
      await prisma.lesson.update({ where: { id: lesson.id }, data: { views: { increment: 1 } } });
      // Award XP for viewing
      try {
        const { awardXP } = require('../services/gamification.service');
        await awardXP(req.user.userId, 5, 'lesson_view');
      } catch (_) {}
    }

    return success(res, lesson);
  } catch (err) { next(err); }
};

const updateLesson = async (req, res, next) => {
  try {
    const { title, content, subject, order, groupId, aiEnabled } = req.body;

    const existing = await prisma.lesson.findUnique({
      where: { id: req.params.id },
      select: { attachments: true, aiEnabled: true },
    });
    if (!existing) return error(res, 'Lesson not found', 404);

    const newAttachments = await saveFilesAsAttachments(req.files);
    // Newly uploaded files are appended — an edit must never drop the files the
    // teacher attached earlier.
    const merged = [...(Array.isArray(existing.attachments) ? existing.attachments : []), ...newAttachments];

    const wantsAI = aiEnabled === undefined ? existing.aiEnabled : (aiEnabled !== 'false' && aiEnabled !== false);

    const updateData = {
      ...(title !== undefined && { title }),
      ...(content !== undefined && { content }),
      ...(subject !== undefined && { subject }),
      ...(order !== undefined && { order: parseInt(order, 10) || 0 }),
      ...(groupId !== undefined && { groupId }),
      ...(newAttachments.length > 0 && { attachments: merged }),
      ...(aiEnabled !== undefined && { aiEnabled: wantsAI }),
    };

    const lesson = await prisma.lesson.update({
      where: { id: req.params.id },
      data: updateData,
    });
    return success(res, lesson);
  } catch (err) { next(err); }
};

// DELETE /lessons/:id/attachments/:attachmentId — remove one attachment.
const removeAttachment = async (req, res, next) => {
  try {
    const lesson = await prisma.lesson.findUnique({
      where: { id: req.params.id },
      select: { attachments: true, teacherId: true },
    });
    if (!lesson) return error(res, 'Lesson not found', 404);
    if (req.user.role === 'teacher' && lesson.teacherId !== req.user.userId) {
      return error(res, 'Not authorized for this lesson', 403);
    }

    const attachments = (Array.isArray(lesson.attachments) ? lesson.attachments : [])
      .filter(a => a.id !== req.params.attachmentId);

    const updated = await prisma.lesson.update({
      where: { id: req.params.id },
      data: { attachments },
    });
    return success(res, updated, 'Attachment removed');
  } catch (err) { next(err); }
};

const deleteLesson = async (req, res, next) => {
  try {
    await prisma.lesson.update({ where: { id: req.params.id }, data: { isActive: false } });
    return success(res, null, 'Lesson deleted');
  } catch (err) { next(err); }
};

const getAIContent = async (req, res, next) => {
  try {
    const lesson = await prisma.lesson.findUnique({ where: { id: req.params.id }, select: { aiContent: true } });
    if (!lesson) return error(res, 'Lesson not found', 404);
    return success(res, lesson.aiContent);
  } catch (err) { next(err); }
};

const regenerateAI = async (req, res, next) => {
  try {
    const lesson = await prisma.lesson.findUnique({ where: { id: req.params.id } });
    if (!lesson) return error(res, 'Not found', 404);
    if (!lesson.aiEnabled) return error(res, 'Bu dars uchun AI o\'chirilgan', 400);
    await prisma.lesson.update({ where: { id: lesson.id }, data: { aiContent: { status: 'generating' } } });
    setImmediate(() => generateLessonAI(lesson.id, lesson.title, lesson.content || '').catch(console.error));
    return success(res, { status: 'generating' });
  } catch (err) { next(err); }
};

const extractTextFromFile = async (file) => {
  const mime = file.mimetype;

  // Plain text
  if (mime === 'text/plain') {
    return file.buffer.toString('utf8');
  }

  // PDF — pdf-parse v2 exports a PDFParse class, not a callable default.
  if (mime === 'application/pdf') {
    const { PDFParse } = require('pdf-parse');
    const parser = new PDFParse({ data: new Uint8Array(file.buffer) });
    try {
      const result = await parser.getText();
      // Join page texts instead of using result.text — the latter injects
      // "-- 1 of N --" page separators that pollute the AI prompt.
      return (result.pages || []).map(p => p.text).join('\n\n') || result.text || '';
    } finally {
      await parser.destroy().catch(() => {});
    }
  }

  // DOCX / DOC
  if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mime === 'application/msword') {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return result.value;
  }

  // Images — use Gemini vision
  if (mime.startsWith('image/')) {
    const { getModel } = require('../config/gemini');
    const model = getModel(false);
    const imagePart = { inlineData: { data: file.buffer.toString('base64'), mimeType: mime } };
    const result = await model.generateContent([
      'Bu rasmning barcha matnini va ta\'lim mazmunini batafsil yoz. Mavzu, tushunchalar, jadvallar va diagrammalardagi ma\'lumotlarni ham yoz.',
      imagePart,
    ]);
    return result.response.text();
  }

  throw new Error('Qo\'llab-quvvatlanmaydigan fayl turi');
};

// Runs after the HTTP response has been sent — see `source`/`aiStatus` on Test.
const populateTestWithAI = async (testId, pdfText, groupId, teacherId, testTitle, language) => {
  try {
    const generated = await generateTestFromPDFText(pdfText, groupId, teacherId, testTitle, language);

    const questions = (generated.questions || []).map(q => ({
      text: q.text,
      type: 'mcq',
      options: q.options || [],
      difficulty: q.difficulty || 'medium',
      points: q.points || 1,
      // Prefer `studentExplanation` (detailed step-by-step); fall back to `explanation`.
      explanation: q.studentExplanation || q.explanation || '',
    }));

    if (questions.length === 0) {
      await prisma.test.update({
        where: { id: testId },
        data: { aiStatus: 'error', aiError: 'AI bu fayldan savol yarata olmadi' },
      });
      return;
    }

    await prisma.question.createMany({ data: questions.map(q => ({ ...q, testId })) });
    await prisma.test.update({
      where: { id: testId },
      data: {
        title: generated.title || testTitle,
        totalPoints: questions.reduce((s, q) => s + q.points, 0),
        aiStatus: 'ready',
        aiError: null,
      },
    });
  } catch (err) {
    console.error('AI test generation error:', err.message);
    await prisma.test
      .update({ where: { id: testId }, data: { aiStatus: 'error', aiError: err.message } })
      .catch(() => {});
  }
};

const generateTestFromPDF = async (req, res, next) => {
  try {
    const { groupId, title, timeLimit, passingScore, language, useAI } = req.body;
    if (!groupId) return error(res, 'groupId required', 400);
    if (!req.file) return error(res, 'Fayl yuborilmadi', 400);

    // multipart/form-data sends booleans as strings.
    const aiEnabled = useAI !== 'false' && useAI !== false;

    let extractedText;
    try {
      extractedText = await extractTextFromFile(req.file);
    } catch (e) {
      return error(res, `Fayldan matn chiqarib bo'lmadi: ${e.message}`, 400);
    }

    const pdfText = extractedText?.trim() || '';
    if (pdfText.length < 30) {
      return error(res, 'Faylda yetarli matn topilmadi', 400);
    }

    const testTitle = title || `Test - ${new Date().toLocaleDateString('uz-UZ')}`;
    const baseData = {
      title: testTitle,
      type: 'topic',
      groupId,
      teacherId: req.user.userId,
      timeLimit: parseInt(timeLimit, 10) || 30,
      passingScore: parseInt(passingScore, 10) || 60,
    };

    // "AI aralashmasin" — import the questions exactly as the teacher wrote them.
    if (!aiEnabled) {
      const { parseTestFromText } = require('../utils/testParser');
      const { questions, warnings } = parseTestFromText(pdfText);

      if (questions.length === 0) {
        return error(
          res,
          "Fayldan savol topilmadi. Savollar '1. Savol matni' ko'rinishida, variantlar 'A) ...' ko'rinishida bo'lishi kerak. To'g'ri javobni '*B) ...' yoki 'Javob: B' bilan belgilang.",
          400,
        );
      }

      const test = await prisma.test.create({
        data: {
          ...baseData,
          source: 'file_import',
          aiStatus: 'ready',
          totalPoints: questions.reduce((s, q) => s + q.points, 0),
          questions: { create: questions },
        },
        include: { questions: true, group: { select: { id: true, name: true } } },
      });

      return success(res, { ...test, warnings }, `${questions.length} ta savol fayldan olindi`, 201);
    }

    // AI path: return as soon as the row exists, then fill it in the background.
    const test = await prisma.test.create({
      data: { ...baseData, source: 'ai_file', aiStatus: 'generating' },
      include: { questions: true, group: { select: { id: true, name: true } } },
    });

    setImmediate(() =>
      populateTestWithAI(test.id, pdfText, groupId, req.user.userId, testTitle, language || 'uz'),
    );

    return success(res, test, 'AI test tayyorlamoqda', 202);
  } catch (err) { next(err); }
};

module.exports = { createLesson, getLessons, getLessonById, updateLesson, deleteLesson, removeAttachment, getAIContent, regenerateAI, generateTestFromPDF };
