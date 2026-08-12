import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, BarChart2, AlertTriangle, Sparkles, Target, Lightbulb, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import api from '../../config/axios';
import { getScoreColor } from '../../utils/format';

export default function TestResultsPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: test = {} } = useQuery({ 
    queryKey: ['test', id], 
    queryFn: () => api.get(`/tests/${id}`).then(r => {
      const data = r.data?.data || r.data || {};
      return typeof data === 'object' ? data : {};
    }) 
  });
  const { data: results = [], isLoading } = useQuery({ 
    queryKey: ['test-results', id], 
    queryFn: () => api.get(`/tests/${id}/results`).then(r => {
      const data = r.data?.data || r.data || [];
      return Array.isArray(data) ? data : [];
    }) 
  });

  const { data: analysis, isLoading: analysisLoading } = useQuery({
    queryKey: ['test-analysis', id],
    queryFn: () => api.get(`/tests/${id}/analysis`).then(r => r.data?.data || null),
  });

  const hardestQuestions = (analysis?.questions || []).filter(q => q.wrong > 0);
  const insights = analysis?.insights;

  const chartData = Array.isArray(results) ? results.map(r => ({ name: r.student?.name?.split(' ')[0], score: r.percentage })) : [];
  const avgScore = Array.isArray(results) && results.length ? Math.round(results.reduce((s, r) => s + r.percentage, 0) / results.length) : 0;
  const passed = Array.isArray(results) ? results.filter(r => r.passed).length : 0;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="btn-ghost p-2 rounded-xl"><ArrowLeft size={18} /></button>
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">{test?.title}</h1>
          <p className="text-sm text-gray-500">Test Results Analysis</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Participants', value: results?.length || 0, color: 'text-gray-800' },
          { label: 'Average Score', value: `${avgScore}%`, color: avgScore >= 70 ? 'text-green-600' : 'text-red-500' },
          { label: 'Passed', value: `${passed}/${results?.length || 0}`, color: 'text-primary' },
        ].map((s, i) => (
          <div key={i} className="card text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-400 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {chartData.length > 0 && (
        <div className="card mb-6">
          <h3 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2"><BarChart2 size={16} className="text-primary" /> Score Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
              <Tooltip contentStyle={{ borderRadius: '12px' }} />
              <Bar dataKey="score" radius={[6, 6, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.score >= 70 ? '#00BFA6' : entry.score >= 50 ? '#FCD34D' : '#EF4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {results.length > 0 && (
        <div className="card mb-6">
          <h3 className="font-bold text-gray-800 dark:text-white mb-1 flex items-center gap-2">
            <Target size={16} className="text-red-500" /> Eng ko'p xato qilingan savollar
          </h3>
          <p className="text-xs text-gray-400 mb-4">Qaysi savol qiyin bo'lganini ko'rib, keyingi darsni shunga qarab tuzing</p>

          {analysisLoading && (
            <div className="flex items-center gap-2 text-sm text-gray-400 py-6 justify-center">
              <Loader2 size={14} className="animate-spin" /> Tahlil qilinmoqda...
            </div>
          )}

          {!analysisLoading && hardestQuestions.length === 0 && (
            <p className="text-sm text-gray-400 py-4 text-center">Hamma savolga to'g'ri javob berilgan 🎉</p>
          )}

          <div className="space-y-3">
            {hardestQuestions.slice(0, 10).map((q, i) => (
              <motion.div key={q.questionId} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                className="border border-gray-100 dark:border-gray-800 rounded-2xl p-3">
                <div className="flex items-start gap-3">
                  <span className="text-xs font-bold text-gray-400 mt-0.5 flex-shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 dark:text-gray-100">{q.text}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs">
                      <span className="text-green-600">To'g'ri: {q.correctAnswer || '—'}</span>
                      {q.topWrongAnswer && <span className="text-red-500">Ko'p tanlangan xato: {q.topWrongAnswer}</span>}
                      <span className="text-gray-400">{q.wrong}/{q.attempts} xato</span>
                    </div>
                    <div className="mt-2 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${q.errorRate >= 70 ? 'bg-red-500' : q.errorRate >= 40 ? 'bg-amber-400' : 'bg-green-500'}`}
                        style={{ width: `${q.errorRate}%` }} />
                    </div>
                  </div>
                  <span className={`badge text-xs flex-shrink-0 ${q.errorRate >= 70 ? 'bg-red-100 text-red-600' : q.errorRate >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                    {q.errorRate}%
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {insights && (
        <div className="card mb-6 border-primary/20">
          <h3 className="font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
            <Sparkles size={16} className="text-primary" /> AI tavsiyasi
          </h3>

          {insights.headline && (
            <p className="text-sm font-medium text-gray-800 dark:text-gray-100 bg-primary/5 rounded-2xl p-3 mb-4">{insights.headline}</p>
          )}

          {insights.weakTopics?.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-semibold text-gray-500 mb-1.5">Zaif mavzular</div>
              <div className="flex flex-wrap gap-1.5">
                {insights.weakTopics.map((t, i) => (
                  <span key={i} className="badge text-xs bg-amber-100 text-amber-700">{t}</span>
                ))}
              </div>
            </div>
          )}

          {insights.misconceptions?.length > 0 && (
            <div className="mb-4 space-y-2">
              <div className="text-xs font-semibold text-gray-500">Qayerda chalkashgan</div>
              {insights.misconceptions.map((m, i) => (
                <div key={i} className="border-l-2 border-amber-300 pl-3 py-0.5">
                  <div className="text-xs text-gray-400">{m.question}</div>
                  <div className="text-sm text-gray-700 dark:text-gray-200">{m.misconception}</div>
                  {m.fix && <div className="text-xs text-primary mt-0.5">→ {m.fix}</div>}
                </div>
              ))}
            </div>
          )}

          {insights.reteachPlan?.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-semibold text-gray-500 mb-1.5 flex items-center gap-1"><Lightbulb size={12} /> Keyingi darsda</div>
              <ul className="space-y-1">
                {insights.reteachPlan.map((a, i) => (
                  <li key={i} className="text-sm text-gray-700 dark:text-gray-200 flex gap-2">
                    <span className="text-primary">•</span>{a}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {insights.questionQualityFlags?.length > 0 && (
            <div className="text-xs text-gray-500 bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
              <div className="font-semibold mb-1 flex items-center gap-1"><AlertTriangle size={11} /> Savol sifati haqida</div>
              {insights.questionQualityFlags.map((f, i) => <div key={i}>{f}</div>)}
            </div>
          )}
        </div>
      )}

      <div className="space-y-3">
        {results?.map((r, i) => (
          <motion.div key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
            className="card flex items-center gap-3">
            <div className="w-9 h-9 gradient-bg rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
              {r.student?.name?.charAt(0)}
            </div>
            <div className="flex-1">
              <div className="font-semibold text-sm">{r.student?.name}</div>
              {r.aiAnalysis?.weakTopics?.length > 0 && (
                <div className="flex items-center gap-1 text-xs text-amber-600 mt-0.5">
                  <AlertTriangle size={11} /> Weak: {r.aiAnalysis.weakTopics.slice(0, 2).join(', ')}
                </div>
              )}
            </div>
            <div className="text-right">
              <div className={`font-bold text-sm ${getScoreColor(r.percentage)}`}>{r.percentage}%</div>
              <div className="text-xs text-gray-400">{r.score} pts</div>
            </div>
            <span className={`badge text-xs ${r.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
              {r.passed ? 'Pass' : 'Fail'}
            </span>
          </motion.div>
        ))}
        {!isLoading && results?.length === 0 && (
          <div className="text-center py-12 text-gray-400">No results yet — no students have taken this test</div>
        )}
      </div>
    </div>
  );
}
