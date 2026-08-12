import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Plus, Upload, FileText, Image, Video, Trash2, X, Download, ExternalLink, Loader2 } from 'lucide-react';
import api from '../../config/axios';
import toast from 'react-hot-toast';

const TYPE_ICONS = { pdf: FileText, image: Image, video: Video, other: FileText };
const TYPE_COLORS = { pdf: 'text-red-500 bg-red-50', image: 'text-blue-500 bg-blue-50', video: 'text-purple-500 bg-purple-50', other: 'text-gray-500 bg-gray-100' };

export default function TeacherResources() {
  const qc = useQueryClient();
  const [showUpload, setShowUpload] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', groupId: '' });
  const [file, setFile] = useState(null);

  const { data: groups } = useQuery({ queryKey: ['my-groups'], queryFn: () => api.get('/groups').then(r => r.data.data) });
  const { data: resources } = useQuery({ queryKey: ['resources'], queryFn: () => api.get('/resources').then(r => r.data.data) });

  const uploadMutation = useMutation({
    mutationFn: (fd) => api.post('/resources', fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
    onSuccess: () => { qc.invalidateQueries(['resources']); setShowUpload(false); toast.success('Resource uploaded!'); setFile(null); setForm({ title: '', description: '', groupId: '' }); },
    onError: (e) => toast.error(e.response?.data?.message || 'Error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/resources/${id}`),
    onSuccess: () => { qc.invalidateQueries(['resources']); toast.success('Deleted'); },
  });

  const downloadMutation = useMutation({
    mutationFn: async (r) => {
      const res = await api.post(`/resources/${r.id}/download`, null, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: r.mimeType || 'application/octet-stream' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = r.filePath || r.title;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    },
    onError: () => toast.error('Faylni yuklab bo\'lmadi'),
  });

  const [previewContext, setPreviewContext] = useState({ open: false, url: null, type: null, title: null, id: null });

  const previewMutation = useMutation({
    mutationFn: async (r) => {
      const res = await api.get(`/resources/${r.id}/preview`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: r.mimeType || 'application/octet-stream' }));
      return { id: r.id, url, type: getType(r), title: r.title, filename: r.filePath || r.title };
    },
    onSuccess: (data) => setPreviewContext({ open: true, ...data }),
    onError: () => toast.error('Faylni ochib bo\'lmadi'),
  });

  const closePreview = () => {
    if (previewContext.url) window.URL.revokeObjectURL(previewContext.url);
    setPreviewContext({ open: false, url: null, type: null, title: null, id: null });
  };

  const getType = (r) => {
    const mime = r.mimeType || '';
    if (mime === 'application/pdf') return 'pdf';
    if (mime.startsWith('image/')) return 'image';
    if (mime.startsWith('video/')) return 'video';
    if (mime.startsWith('audio/')) return 'audio';
    if (mime.startsWith('text/')) return 'text';
    const ext = (r.filePath || '').toLowerCase();
    if (ext.endsWith('.pdf')) return 'pdf';
    if (/\.(jpg|jpeg|png|gif|bmp|svg|webp)$/.test(ext)) return 'image';
    if (/\.(mp4|webm|ogg|mov)$/.test(ext)) return 'video';
    if (/\.(mp3|wav|m4a|aac)$/.test(ext)) return 'audio';
    if (/\.(txt|csv|md|json)$/.test(ext)) return 'text';
    return r.type || 'other';
  };

  const handleUpload = () => {
    if (!form.title || !file) return toast.error('Title and file required');
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => v && fd.append(k, v));
    fd.append('file', file);
    uploadMutation.mutate(fd);
  };

  const getResourceId = (r) => r.id;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Resources</h1>
        <button onClick={() => setShowUpload(true)} className="btn-primary flex items-center gap-2"><Plus size={15} /> Upload</button>
      </div>

      {showUpload && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setShowUpload(false)}>
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white dark:bg-gray-900 rounded-3xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">Upload Resource</h2>
              <button onClick={() => setShowUpload(false)} className="btn-ghost p-1.5 rounded-lg"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <div><label className="block text-sm font-medium mb-1.5">Title *</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="input-field" /></div>
              <div><label className="block text-sm font-medium mb-1.5">Group (optional)</label>
                <select value={form.groupId} onChange={e => setForm(f => ({ ...f, groupId: e.target.value }))} className="input-field">
                  <option value="">All groups</option>
                  {groups?.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select></div>
              <div><label className="block text-sm font-medium mb-1.5">File *</label>
                <label className="border-2 border-dashed border-gray-200 rounded-xl p-5 text-center cursor-pointer hover:border-primary/40 block">
                  <Upload size={20} className="mx-auto mb-1 text-gray-400" />
                  <span className="text-sm text-gray-400">{file ? file.name : 'Choose file to upload'}</span>
                  <input type="file" className="hidden" onChange={e => setFile(e.target.files[0])} />
                </label>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowUpload(false)} className="btn-ghost flex-1">Cancel</button>
              <button onClick={handleUpload} disabled={uploadMutation.isPending} className="btn-primary flex-1">
                {uploadMutation.isPending ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        {resources?.map((r, i) => {
          const type = getType(r);
          const resourceId = getResourceId(r);
          const Icon = TYPE_ICONS[type] || FileText;
          const isDownloading = downloadMutation.isPending && downloadMutation.variables?.id === resourceId;
          const isPreviewing = previewMutation.isPending && previewMutation.variables?.id === resourceId;
          return (
            <motion.div key={resourceId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="card flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${TYPE_COLORS[type]}`}>
                <Icon size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate">{r.title}</div>
                <div className="text-xs text-gray-400 mt-0.5">{r.group?.name || 'All groups'} • {r.downloads || 0} downloads</div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => previewMutation.mutate({ id: resourceId, mimeType: r.mimeType, type: r.type, filePath: r.filePath, title: r.title })} disabled={isPreviewing}
                  className="btn-ghost p-1.5 rounded-lg text-primary hover:bg-primary/10 disabled:opacity-50">
                  {isPreviewing ? <Loader2 size={13} className="animate-spin" /> : <ExternalLink size={13} />}
                </button>
                <button onClick={() => downloadMutation.mutate({ id: resourceId, mimeType: r.mimeType, type: r.type, filePath: r.filePath, title: r.title })} disabled={isDownloading}
                  className="btn-ghost p-1.5 rounded-lg text-primary hover:bg-primary/10 disabled:opacity-50">
                  {isDownloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                </button>
                <button onClick={() => { deleteMutation.mutate(resourceId); }}
                  className="btn-ghost p-1.5 rounded-lg text-red-400 hover:bg-red-50"><Trash2 size={13} /></button>
              </div>
            </motion.div>
          );
        })}
        {resources?.length === 0 && (
          <div className="col-span-2 text-center py-16 text-gray-400">
            <Upload size={36} className="mx-auto mb-3 opacity-30" />
            <p>No resources yet. Upload your first one!</p>
          </div>
        )}
      </div>

      {previewContext.open && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{previewContext.title}</h2>
                <p className="text-xs text-gray-500">{previewContext.type?.toUpperCase()}</p>
              </div>
              <button onClick={closePreview} className="btn-ghost p-2 rounded-full">Close</button>
            </div>
            <div className="p-4 overflow-auto h-[70vh] bg-gray-50 dark:bg-gray-950">
              {previewContext.type === 'image' && (
                <img src={previewContext.url} alt={previewContext.title} className="mx-auto max-h-[65vh] object-contain" />
              )}
              {previewContext.type === 'video' && (
                <video src={previewContext.url} controls className="w-full max-h-[65vh] bg-black" />
              )}
              {previewContext.type === 'audio' && (
                <audio src={previewContext.url} controls className="w-full mt-8" />
              )}
              {(previewContext.type === 'pdf' || previewContext.type === 'text') && (
                <iframe src={previewContext.url} title={previewContext.title} className="w-full h-[65vh] bg-white rounded-xl" />
              )}
              {!['image', 'video', 'audio', 'pdf', 'text'].includes(previewContext.type) && (
                <div className="text-center py-20 text-gray-500">
                  <p>Bu fayl turini brauzerda ochib bo'lmaydi. Yuklab oling.</p>
                  <button onClick={() => downloadMutation.mutate({ id: previewContext.id, mimeType: 'application/octet-stream', filePath: previewContext.filename, title: previewContext.title })}
                    className="btn-primary mt-5">Download file</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
