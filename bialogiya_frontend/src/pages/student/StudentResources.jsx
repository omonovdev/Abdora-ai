import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { FolderOpen, Download, ExternalLink, FileText, Image, Video, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import api from '../../config/axios';
import toast from 'react-hot-toast';

const TYPE_ICONS = { pdf: FileText, image: Image, video: Video, ppt: FileText, word: FileText, link: ExternalLink, other: FileText };
const TYPE_COLORS = { pdf: 'text-red-500 bg-red-50', image: 'text-blue-500 bg-blue-50', video: 'text-purple-500 bg-purple-50', ppt: 'text-orange-500 bg-orange-50', link: 'text-green-500 bg-green-50', other: 'text-gray-500 bg-gray-50' };

export default function StudentResources() {
  const { user } = useAuthStore();
  const { data: resources } = useQuery({
    queryKey: ['resources', user?.groupId],
    queryFn: () => api.get(`/resources?groupId=${user?.groupId}`).then(r => r.data.data),
    enabled: !!user?.groupId,
  });

  const [previewContext, setPreviewContext] = useState({ open: false, url: null, type: null, title: null });

  const getResourceId = (r) => r.id;

  const downloadMutation = useMutation({
    mutationFn: async (r) => {
      const resourceId = r.id;
      const res = await api.post(`/resources/${resourceId}/download`, null, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
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

  const previewMutation = useMutation({
    mutationFn: async (r) => {
      const resourceId = r.id;
      const res = await api.get(`/resources/${resourceId}/preview`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: r.mimeType || 'application/octet-stream' }));
      return { id: resourceId, url, type: getPreviewType(r), title: r.title, filename: r.filePath || r.title };
    },
    onSuccess: (data) => setPreviewContext({ open: true, ...data }),
    onError: () => toast.error('Faylni ochib bo\'lmadi'),
  });

  const getPreviewType = (r) => {
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

  const closePreview = () => {
    if (previewContext.url) window.URL.revokeObjectURL(previewContext.url);
    setPreviewContext({ open: false, url: null, type: null, title: null });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">Resources</h1>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {resources?.map((r, i) => {
          const resourceId = getResourceId(r);
          const Icon = TYPE_ICONS[r.type] || FileText;
          const color = TYPE_COLORS[r.type] || TYPE_COLORS.other;
          const isDownloading = downloadMutation.isPending && downloadMutation.variables?.id === resourceId;
          const isPreviewing = previewMutation.isPending && previewMutation.variables?.id === resourceId;
          return (
            <motion.div key={resourceId} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.04 }}
              className="card hover:shadow-glow hover:border-primary/20 transition-all">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}>
                <Icon size={18} />
              </div>
              <h3 className="font-semibold text-sm text-gray-800 dark:text-white mb-1 line-clamp-2">{r.title}</h3>
              {r.description && <p className="text-xs text-gray-500 mb-3 line-clamp-2">{r.description}</p>}
              <div className="flex flex-col gap-2">
                <span className="badge text-xs bg-gray-100 text-gray-600">{(r.type || 'file').toUpperCase()}</span>
                <div className="flex items-center justify-between gap-2">
                  <button onClick={() => previewMutation.mutate({ _id: resourceId, id: resourceId, mimeType: r.mimeType, type: r.type, filePath: r.filePath, title: r.title })} disabled={isPreviewing}
                    className="btn-ghost text-xs py-1 px-2 flex items-center gap-1 text-primary disabled:opacity-50">
                    {isPreviewing ? <Loader2 size={12} className="animate-spin" /> : <ExternalLink size={12} />} View
                  </button>
                  <button onClick={() => downloadMutation.mutate({ _id: resourceId, id: resourceId, filePath: r.filePath, title: r.title })} disabled={isDownloading}
                    className="btn-ghost text-xs py-1 px-2 flex items-center gap-1 text-primary disabled:opacity-50">
                    {isDownloading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} Get
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
        {resources?.length === 0 && (
          <div className="col-span-3 text-center py-16 text-gray-400">
            <FolderOpen size={36} className="mx-auto mb-3 opacity-30" />
            <p>No resources available</p>
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
                  <button onClick={() => downloadMutation.mutate({ _id: getResourceId(resources.find((item) => getResourceId(item) === previewContext.id)), id: previewContext.id, filePath: previewContext.filename, title: previewContext.title })}
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
