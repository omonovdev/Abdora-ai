// Deterministic test parser used when the teacher opts out of AI ("AI aralashmasin").
// The file is imported verbatim: questions, options and the answer key are read
// exactly as written, with no model in the loop that could reword them.

const QUESTION_START = /^\s*(?:savol\s*)?(\d{1,3})\s*[.)\-–]\s*(.+)$/i;
const OPTION_START = /^\s*(\*?)\s*([A-Da-dА-Га-г])\s*[.)\-:]\s*(.+)$/;
const INLINE_ANSWER = /^\s*(?:to['’`]?g['’`]?ri\s+javob|javob|answer|otvet|ответ)\s*[:\-–]?\s*([A-Da-dА-Га-г])\s*$/i;
const ANSWER_KEY_PAIR = /(\d{1,3})\s*[.)\-–:]?\s*([A-Da-dА-Га-г])\b/g;
// Header that introduces a trailing answer-key block ("Javoblar:", "Ответы:").
const ANSWER_KEY_HEADER = /^\s*(?:to['’`]?g['’`]?ri\s+)?(?:javoblar|javob\s*kaliti|answers?\s*key|answers|ответы)\s*[:\-–]?\s*$/i;

// Cyrillic А/Б/В/Г are used in Uzbek and Russian test papers interchangeably
// with Latin A/B/C/D — normalise both onto the same 0-3 index.
const LETTER_INDEX = {
  a: 0, b: 1, c: 2, d: 3,
  а: 0, б: 1, в: 2, г: 3,
};

const letterToIndex = (letter) => {
  const idx = LETTER_INDEX[String(letter).toLowerCase()];
  return idx === undefined ? -1 : idx;
};

// An answer key is usually a trailing block of "1-B 2-C 3-A" pairs. Only treat a
// line as key material when it is almost entirely number+letter pairs, so a
// normal sentence that happens to contain "3-B" is not mistaken for one.
const parseAnswerKeyLine = (line) => {
  const pairs = [];
  let match;
  ANSWER_KEY_PAIR.lastIndex = 0;
  while ((match = ANSWER_KEY_PAIR.exec(line)) !== null) {
    pairs.push({ number: parseInt(match[1], 10), index: letterToIndex(match[2]) });
  }
  if (pairs.length === 0) return null;
  const stripped = line.replace(ANSWER_KEY_PAIR, '').replace(/[\s,;|]/g, '');
  return stripped.length <= pairs.length ? pairs : null;
};

const finalize = (question) => {
  if (!question) return null;
  const text = question.textLines.join(' ').trim();
  if (!text || question.options.length < 2) return null;

  const hasCorrect = question.options.some(o => o.isCorrect);
  const options = question.options.map((o, i) => ({
    text: o.text.trim(),
    // Nothing marked the answer — default to the first option so the test is
    // still importable; the teacher fixes it in the editor.
    isCorrect: hasCorrect ? o.isCorrect : i === 0,
  }));

  return {
    number: question.number,
    text,
    type: 'mcq',
    options,
    difficulty: 'medium',
    points: 1,
    explanation: '',
    hasExplicitAnswer: hasCorrect,
  };
};

/**
 * Parse multiple-choice questions out of raw text extracted from a PDF/DOCX/TXT.
 * Returns { questions, warnings } — never throws on malformed input.
 */
const parseTestFromText = (rawText) => {
  const lines = String(rawText || '').split(/\r?\n/);
  const questions = [];
  const answerKey = new Map();
  let current = null;

  const push = () => {
    const done = finalize(current);
    if (done) questions.push(done);
    current = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const inlineAnswer = trimmed.match(INLINE_ANSWER);
    if (inlineAnswer && current) {
      const idx = letterToIndex(inlineAnswer[1]);
      current.options.forEach((o, i) => { o.isCorrect = i === idx; });
      continue;
    }

    if (ANSWER_KEY_HEADER.test(trimmed)) {
      push();
      continue;
    }

    // Must run before QUESTION_START: a key row like "1-B 2-A" also looks like
    // the start of question 1. parseAnswerKeyLine only accepts a line that is
    // almost entirely number+letter pairs, so real question stems fall through.
    const keyPairs = parseAnswerKeyLine(trimmed);
    if (keyPairs) {
      keyPairs.forEach(({ number, index }) => { if (index >= 0) answerKey.set(number, index); });
      continue;
    }

    const questionMatch = trimmed.match(QUESTION_START);
    if (questionMatch) {
      push();
      current = { number: parseInt(questionMatch[1], 10), textLines: [questionMatch[2]], options: [] };
      continue;
    }

    const optionMatch = trimmed.match(OPTION_START);
    if (optionMatch && current) {
      current.options.push({
        text: optionMatch[3],
        isCorrect: optionMatch[1] === '*',
      });
      continue;
    }

    if (current) {
      // Continuation of either the question stem or the last option.
      if (current.options.length > 0) current.options[current.options.length - 1].text += ` ${trimmed}`;
      else current.textLines.push(trimmed);
    }
  }
  push();

  // Apply a trailing answer key to questions that had no inline/star marker.
  questions.forEach(q => {
    if (q.hasExplicitAnswer) return;
    const idx = answerKey.get(q.number);
    if (idx === undefined || idx < 0 || idx >= q.options.length) return;
    q.options.forEach((o, i) => { o.isCorrect = i === idx; });
    q.hasExplicitAnswer = true;
  });

  const warnings = [];
  const unanswered = questions.filter(q => !q.hasExplicitAnswer).length;
  if (unanswered > 0) {
    warnings.push(`${unanswered} ta savolda to'g'ri javob belgilanmagan — birinchi variant tanlandi, tekshirib chiqing.`);
  }

  return {
    questions: questions.map(({ number, hasExplicitAnswer, ...q }) => q),
    warnings,
  };
};

module.exports = { parseTestFromText };
