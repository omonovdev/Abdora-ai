import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, Upload, Brain, Sparkles, Lock, Trash2, Paperclip } from 'lucide-react';
import api from '../../config/axios';
import toast from 'react-hot-toast';
import { SUBJECTS, SUBJECT_LABELS, SUBJECT_ICONS } from '../../utils/subjects';

export default function CreateLesson() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: '', content: '', subject: 'other', groupId: '', order: 0 });
  const [files, setFiles] = useState([]);
  const [aiEnabled, setAiEnabled] = useState(true);

  const { data: groups } = useQuery({ queryKey: ['my-groups'], queryFn: () => api.get('/groups').then(r => r.data.data) });
  const { data: lesson, refetch: refetchLesson } = useQuery({
    queryKey: ['lesson', id],
    queryFn: () => api.get(`/lessons/${id}`).then(r => r.data.data),
    enabled: !!id,
  });

  useEffect(() => {
    if (lesson) {
      setForm(prev => {
        const next = {
          title: lesson.title || '',
          content: lesson.content || '',
          subject: lesson.subject || 'biology',
          groupId: lesson.groupId || '',
          order: lesson.order || 0,
        };
        return (prev.title === next.title && prev.content === next.content && prev.subject === next.subject && prev.groupId === next.groupId && prev.order === next.order) ? prev : next;
      });
      setAiEnabled(lesson.aiEnabled !== false);
    }
  }, [lesson]);

  const createMutation = useMutation({
    mutationFn: (fd) => api.post('/lessons', fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
    onSuccess: () => { toast.success('Lesson created! AI is generating content...'); navigate('/teacher/lessons'); },
    onError: (e) => toast.error(e.response?.data?.message || 'Error creating lesson'),
  });

  const updateMutation = useMutation({
    mutationFn: (payload) => api.put(`/lessons/${id}`, payload),
    onSuccess: () => { toast.success('Lesson updated successfully'); navigate('/teacher/lessons'); },
    onError: (e) => toast.error(e.response?.data?.message || 'Error updating lesson'),
  });

  const removeAttachment = useMutation({
    mutationFn: (attachmentId) => api.delete(`/lessons/${id}/attachments/${attachmentId}`),
    onSuccess: () => { toast.success('Fayl o\'chirildi'); refetchLesson(); },
    onError: (e) => toast.error(e.response?.data?.message || 'Xato'),
  });

  const handleSubmit = () => {
    if (!form.title || !form.groupId) return toast.error('Title and Group are required');

    const fd = new FormData();
    fd.append('title', form.title);
    fd.append('content', form.content);
    fd.append('subject', form.subject);
    fd.append('order', form.order);
    fd.append('groupId', form.groupId);
    fd.append('aiEnabled', String(aiEnabled));
    files.forEach(f => fd.append('files', f));

    if (id) updateMutation.mutate(fd);
    else createMutation.mutate(fd);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="btn-ghost p-2 rounded-xl"><ArrowLeft size={18} /></button>
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">{id ? 'Edit Lesson' : 'Create New Lesson'}</h1>
          <p className="text-sm text-gray-500">AI will automatically generate explanations, quizzes & more</p>
        </div>
      </div>

      {/* AI is additive only: it writes to its own tabs and never edits the
          teacher's lesson text or files. */}
      <div className={`rounded-2xl p-4 mb-5 flex items-start gap-3 transition-colors ${aiEnabled ? 'gradient-bg text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200'}`}>
        {aiEnabled ? <Brain size={24} className="flex-shrink-0 mt-0.5" /> : <Lock size={24} className="flex-shrink-0 mt-0.5 text-gray-400" />}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">
            {aiEnabled ? 'AI qo\'shimcha material tayyorlaydi' : 'AI o\'chirilgan'}
          </div>
          <div className={`text-xs mt-0.5 ${aiEnabled ? 'text-white/70' : 'text-gray-500'}`}>
            {aiEnabled
              ? 'Sodda tushuntirish, eslab qolish usullari, hikoya, test, kartochka va mind map — alohida bo\'limlarda qo\'shiladi.'
              : 'Faqat siz yozgan matn va yuklagan fayllar ko\'rsatiladi.'}
          </div>
          <div className={`text-xs mt-1.5 font-medium ${aiEnabled ? 'text-white/90' : 'text-gray-600 dark:text-gray-300'}`}>
            Sizning dars matningiz va fayllaringiz hech qachon o'zgartirilmaydi.
          </div>
        </div>
        <button type="button" onClick={() => setAiEnabled(v => !v)}
          className={`text-xs font-semibold px-3 py-1.5 rounded-lg flex-shrink-0 transition-colors ${aiEnabled ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600'}`}>
          {aiEnabled ? 'O\'chirish' : 'Yoqish'}
        </button>
      </div>

      <div className="card space-y-5">
        <div>
          <label className="block text-sm font-medium mb-1.5">Lesson Title *</label>
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="e.g. Protein Synthesis, Cell Division..." className="input-field" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Subject *</label>
            <select value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} className="input-field">
              {SUBJECTS.map(s => (
                <option key={s} value={s}>{SUBJECT_ICONS[s]} {SUBJECT_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Group *</label>
            <select value={form.groupId} onChange={e => setForm(f => ({ ...f, groupId: e.target.value }))} className="input-field">
              <option value="">Select group</option>
              {groups?.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Lesson Content</label>
          <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
            placeholder="Paste your lesson text here. The more detailed the content, the better the AI will explain it..."
            rows={8} className="input-field resize-none" />
          <p className="text-xs text-gray-400 mt-1">Tip: Paste your lesson text above — AI will learn from this content</p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Attachments (PDF, Images, etc.)</label>
          {lesson?.attachments?.length > 0 && (
            <div className="mb-2 space-y-1.5">
              {lesson.attachments.map((att) => (
                <div key={att.id} className="flex items-center gap-2 text-xs bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">
                  <Paperclip size={12} className="text-gray-400 flex-shrink-0" />
                  <span className="flex-1 truncate text-gray-700 dark:text-gray-200">{att.name}</span>
                  <button type="button" onClick={() => removeAttachment.mutate(att.id)} disabled={removeAttachment.isPending}
                    className="text-red-400 hover:text-red-500 disabled:opacity-40 flex-shrink-0"><Trash2 size={12} /></button>
                </div>
              ))}
            </div>
          )}
          <label className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all block">
            <Upload size={24} className="mx-auto mb-2 text-gray-400" />
            <span className="text-sm text-gray-500">Upload supplementary files</span>
            <input type="file" multiple className="hidden" onChange={e => setFiles(Array.from(e.target.files))} />
          </label>
          {id && <p className="text-xs text-gray-400 mt-1">Yangi fayllar qo'shiladi — eskilari o'chib ketmaydi.</p>}
          {files.length > 0 && (
            <div className="mt-2 space-y-1">
              {files.map((f, i) => <div key={i} className="text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-1.5">{f.name}</div>)}
            </div>
          )}
        </div>
        <button onClick={handleSubmit} disabled={id ? updateMutation.isPending : createMutation.isPending}
          className="btn-primary w-full flex items-center justify-center gap-2 py-3">
          {(id ? updateMutation.isPending : createMutation.isPending) ? (
            <><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity }} className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> {id ? 'Saving...' : 'Creating...'}</>
          ) : (
            <><Sparkles size={16} /> {id ? 'Save Lesson' : (aiEnabled ? 'Create Lesson & Generate AI Content' : 'Create Lesson')}</>
          )}
        </button>
      </div>
    </div>
  );
}
