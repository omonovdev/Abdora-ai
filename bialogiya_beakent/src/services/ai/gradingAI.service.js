const { getModel } = require('../../config/gemini');
const { getGradingPrompt, getResultAnalysisPrompt, getTestInsightsPrompt } = require('./prompts');

const gradeHomework = async (homeworkTitle, description, studentAnswer, maxScore = 100) => {
  try {
    const prompt = `You are an expert teacher. Grade student work fairly and constructively. Always respond in valid JSON.\n\n${getGradingPrompt(homeworkTitle, description, studentAnswer, maxScore)}`;
    const model = getModel(true);
    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text());
  } catch (err) {
    console.error('Grading error:', err.message);
    return { score: 0, feedback: 'AI grading unavailable. Teacher will review manually.', suggestions: [] };
  }
};

const analyzeTestResults = async (testTitle, wrongQuestions, correctTopics, language = 'uz') => {
  try {
    const prompt = `You are an expert educational analyst. Always respond in valid JSON.\n\n${getResultAnalysisPrompt(testTitle, wrongQuestions, correctTopics, language)}`;
    const model = getModel(true);
    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text());
  } catch (err) {
    console.error('Analysis error:', err.message);
    return { weakTopics: [], strongTopics: correctTopics, studyRecommendations: ['Review all topics carefully'] };
  }
};

const analyzeTestForTeacher = async (testTitle, questionStats, classAverage, language = 'uz') => {
  try {
    const prompt = getTestInsightsPrompt(testTitle, questionStats, classAverage, language);
    const model = getModel(true);
    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text());
  } catch (err) {
    console.error('Test insights error:', err.message);
    return null;
  }
};

module.exports = { gradeHomework, analyzeTestResults, analyzeTestForTeacher };
