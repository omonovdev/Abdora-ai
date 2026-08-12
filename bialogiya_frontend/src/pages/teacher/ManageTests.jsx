import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Plus, FileText, Clock, Trash2, BarChart2, Upload, X, Loader2, Sparkles, FileCheck, AlertTriangle } from 'lucide-react';
import api from '../../config/axios';
import toast from 'react-hot-toast';

const TYPE_COLORS = { topic: 'bg-blue-100 text-blue-700', weekly: 'bg-green-100 text-green-700', monthly: 'bg-purple-100 text-purple-700', mock: 'bg-orange-100 text-orange-700' };

export default function ManageTests() {
  const qc = useQueryClient();
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfGroupId, setPdfGroupId] = useState('');
  const [pdfTitle, setPdfTitle] = useState('');
  const [useAI, setUseAI] = useState(true);
  const fileRef = useRef();

  const { data: tests, isLoading } = useQuery({
    queryKey: ['my-tests'],
    queryFn: () => api.get('/tests').then(r => r.data.data),
    // AI generation finishes after the upload response, so keep polling while
    // any test is still being written.
    refetchInterval: (query) => (query.state.data?.some(t => t.aiStatus === 'generating') ? 3000 : false),
  });
  const { data: groups } = useQuery({ queryKey: ['my-groups'], queryFn: () => api.get('/groups').then(r => r.data.data) });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/tests/${id}`),
    onSuccess: () => { qc.invalidateQueries(['my-tests']); toast.success('Test o\'chirildi'); },
  });

  const pdfMutation = useMutation({
    mutationFn: (formData) => api.post('/lessons/generate-test-from-pdf', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
    onSuccess: (res) => {
      qc.invalidateQueries(['my-tests']);
      // 202 = row created, AI still writing the questions in the background.
      if (res.status === 202) {
        toast.success('✅ Yuklandi. AI savollarni tayyorlamoqda — ro\'yxatda kuzating.');
      } else {
        toast.success(`✅ ${res.data.message || 'Test yaratildi'}`);
        (res.data.data?.warnings || []).forEach(w => toast(w, { icon: '⚠️' }));
      }
      setShowPdfModal(false);
      setPdfFile(null);
      setPdfGroupId('');
      setPdfTitle('');
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Xato yuz berdi'),
  });

  const handlePdfSubmit = () => {
    if (!pdfFile || !pdfGroupId) return toast.error('Fayl va guruhni tanlang');
    const fd = new FormData();
    fd.append('pdf', pdfFile);
    fd.append('groupId', pdfGroupId);
    fd.append('useAI', String(useAI));
    if (pdfTitle) fd.append('title', pdfTitle);
    pdfMutation.mutate(fd);
  };

  const getFileIcon = (file) => {
    if (!file) return null;
    if (file.type === 'application/pdf') return '📄';
    if (file.type.startsWith('image/')) return '🖼️';
    if (file.type.includes('word')) return '📝';
    if (file.type === 'text/plain') return '📃';
    return '📎';
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Testlar</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowPdfModal(true)} className="btn-ghost flex items-center gap-2 text-sm border border-primary/30 text-primary hover:bg-primary/5">
            <Upload size={14} /> Fayldan yaratish
          </button>
          <Link to="/teacher/tests/create" className="btn-primary flex items-center gap-2"><Plus size={15} /> Test yaratish</Link>
        </div>
      </div>

      {/* PDF modal */}
      <AnimatePresence>
        {showPdfModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={e => e.target === e.currentTarget && setShowPdfModal(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white dark:bg-gray-900 rounded-3xl p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-bold text-lg">📄 Fayldan test yaratish</h2>
                <button onClick={() => setShowPdfModal(false)} className="btn-ghost p-1.5 rounded-lg"><X size={16} /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Guruh *</label>
                  <select value={pdfGroupId} onChange={e => setPdfGroupId(e.target.value)} className="input-field">
                    <option value="">Guruhni tanlang</option>
                    {groups?.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">AI aralashsinmi?</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setUseAI(true)}
                      className={`rounded-2xl border-2 p-3 text-left transition-all ${useAI ? 'border-primary bg-primary/5' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'}`}>
                      <div className="flex items-center gap-1.5 text-sm font-semibold">
                        <Sparkles size={13} className={useAI ? 'text-primary' : 'text-gray-400'} /> Ha, AI tuzsin
                      </div>
                      <div className="text-xs text-gray-400 mt-1">Fayldan o'qib, 15 ta yangi savol yaratadi</div>
                    </button>
                    <button type="button" onClick={() => setUseAI(false)}
                      className={`rounded-2xl border-2 p-3 text-left transition-all ${!useAI ? 'border-primary bg-primary/5' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'}`}>
                      <div className="flex items-center gap-1.5 text-sm font-semibold">
                        <FileCheck size={13} className={!useAI ? 'text-primary' : 'text-gray-400'} /> Yo'q, aralashmasin
                      </div>
                      <div className="text-xs text-gray-400 mt-1">Fayldagi savollar o'zgartirilmasdan olinadi</div>
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Test nomi (ixtiyoriy)</label>
                  <input value={pdfTitle} onChange={e => setPdfTitle(e.target.value)}
                    placeholder={useAI ? 'AI avtomatik nom beradi' : 'Masalan: Kimyo 1-dars'} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Fayl *</label>
                  <div
                    onClick={() => fileRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all
                      ${pdfFile ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-primary'}`}>
                    {pdfFile ? (
                      <div>
                        <div className="text-2xl mb-1">{getFileIcon(pdfFile)}</div>
                        <div className="text-sm font-medium text-primary">{pdfFile.name}</div>
                        <div className="text-xs text-gray-400">{(pdfFile.size / 1024 / 1024).toFixed(1)} MB</div>
                        <button onClick={e => { e.stopPropagation(); setPdfFile(null); }}
                          className="text-xs text-red-400 mt-1 hover:underline">O'chirish</button>
                      </div>
                    ) : (
                      <div>
                        <Upload size={24} className="mx-auto mb-2 text-gray-400" />
                        <div className="text-sm text-gray-500">Faylni yuklash uchun bosing yoki tashlang</div>
                        <div className="text-xs text-gray-400 mt-1">PDF, Word (.docx), TXT, Rasm (JPG, PNG)</div>
                      </div>
                    )}
                  </div>
                  <input ref={fileRef} type="file"
                    accept=".pdf,.docx,.doc,.txt,.jpg,.jpeg,.png,.webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,image/*"
                    className="hidden" onChange={e => setPdfFile(e.target.files?.[0] || null)} />
                </div>
                {useAI ? (
                  <p className="text-xs text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                    AI faylni o'qib, undagi ma'lumotlardan 15 ta test savoli yaratadi va guruhga tayinlaydi. Rasmlar uchun Gemini Vision ishlatiladi.
                    Yuklangandan keyin kutib turish shart emas — test ro'yxatida tayyor bo'lishini kuzatasiz.
                  </p>
                ) : (
                  <div className="text-xs text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-xl p-3 space-y-1.5">
                    <p className="text-gray-500 dark:text-gray-300 font-medium">Fayldagi savollar aynan o'zi olinadi. Format:</p>
                    <pre className="font-mono text-[11px] leading-relaxed text-gray-500 dark:text-gray-400 whitespace-pre-wrap">{`1. Savol matni?
A) birinchi variant
*B) to'g'ri variant
C) uchinchi variant
D) to'rtinchi variant`}</pre>
                    <p>To'g'ri javobni <span className="font-mono">*</span> bilan, yoki savol ostida <span className="font-mono">Javob: B</span> deb, yoki fayl oxirida <span className="font-mono">Javoblar: 1-B 2-A</span> ro'yxati bilan belgilashingiz mumkin.</p>
                  </div>
                )}
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowPdfModal(false)} className="btn-ghost flex-1">Bekor</button>
                <button onClick={handlePdfSubmit} disabled={!pdfFile || !pdfGroupId || pdfMutation.isPending}
                  className="btn-primary flex-1 disabled:opacity-40 flex items-center justify-center gap-2">
                  {pdfMutation.isPending
                    ? (<><Loader2 size={14} className="animate-spin" /> Yuklanmoqda...</>)
                    : (useAI ? 'Test yaratish' : 'Savollarni olish')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="space-y-3">
        {tests?.map((t, i) => (
          <motion.div key={t.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
            className="card flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
              {t.aiStatus === 'generating'
                ? <Loader2 size={18} className="text-primary animate-spin" />
                : <FileText size={18} className="text-primary" />}
            </div>
            <div className="flex-1">
              <div className="font-semibold text-gray-800 dark:text-white">{t.title}</div>
              <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-gray-400">
                <span className={`badge ${TYPE_COLORS[t.type] || 'bg-gray-100 text-gray-600'}`}>{t.type}</span>
                <span>{t.group?.name}</span>
                <span className="flex items-center gap-1"><Clock size={11} /> {t.timeLimit} min</span>
                {t.aiStatus === 'generating' ? (
                  <span className="badge bg-blue-100 text-blue-700">AI yozmoqda...</span>
                ) : t.aiStatus === 'error' ? (
                  <span className="badge bg-red-100 text-red-600 flex items-center gap-1" title={t.aiError || ''}>
                    <AlertTriangle size={10} /> AI xato
                  </span>
                ) : (
                  <span>{t._count?.questions || 0} questions</span>
                )}
                {t.source === 'file_import' && <span className="badge bg-gray-100 text-gray-600">fayldan</span>}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Link to={`/teacher/tests/${t.id}/results`} className="btn-ghost p-1.5 rounded-lg text-secondary"><BarChart2 size={15} /></Link>
              <button onClick={() => { deleteMutation.mutate(t.id); }}
                className="btn-ghost p-1.5 rounded-lg text-red-400 hover:bg-red-50"><Trash2 size={14} /></button>
            </div>
          </motion.div>
        ))}
        {!isLoading && tests?.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <FileText size={36} className="mx-auto mb-3 opacity-30" />
            <p>No tests yet. <Link to="/teacher/tests/create" className="text-primary hover:underline">Create the first test</Link></p>
          </div>
        )}
      </div>
    </div>
  );
}
