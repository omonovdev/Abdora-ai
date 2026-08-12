import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle, Bot, Clock } from 'lucide-react';
import api from '../../config/axios';
import toast from 'react-hot-toast';
import { getScoreColor, formatDateTime, formatDeadlineOffset } from '../../utils/format';

export default function GradeSubmissions() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [grades, setGrades] = useState({});

  const { data: hw } = useQuery({ queryKey: ['hw', id], queryFn: () => api.get(`/homework/${id}`).then(r => r.data.data) });
  const { data: submissions, isLoading } = useQuery({ queryKey: ['submissions', id], queryFn: () => api.get(`/homework/${id}/submissions`).then(r => r.data.data) });

  const gradeMutation = useMutation({
    mutationFn: ({ subId, score, comment }) => api.put(`/homework/submissions/${subId}/grade`, { score, feedback: comment }),
    onSuccess: () => { qc.invalidateQueries(['submissions', id]); toast.success('Grade saved!'); },
    onError: (e) => toast.error(e.response?.data?.message || 'Error'),
  });

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="btn-ghost p-2 rounded-xl"><ArrowLeft size={18} /></button>
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">Grade Submissions</h1>
          <p className="text-sm text-gray-500">{hw?.title}</p>
        </div>
      </div>

      {hw?.dueDate && (
        <p className="text-xs text-gray-400 mb-3 flex items-center gap-1.5">
          <Clock size={12} /> Topshirish muddati: {formatDateTime(hw.dueDate)}
        </p>
      )}

      <div className="space-y-4">
        {submissions?.map((sub, i) => {
          const submittedAt = sub.submittedAt || sub.createdAt;
          const offset = formatDeadlineOffset(submittedAt, sub.homework?.dueDate || hw?.dueDate);
          return (
          <motion.div key={sub.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="card">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 gradient-bg rounded-full flex items-center justify-center text-white font-semibold text-sm">
                {sub.student?.name?.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">{sub.student?.name}</div>
                <div className="text-xs text-gray-400">@{sub.student?.username}</div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-xs">
                  <span className="flex items-center gap-1 text-gray-500">
                    <Clock size={11} /> {formatDateTime(submittedAt)}
                  </span>
                  {offset && (
                    <span className={offset.late ? 'text-red-500' : 'text-green-600'}>{offset.label}</span>
                  )}
                  {sub.updatedAt && sub.submittedAt && new Date(sub.submittedAt) - new Date(sub.createdAt) > 60000 && (
                    <span className="text-gray-400">qayta yuborilgan</span>
                  )}
                </div>
              </div>
              {sub.finalScore !== undefined && (
                <div className={`badge font-bold ${getScoreColor(sub.finalScore)}`}>{sub.finalScore}/{hw?.maxScore}</div>
              )}
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 text-sm text-gray-700 dark:text-gray-300 mb-3">
              {sub.answerText || <span className="text-gray-400 italic">No text answer</span>}
            </div>

            {sub.aiGrade && (
              <div className="bg-secondary/5 border border-secondary/20 rounded-xl p-3 mb-3">
                <div className="flex items-center gap-1.5 text-xs text-secondary font-semibold mb-1.5"><Bot size={12} /> AI Grade: {sub.aiGrade.score}/{hw?.maxScore}</div>
                <p className="text-xs text-gray-600">{sub.aiGrade.feedback}</p>
              </div>
            )}

            {sub.status !== 'teacher_reviewed' ? (
              <div className="flex gap-3 mt-1">
                <div className="flex-1">
                  <input type="number" min={0} max={hw?.maxScore || 100}
                    placeholder={`Score (max ${hw?.maxScore})`}
                    value={grades[sub.id]?.score ?? (sub.aiGrade?.score || '')}
                    onChange={e => setGrades(g => ({ ...g, [sub.id]: { ...g[sub.id], score: +e.target.value } }))}
                    className="input-field" />
                </div>
                <div className="flex-1">
                  <input placeholder="Comment (optional)"
                    value={grades[sub.id]?.comment || ''}
                    onChange={e => setGrades(g => ({ ...g, [sub.id]: { ...g[sub.id], comment: e.target.value } }))}
                    className="input-field" />
                </div>
                <button onClick={() => gradeMutation.mutate({ subId: sub.id, score: grades[sub.id]?.score ?? sub.aiGrade?.score, comment: grades[sub.id]?.comment })}
                  className="btn-primary px-3 flex items-center gap-1.5">
                  <CheckCircle size={14} /> Save
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
                <CheckCircle size={13} /> Graded — {sub.teacherGrade?.score}/{hw?.maxScore}
                {sub.teacherGrade?.feedback && <span className="text-gray-400 font-normal">• {sub.teacherGrade.feedback}</span>}
              </div>
            )}
          </motion.div>
          );
        })}
        {!isLoading && submissions?.length === 0 && (
          <div className="text-center py-12 text-gray-400">No submissions yet</div>
        )}
      </div>
    </div>
  );
}
