import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Users2, ChevronRight, Clock, Calendar, DoorOpen, Building2, Pencil, Trash2 } from 'lucide-react';
import api from '../../config/axios';
import { friendlyAiErrorMessage } from '../../utils/aiErrors';
import ConfirmDialog from '../../components/ui/ConfirmDialog';

const DAYS = [
  { key: 'mon', label: 'Du' }, { key: 'tue', label: 'Se' }, { key: 'wed', label: 'Cho' },
  { key: 'thu', label: 'Pa' }, { key: 'fri', label: 'Ju' }, { key: 'sat', label: 'Sha' },
  { key: 'sun', label: 'Ya' },
];

const formatSchedule = (g) => {
  const parts = [];
  if (g.weekDays) {
    try {
      const days = Array.isArray(g.weekDays) ? g.weekDays : JSON.parse(g.weekDays);
      const labels = days.map(d => DAYS.find(x => x.key === d)?.label).filter(Boolean);
      if (labels.length) parts.push(labels.join(', '));
    } catch {}
  }
  if (g.startTime) parts.push(g.startTime + (g.endTime ? `–${g.endTime}` : ''));
  if (g.room) parts.push(g.room);
  return parts.join(' · ');
};

const EMPTY_FORM = { name: '', subject: 'other', teacherId: '', branchId: '', monthlyFee: '', weekDays: [], startTime: '', endTime: '', room: '', level: '', totalLessons: '' };

const groupToForm = (g) => ({
  name: g.name || '',
  subject: g.subject || 'other',
  teacherId: g.teacher?.id || g.teacherId || '',
  branchId: g.branch?.id || g.branchId || '',
  monthlyFee: g.monthlyFee ? String(g.monthlyFee) : '',
  weekDays: Array.isArray(g.weekDays)
    ? g.weekDays
    : (() => { try { return JSON.parse(g.weekDays || '[]'); } catch { return []; } })(),
  startTime: g.startTime || '',
  endTime: g.endTime || '',
  room: g.room || '',
  level: g.level || '',
  totalLessons: g.totalLessons ? String(g.totalLessons) : '',
});

export default function ReceptionGroups() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null); // null = create mode
  const [form, setForm] = useState(EMPTY_FORM);
  const [confirm, setConfirm] = useState(null);

  const { data: groups = [] } = useQuery({ 
    queryKey: ['reception-groups'], 
    queryFn: () => api.get('/reception/groups').then(r => {
      const data = r.data?.data || r.data || [];
      return Array.isArray(data) ? data : [];
    }) 
  });
  const { data: teachers = [] } = useQuery({ 
    queryKey: ['reception-teachers'], 
    queryFn: () => api.get('/admin/teachers').then(r => {
      const data = r.data?.data || r.data || [];
      return Array.isArray(data) ? data : [];
    }) 
  });
  const { data: branches = [] } = useQuery({ 
    queryKey: ['reception-branches'], 
    queryFn: () => api.get('/reception/branches').then(r => {
      const data = r.data?.data || r.data || [];
      return Array.isArray(data) ? data : [];
    }) 
  });

  const closeModal = () => { setShowModal(false); setEditingGroup(null); setForm(EMPTY_FORM); };

  const toPayload = (d) => ({
    ...d,
    monthlyFee: d.monthlyFee ? Number(d.monthlyFee) : null,
    totalLessons: d.totalLessons ? Number(d.totalLessons) : null,
    level: d.level?.trim() || null,
  });

  const createMutation = useMutation({
    mutationFn: (d) => api.post('/groups', toPayload(d)),
    onSuccess: () => { qc.invalidateQueries(['reception-groups']); closeModal(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/groups/${id}`, toPayload(data)),
    onSuccess: () => { qc.invalidateQueries(['reception-groups']); closeModal(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/groups/${id}`),
    onSuccess: () => qc.invalidateQueries(['reception-groups']),
  });

  const openCreate = () => { setEditingGroup(null); setForm(EMPTY_FORM); setShowModal(true); };
  const openEdit = (e, g) => { e.stopPropagation(); setEditingGroup(g); setForm(groupToForm(g)); setShowModal(true); };
  const handleDelete = (e, g) => {
    e.stopPropagation();
    setConfirm({
      title: `"${g.name}"ni o'chirish`,
      message: "Guruh yashiriladi, o'quvchilari boshqa guruhga o'tkazilmaguncha guruhsiz qoladi.",
      warning: g._count?.students > 0 ? `Bu guruhda ${g._count.students} ta o'quvchi bor.` : undefined,
      onConfirm: () => deleteMutation.mutate(g.id),
    });
  };

  const toggleDay = (day) => setForm(f => ({
    ...f, weekDays: f.weekDays.includes(day) ? f.weekDays.filter(d => d !== day) : [...f.weekDays, day],
  }));

  const submit = () => {
    if (editingGroup) updateMutation.mutate({ id: editingGroup.id, data: form });
    else createMutation.mutate(form);
  };

  const saving = createMutation.isPending || updateMutation.isPending;
  const saveError = createMutation.error || updateMutation.error;
  const canSubmit = form.name && form.teacherId && !saving;

  return (
    <div className="max-w-3xl mx-auto">
      <ConfirmDialog confirm={confirm} onClose={() => setConfirm(null)} />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Guruhlar</h1>
          <p className="text-sm text-gray-500 mt-0.5">Guruh yarating, jadval va xona belgilang</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus size={15} /> Guruh yaratish
        </button>
      </div>

      <div className="space-y-2">
        {groups?.map((g, i) => (
          <motion.div key={g.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
            onClick={() => navigate(`/reception/groups/${g.id}`)}
            className="card flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow">
            <div className="w-10 h-10 gradient-bg rounded-xl flex items-center justify-center text-white flex-shrink-0">
              <Users2 size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm text-gray-800 dark:text-white">{g.name}</div>
              <div className="text-xs text-gray-400 flex items-center gap-1.5 flex-wrap">
                <span>{g.teacher?.name || "O'qituvchi biriktirilmagan"}</span>
                <span>·</span>
                <span>{g._count?.students || 0} o'quvchi</span>
                {g.branch && <><span>·</span><span className="flex items-center gap-0.5"><Building2 size={10} />{g.branch.name}</span></>}
              </div>
              {formatSchedule(g) && (
                <div className="text-xs text-primary/80 mt-0.5 flex items-center gap-1">
                  <Calendar size={10} />
                  {formatSchedule(g)}
                </div>
              )}
              {g.progress?.percent !== null && g.progress?.percent !== undefined && (
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-1 flex-1 max-w-[140px] overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                    <div className={`h-full rounded-full ${
                      g.progress.percent >= 70 ? 'bg-red-500'
                        : g.progress.percent >= 40 ? 'bg-amber-400' : 'bg-green-500'}`}
                      style={{ width: `${g.progress.percent}%` }} />
                  </div>
                  <span className="text-xs text-gray-400">
                    {g.level ? `${g.level} · ` : ''}{g.progress.percent}% o'tildi
                  </span>
                </div>
              )}
            </div>
            {g.monthlyFee > 0 && (
              <span className="badge text-xs bg-primary/10 text-primary whitespace-nowrap">
                {new Intl.NumberFormat('uz-UZ').format(g.monthlyFee)} so'm/oy
              </span>
            )}
            <button onClick={(e) => openEdit(e, g)} className="btn-ghost p-2 rounded-lg flex-shrink-0" title="Tahrirlash">
              <Pencil size={14} />
            </button>
            <button onClick={(e) => handleDelete(e, g)} className="btn-ghost p-2 rounded-lg text-red-400 hover:bg-red-50 flex-shrink-0" title="O'chirish">
              <Trash2 size={14} />
            </button>
            <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
          </motion.div>
        ))}
        {groups?.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <Users2 size={36} className="mx-auto mb-3 opacity-30" />
            <p>Hali guruh yaratilmagan.</p>
          </div>
        )}
      </div>

      {/* Create / Edit modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto"
            onClick={e => e.target === e.currentTarget && closeModal()}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }}
              className="bg-white dark:bg-gray-900 rounded-3xl p-6 w-full max-w-md my-4">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-bold text-lg">{editingGroup ? "Guruhni tahrirlash" : "Guruh yaratish"}</h2>
                <button onClick={closeModal} className="btn-ghost p-1.5 rounded-lg"><X size={16} /></button>
              </div>
              <div className="space-y-4">

                {/* Name */}
                <div>
                  <label className="block text-sm font-medium mb-1.5">Guruh nomi *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Masalan: Biologiya-1A" className="input-field" />
                </div>

                {/* Teacher */}
                <div>
                  <label className="block text-sm font-medium mb-1.5">O'qituvchi *</label>
                  <select value={form.teacherId} onChange={e => setForm(f => ({ ...f, teacherId: e.target.value }))} className="input-field">
                    <option value="">Tanlang</option>
                    {teachers?.map(t => <option key={t.id} value={t.id}>{t.name}{t.branch ? ` (${t.branch.name})` : ''}</option>)}
                  </select>
                </div>

                {/* Branch */}
                {branches?.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium mb-1.5 flex items-center gap-1"><Building2 size={13} /> Markaz</label>
                    <select value={form.branchId} onChange={e => setForm(f => ({ ...f, branchId: e.target.value }))} className="input-field">
                      <option value="">Tanlanmagan</option>
                      {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                )}

                {/* Week days */}
                <div>
                  <label className="block text-sm font-medium mb-2 flex items-center gap-1"><Calendar size={13} /> Hafta kunlari</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {DAYS.map(d => (
                      <button key={d.key} type="button"
                        onClick={() => toggleDay(d.key)}
                        className={`w-10 h-10 rounded-xl text-sm font-medium transition-colors ${form.weekDays.includes(d.key) ? 'gradient-bg text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Time */}
                <div>
                  <label className="block text-sm font-medium mb-1.5 flex items-center gap-1"><Clock size={13} /> Dars vaqti</label>
                  <div className="flex items-center gap-2">
                    <input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                      className="input-field flex-1" />
                    <span className="text-gray-400 text-sm">—</span>
                    <input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                      className="input-field flex-1" />
                  </div>
                </div>

                {/* Room */}
                <div>
                  <label className="block text-sm font-medium mb-1.5 flex items-center gap-1"><DoorOpen size={13} /> Xona</label>
                  <input value={form.room} onChange={e => setForm(f => ({ ...f, room: e.target.value }))}
                    placeholder="Masalan: 3-xona, 2-qavat" className="input-field" />
                </div>

                {/* Monthly fee */}
                <div>
                  <label className="block text-sm font-medium mb-1.5">Oylik to'lov (so'm)</label>
                  <input value={form.monthlyFee} onChange={e => setForm(f => ({ ...f, monthlyFee: e.target.value.replace(/\D/g, '') }))}
                    placeholder="Masalan: 500000" inputMode="numeric" className="input-field" />
                </div>

                {/* Course length drives the "kurs qayerga yetdi" progress bar. */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Daraja</label>
                    <input value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value }))}
                      placeholder="Elementary" className="input-field" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Jami darslar</label>
                    <input value={form.totalLessons} onChange={e => setForm(f => ({ ...f, totalLessons: e.target.value.replace(/\D/g, '') }))}
                      placeholder="Masalan: 48" inputMode="numeric" className="input-field" />
                  </div>
                </div>

                <div className="flex gap-3 pt-1">
                  <button onClick={closeModal} className="btn-ghost flex-1">Bekor</button>
                  <button onClick={() => canSubmit && submit()}
                    disabled={!canSubmit}
                    className="btn-primary flex-1 disabled:opacity-40">
                    {saving ? 'Saqlanmoqda...' : editingGroup ? 'Saqlash' : 'Yaratish'}
                  </button>
                </div>
                {saveError && (
                  <p className="text-xs text-red-500 text-center">{friendlyAiErrorMessage(saveError)}</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
