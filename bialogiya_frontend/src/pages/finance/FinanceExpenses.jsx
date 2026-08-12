import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Receipt, Trash2, X, ArrowLeft, Pencil } from 'lucide-react';
import api from '../../config/axios';
import toast from 'react-hot-toast';
import { RowSkeleton } from '../../components/ui/Skeleton';
import ErrorState from '../../components/ui/ErrorState';
import EmptyState from '../../components/ui/EmptyState';
import {
  formatSum, formatMonth, EXPENSE_CATEGORIES, PAYMENT_METHODS, categoryLabel, methodLabel,
} from '../../utils/finance';

const today = () => new Date().toISOString().slice(0, 10);
const currentMonth = () => new Date().toISOString().slice(0, 7);

const monthOptions = () => Array.from({ length: 12 }, (_, i) => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - i, 1).toISOString().slice(0, 7);
});

const emptyForm = () => ({
  category: 'rent', title: '', amount: '', date: today(), method: 'cash', note: '',
});

export default function FinanceExpenses() {
  const qc = useQueryClient();
  const [month, setMonth] = useState(currentMonth);
  const [category, setCategory] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['expenses', month, category],
    queryFn: () => api.get(`/finance/expenses?month=${month}&category=${category}`).then(r => r.data.data),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['expenses'] });
    qc.invalidateQueries({ queryKey: ['finance-summary'] });
  };

  const saveMutation = useMutation({
    mutationFn: (payload) => (editingId
      ? api.put(`/finance/expenses/${editingId}`, payload)
      : api.post('/finance/expenses', payload)),
    onSuccess: () => {
      invalidate();
      toast.success(editingId ? 'Xarajat yangilandi' : 'Xarajat qo\'shildi');
      closeModal();
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Saqlab bo\'lmadi'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/finance/expenses/${id}`),
    onSuccess: () => { invalidate(); toast.success('O\'chirildi'); },
    onError: (e) => toast.error(e.response?.data?.message || 'O\'chirib bo\'lmadi'),
  });

  const openCreate = () => { setEditingId(null); setForm(emptyForm()); setModalOpen(true); };

  const openEdit = (expense) => {
    setEditingId(expense.id);
    setForm({
      category: expense.category,
      title: expense.title,
      amount: String(expense.amount),
      date: new Date(expense.date).toISOString().slice(0, 10),
      method: expense.method || 'cash',
      note: expense.note || '',
    });
    setModalOpen(true);
  };

  const closeModal = () => { setModalOpen(false); setEditingId(null); setForm(emptyForm()); };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error('Xarajat nomini kiriting');
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) return toast.error('Summani to\'g\'ri kiriting');
    saveMutation.mutate({ ...form, title: form.title.trim(), amount });
  };

  const expenses = data?.expenses || [];

  return (
    <main className="mx-auto max-w-3xl pb-10">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/finance" aria-label="Moliyaga qaytish"
            className="btn-ghost rounded-xl p-2 focus-visible:ring-2 focus-visible:ring-primary/40">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-800 dark:text-white">Xarajatlar</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              {isLoading ? '—' : `${formatMonth(month)} · jami ${formatSum(data?.total)}`}
            </p>
          </div>
        </div>
        <button type="button" onClick={openCreate}
          className="btn-primary flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-primary/40">
          <Plus size={15} /> Xarajat qo'shish
        </button>
      </header>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="flex-1">
          <label htmlFor="exp-month" className="sr-only">Oy</label>
          <select id="exp-month" value={month} onChange={e => setMonth(e.target.value)}
            className="input-field focus-visible:ring-2 focus-visible:ring-primary/40">
            {monthOptions().map(m => <option key={m} value={m}>{formatMonth(m)}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label htmlFor="exp-category" className="sr-only">Toifa</label>
          <select id="exp-category" value={category} onChange={e => setCategory(e.target.value)}
            className="input-field focus-visible:ring-2 focus-visible:ring-primary/40">
            <option value="all">Barcha toifalar</option>
            {EXPENSE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
      </div>

      {isError && <ErrorState error={error} onRetry={refetch} />}

      {isLoading && <div className="space-y-2"><RowSkeleton count={4} /></div>}

      {!isLoading && !isError && expenses.length === 0 && (
        <EmptyState icon={Receipt} title="Bu davrda xarajat yo'q"
          description="Ijara, kommunal, marketing kabi xarajatlarni kiriting — foyda hisobi shundan chiqadi."
          action={(
            <button type="button" onClick={openCreate}
              className="btn-primary mt-1 flex items-center gap-2 text-sm focus-visible:ring-2 focus-visible:ring-primary/40">
              <Plus size={14} /> Birinchi xarajatni qo'shish
            </button>
          )} />
      )}

      <ul className="space-y-2">
        {expenses.map((e, i) => (
          <motion.li key={e.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.2 }}
            className="card flex items-center gap-3">
            <span aria-hidden="true" className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400">
              <Receipt size={17} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-gray-800 dark:text-white">{e.title}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-gray-400">
                <span className="badge bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">{categoryLabel(e.category)}</span>
                <span>{new Date(e.date).toLocaleDateString('uz-UZ')}</span>
                <span>{methodLabel(e.method)}</span>
                {e.branch?.name && <span>{e.branch.name}</span>}
              </p>
              {e.note && <p className="mt-1 truncate text-xs text-gray-500">{e.note}</p>}
            </div>
            <p className="flex-shrink-0 text-sm font-bold tabular-nums text-gray-900 dark:text-white">{formatSum(e.amount)}</p>
            <div className="flex flex-shrink-0 items-center gap-1">
              <button type="button" onClick={() => openEdit(e)} aria-label={`${e.title} — tahrirlash`}
                className="btn-ghost rounded-lg p-1.5 text-gray-400 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/40">
                <Pencil size={14} />
              </button>
              <button type="button" onClick={() => deleteMutation.mutate(e.id)}
                disabled={deleteMutation.isPending} aria-label={`${e.title} — o'chirish`}
                className="btn-ghost rounded-lg p-1.5 text-red-400 hover:bg-red-50 disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-red-300 dark:hover:bg-red-500/10">
                <Trash2 size={14} />
              </button>
            </div>
          </motion.li>
        ))}
      </ul>

      <AnimatePresence>
        {modalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
            onClick={ev => ev.target === ev.currentTarget && closeModal()}
            onKeyDown={ev => ev.key === 'Escape' && closeModal()}>
            <motion.div initial={{ scale: 0.97, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.97, y: 12 }}
              transition={{ duration: 0.18 }}
              role="dialog" aria-modal="true" aria-labelledby="expense-modal-title"
              className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-gray-900">
              <div className="mb-4 flex items-center justify-between">
                <h2 id="expense-modal-title" className="text-lg font-bold text-gray-800 dark:text-white">
                  {editingId ? 'Xarajatni tahrirlash' : 'Yangi xarajat'}
                </h2>
                <button type="button" onClick={closeModal} aria-label="Yopish"
                  className="btn-ghost rounded-lg p-1.5 focus-visible:ring-2 focus-visible:ring-primary/40">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label htmlFor="f-title" className="mb-1.5 block text-sm font-medium">Nomi *</label>
                  <input id="f-title" autoFocus value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="Masalan: Avgust oyi ijarasi" className="input-field" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="f-category" className="mb-1.5 block text-sm font-medium">Toifa *</label>
                    <select id="f-category" value={form.category}
                      onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="input-field">
                      {EXPENSE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="f-amount" className="mb-1.5 block text-sm font-medium">Summa (so'm) *</label>
                    <input id="f-amount" type="number" min="1" inputMode="numeric" value={form.amount}
                      onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                      placeholder="2000000" className="input-field" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="f-date" className="mb-1.5 block text-sm font-medium">Sana</label>
                    <input id="f-date" type="date" value={form.date}
                      onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="input-field" />
                  </div>
                  <div>
                    <label htmlFor="f-method" className="mb-1.5 block text-sm font-medium">To'lov turi</label>
                    <select id="f-method" value={form.method}
                      onChange={e => setForm(f => ({ ...f, method: e.target.value }))} className="input-field">
                      {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="f-note" className="mb-1.5 block text-sm font-medium">Izoh</label>
                  <textarea id="f-note" rows={2} value={form.note}
                    onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                    placeholder="Ixtiyoriy" className="input-field resize-none" />
                </div>

                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={closeModal} className="btn-ghost flex-1">Bekor</button>
                  <button type="submit" disabled={saveMutation.isPending}
                    className="btn-primary flex-1 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-primary/40">
                    {saveMutation.isPending ? 'Saqlanmoqda...' : 'Saqlash'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
