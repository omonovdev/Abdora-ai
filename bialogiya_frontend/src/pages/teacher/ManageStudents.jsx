import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, X, GraduationCap, Phone, Users, Star, Zap, Pencil, Trash2, Save, ChevronRight, Search } from 'lucide-react';
import api from '../../config/axios';
import toast from 'react-hot-toast';

export default function ManageStudents() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', groupId: '', phone: '', language: 'uz' });
  const [newCreds, setNewCreds] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [editingStudent, setEditingStudent] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('');

  const { data: students } = useQuery({
    queryKey: ['my-students'],
    queryFn: () => api.get('/users/my-students').then(r => r.data.data),
  });
  const { data: groups } = useQuery({
    queryKey: ['my-groups'],
    queryFn: () => api.get('/groups').then(r => r.data.data),
  });

  const createMutation = useMutation({
    mutationFn: (d) => api.post('/users/create-student', d),
    onSuccess: ({ data }) => {
      qc.invalidateQueries(['my-students']);
      setNewCreds(data.data.credentials);
      setForm({ name: '', groupId: '', phone: '', language: 'uz' });
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Xato'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/users/${id}`, data),
    onSuccess: ({ data }) => {
      qc.invalidateQueries(['my-students']);
      toast.success('O\'quvchi yangilandi');
      setEditingStudent(null);
      if (selectedStudent?.id === data.data.id) setSelectedStudent(data.data);
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Xato'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/users/${id}`),
    onSuccess: () => {
      qc.invalidateQueries(['my-students']);
      toast.success('O\'quvchi o\'chirildi');
      setSelectedStudent(null);
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Xato'),
  });

  const copy = (text) => { navigator.clipboard.writeText(text); toast.success('Nusxalandi!'); };

  const query = search.trim().toLowerCase();
  const filteredStudents = (students || []).filter(s => {
    if (groupFilter && s.group?.id !== groupFilter) return false;
    if (!query) return true;
    return [s.name, s.username, s.phone, s.group?.name]
      .some(field => String(field || '').toLowerCase().includes(query));
  });

  const openEdit = (s, e) => {
    e.stopPropagation();
    setEditingStudent(s.id);
    setEditForm({ name: s.name, phone: s.phone || '', groupId: s.group?.id || '' });
  };

  const handleUpdate = () => {
    if (!editForm.name) return toast.error('Ism kiritilmagan');
    updateMutation.mutate({ id: editingStudent, data: editForm });
  };

  const handleDelete = (s, e) => {
    e.stopPropagation();
    {  // removed confirm
      deleteMutation.mutate(s.id);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">O'quvchilar</h1>
        <span className="text-sm text-gray-400">{filteredStudents.length} ta</span>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Ism, login, telefon yoki guruh bo'yicha qidiring..."
            className="input-field pl-9 pr-9" />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={14} /></button>
          )}
        </div>
        <select value={groupFilter} onChange={e => setGroupFilter(e.target.value)} className="input-field sm:w-52">
          <option value="">Barcha guruhlar</option>
          {groups?.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>

      {/* Student list */}
      <div className="space-y-2">
        {filteredStudents.map((s, i) => {
          const isEditing = editingStudent === s.id;
          return (
            <motion.div key={s.id}
              initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className="card">
              {isEditing ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-primary">Tahrirlash</span>
                    <button onClick={() => setEditingStudent(null)} className="btn-ghost p-1.5 rounded-lg"><X size={14} /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1 text-gray-500">Ismi *</label>
                      <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                        className="input-field text-sm" placeholder="To'liq ismi" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1 text-gray-500">Telefon</label>
                      <input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                        className="input-field text-sm" placeholder="+998 90 123 45 67" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1 text-gray-500">Guruh</label>
                    <select value={editForm.groupId} onChange={e => setEditForm(f => ({ ...f, groupId: e.target.value }))} className="input-field text-sm">
                      <option value="">Guruhni tanlang</option>
                      {groups?.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setEditingStudent(null)} className="btn-ghost flex-1 text-sm">Bekor</button>
                    <button onClick={handleUpdate} disabled={updateMutation.isPending}
                      className="btn-primary flex-1 text-sm flex items-center justify-center gap-1.5 disabled:opacity-40">
                      <Save size={13} />
                      {updateMutation.isPending ? 'Saqlanmoqda...' : 'Saqlash'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 cursor-pointer group"
                  onClick={() => setSelectedStudent(s)}>
                  <div className="w-10 h-10 gradient-bg rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                    {s.name?.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-gray-800 dark:text-white group-hover:text-primary transition-colors">
                      {s.name}
                    </div>
                    <div className="text-xs text-gray-400 flex items-center gap-2 flex-wrap">
                      <span>@{s.username}</span>
                      {s.group?.name && (
                        <span className="flex items-center gap-0.5">
                          <Users size={10} /> {s.group.name}
                        </span>
                      )}
                      {s.phone && (
                        <span className="flex items-center gap-0.5">
                          <Phone size={10} /> {s.phone}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="badge bg-primary/10 text-primary text-xs">Lv.{s.level}</span>
                    <span className="text-xs text-gray-400">{s.xp} XP</span>
                    <button onClick={(e) => openEdit(s, e)}
                      className="btn-ghost p-1.5 rounded-lg text-primary hover:bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity" title="Tahrirlash">
                      <Pencil size={13} />
                    </button>
                    <button onClick={(e) => handleDelete(s, e)}
                      className="btn-ghost p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-opacity" title="O'chirish">
                      <Trash2 size={13} />
                    </button>
                    <ChevronRight size={14} className="text-gray-300 group-hover:text-primary transition-colors" />
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
        {filteredStudents.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <GraduationCap size={36} className="mx-auto mb-3 opacity-30" />
            {students?.length > 0
              ? <p>Qidiruv bo'yicha o'quvchi topilmadi.</p>
              : <p>Hali o'quvchilar yo'q. Birinchi o'quvchini qo'shing!</p>}
          </div>
        )}
      </div>

      {/* Student detail modal */}
      <AnimatePresence>
        {selectedStudent && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={e => e.target === e.currentTarget && setSelectedStudent(null)}>
            <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
              className="bg-white dark:bg-gray-900 rounded-3xl p-6 w-full max-w-sm shadow-xl">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-bold text-lg text-gray-800 dark:text-white">O'quvchi ma'lumoti</h2>
                <div className="flex items-center gap-1">
                  <button onClick={() => { setEditingStudent(selectedStudent.id); setEditForm({ name: selectedStudent.name, phone: selectedStudent.phone || '', groupId: selectedStudent.group?.id || '' }); setSelectedStudent(null); }}
                    className="btn-ghost p-1.5 rounded-lg text-primary" title="Tahrirlash">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => { deleteMutation.mutate(selectedStudent.id); }}
                    className="btn-ghost p-1.5 rounded-lg text-red-400 hover:bg-red-50" title="O'chirish">
                    <Trash2 size={15} />
                  </button>
                  <button onClick={() => setSelectedStudent(null)} className="btn-ghost p-1.5 rounded-lg ml-1">
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Avatar & name */}
              <div className="flex flex-col items-center mb-5">
                <div className="w-16 h-16 gradient-bg rounded-2xl flex items-center justify-center text-white text-2xl font-bold mb-3">
                  {selectedStudent.name?.charAt(0)}
                </div>
                <h3 className="text-xl font-bold text-gray-800 dark:text-white">{selectedStudent.name}</h3>
                <span className="text-sm text-gray-400 mt-0.5">@{selectedStudent.username}</span>
                {selectedStudent.isFrozen && (
                  <span className="mt-2 badge bg-blue-100 text-blue-600 text-xs">❄️ Muzlatilgan</span>
                )}
              </div>

              {/* Info cards */}
              <div className="space-y-3 mb-5">
                <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800 rounded-2xl p-3">
                  <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Phone size={16} className="text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-gray-400">Telefon raqami</div>
                    <div className="font-semibold text-sm text-gray-800 dark:text-white">
                      {selectedStudent.phone || '—'}
                    </div>
                  </div>
                  {selectedStudent.phone && (
                    <button onClick={() => copy(selectedStudent.phone)} className="btn-ghost p-1.5 rounded-lg">
                      <Copy size={13} />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800 rounded-2xl p-3">
                  <div className="w-9 h-9 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Users size={16} className="text-green-600" />
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">Guruh</div>
                    <div className="font-semibold text-sm text-gray-800 dark:text-white">
                      {selectedStudent.group?.name || 'Guruhsiz'}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Star size={13} className="text-yellow-500" />
                      <span className="text-xs text-gray-400">Daraja</span>
                    </div>
                    <div className="font-bold text-primary text-lg">Level {selectedStudent.level}</div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Zap size={13} className="text-purple-500" />
                      <span className="text-xs text-gray-400">XP</span>
                    </div>
                    <div className="font-bold text-purple-600 text-lg">{selectedStudent.xp}</div>
                  </div>
                </div>
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create student modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }}
              className="bg-white dark:bg-gray-900 rounded-3xl p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-lg">O'quvchi qo'shish</h2>
                <button onClick={() => { setShowCreate(false); setNewCreds(null); }} className="btn-ghost p-1.5 rounded-lg">
                  <X size={16} />
                </button>
              </div>

              {newCreds ? (
                <div>
                  <div className="text-center mb-4">
                    <div className="text-4xl mb-2">🎉</div>
                    <h3 className="font-bold text-green-600">O'quvchi qo'shildi!</h3>
                    <p className="text-sm text-gray-500 mt-1">Bu ma'lumotlarni o'quvchiga bering</p>
                  </div>
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div><div className="text-xs text-gray-500">Login</div><div className="font-mono font-bold">{newCreds.username}</div></div>
                      <button onClick={() => copy(newCreds.username)} className="btn-ghost p-1.5 rounded-lg"><Copy size={14} /></button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div><div className="text-xs text-gray-500">Parol</div><div className="font-mono font-bold">{newCreds.password}</div></div>
                      <button onClick={() => copy(newCreds.password)} className="btn-ghost p-1.5 rounded-lg"><Copy size={14} /></button>
                    </div>
                  </div>
                  <button onClick={() => setNewCreds(null)} className="btn-primary w-full mt-4">Yana qo'shish</button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">To'liq ismi *</label>
                    <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="O'quvchi ismi" className="input-field" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Guruh *</label>
                    <select value={form.groupId} onChange={e => setForm(f => ({ ...f, groupId: e.target.value }))} className="input-field">
                      <option value="">Guruhni tanlang</option>
                      {groups?.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Telefon raqami</label>
                    <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                      placeholder="+998 90 123 45 67" type="tel" className="input-field" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Til</label>
                    <select value={form.language} onChange={e => setForm(f => ({ ...f, language: e.target.value }))} className="input-field">
                      <option value="uz">O'zbek</option>
                      <option value="ru">Русский</option>
                      <option value="en">English</option>
                    </select>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setShowCreate(false)} className="btn-ghost flex-1">Bekor</button>
                    <button
                      onClick={() => form.name && form.groupId && createMutation.mutate(form)}
                      disabled={!form.name || !form.groupId || createMutation.isPending}
                      className="btn-primary flex-1 disabled:opacity-40">
                      {createMutation.isPending ? 'Qo\'shilmoqda...' : 'Qo\'shish'}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
