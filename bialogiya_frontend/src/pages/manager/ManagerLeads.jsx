import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, X, Phone, UserPlus, Snowflake, Archive, TrendingUp, Trash2,
} from 'lucide-react';
import api from '../../config/axios';
import toast from 'react-hot-toast';
import { RowSkeleton, Skeleton } from '../../components/ui/Skeleton';
import ErrorState from '../../components/ui/ErrorState';
import EmptyState from '../../components/ui/EmptyState';

const STATUSES = [
  { value: 'new', label: 'Yangi', tone: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' },
  { value: 'contacted', label: "Bog'lanildi", tone: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400' },
  { value: 'trial', label: 'Sinov darsi', tone: 'bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400' },
  { value: 'enrolled', label: "O'qishga kirdi", tone: 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400' },
  { value: 'frozen', label: 'Muzlatilgan', tone: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400' },
  { value: 'archived', label: 'Arxiv', tone: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
  { value: 'lost', label: 'Chiqib ketdi', tone: 'bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400' },
];

const SOURCES = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'referral', label: 'Tanish orqali' },
  { value: 'walkin', label: "O'zi keldi" },
  { value: 'landing', label: 'Sayt' },
  { value: 'other', label: 'Boshqa' },
];

const statusMeta = (value) => STATUSES.find(s => s.value === value) || STATUSES[0];
const sourceLabel = (value) => SOURCES.find(s => s.value === value)?.label || value;

const TABS = [
  { key: 'all', label: 'Hammasi' },
  { key: 'new', label: 'Yangi' },
  { key: 'contacted', label: "Bog'lanildi" },
  { key: 'trial', label: 'Sinov' },
  { key: 'enrolled', label: 'Kirdi' },
  { key: 'frozen', label: 'Muzlatilgan' },
  { key: 'archived', label: 'Arxiv' },
  { key: 'lost', label: 'Chiqib ketgan' },
];

const emptyForm = () => ({ name: '', phone: '', source: 'instagram', interestedIn: '', note: '' });

export default function ManagerLeads() {
  const qc = useQueryClient();
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const statsQuery = useQuery({
    queryKey: ['lead-stats'],
    queryFn: () => api.get('/leads/stats').then(r => r.data.data),
  });

  const leadsQuery = useQuery({
    queryKey: ['leads', tab, search],
    queryFn: () => api.get('/leads', { params: { status: tab, search: search.trim() || undefined } })
      .then(r => r.data.data),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['leads'] });
    qc.invalidateQueries({ queryKey: ['lead-stats'] });
  };

  const createMutation = useMutation({
    mutationFn: (payload) => api.post('/leads', payload),
    onSuccess: () => {
      invalidate();
      toast.success('Lid qo\'shildi');
      setModalOpen(false);
      setForm(emptyForm());
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Qo\'shib bo\'lmadi'),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => api.put(`/leads/${id}`, { status }),
    onSuccess: () => { invalidate(); toast.success('Status yangilandi'); },
    onError: (e) => toast.error(e.response?.data?.message || 'Xato'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/leads/${id}`),
    onSuccess: () => { invalidate(); toast.success('O\'chirildi'); },
    onError: (e) => toast.error(e.response?.data?.message || 'Xato'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Ismni kiriting');
    if (!form.phone.trim()) return toast.error('Telefon raqamni kiriting');
    createMutation.mutate({ ...form, name: form.name.trim(), phone: form.phone.trim() });
  };

  const stats = statsQuery.data;
  const leads = leadsQuery.data || [];

  return (
    <main className="mx-auto max-w-4xl pb-10">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-800 dark:text-white">Lidlar</h1>
          <p className="mt-0.5 text-sm text-gray-500">Kelgan mijozlarni kuzatib boring</p>
        </div>
        <button type="button" onClick={() => setModalOpen(true)}
          className="btn-primary flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-primary/40">
          <Plus size={15} /> Lid qo'shish
        </button>
      </header>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statsQuery.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card"><Skeleton className="h-3 w-20" /><Skeleton className="mt-3 h-7 w-12" /></div>
          ))
        ) : statsQuery.isError ? null : (
          <>
            <StatTile label="Bu hafta keldi" value={stats.thisWeek} icon={TrendingUp} tone="bg-primary/10 text-primary" />
            <StatTile label="Faol lidlar" value={stats.active} icon={UserPlus} tone="bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400" />
            <StatTile label="Muzlatilgan" value={stats.counts.frozen} icon={Snowflake} tone="bg-cyan-100 text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-400" />
            <StatTile label="Arxiv / chiqib ketgan" value={stats.counts.archived + stats.counts.lost} icon={Archive}
              tone="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
              hint={stats.conversionRate > 0 ? `${stats.conversionRate}% konversiya` : null} />
          </>
        )}
      </div>

      <div className="mb-4 space-y-3">
        <div className="relative">
          <Search size={15} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <label htmlFor="lead-search" className="sr-only">Lidlarni qidirish</label>
          <input id="lead-search" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Ism yoki telefon bo'yicha qidiring..."
            className="input-field pl-9 pr-9 focus-visible:ring-2 focus-visible:ring-primary/40" />
          {search && (
            <button type="button" onClick={() => setSearch('')} aria-label="Qidiruvni tozalash"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>

        <div role="tablist" aria-label="Lid holati" className="scrollbar-hide flex gap-1.5 overflow-x-auto pb-1">
          {TABS.map(t => (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-medium transition-all focus-visible:ring-2 focus-visible:ring-primary/40 ${
                tab === t.key
                  ? 'gradient-bg text-white shadow-sm'
                  : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800'}`}>
              {t.label}
              {stats && t.key !== 'all' && stats.counts[t.key] > 0 && (
                <span className="ml-1.5 opacity-70">{stats.counts[t.key]}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {leadsQuery.isError && <ErrorState error={leadsQuery.error} onRetry={leadsQuery.refetch} />}
      {leadsQuery.isLoading && <div className="space-y-2"><RowSkeleton count={4} /></div>}

      {!leadsQuery.isLoading && !leadsQuery.isError && leads.length === 0 && (
        <EmptyState icon={UserPlus}
          title={search ? 'Hech narsa topilmadi' : 'Bu bo\'limda lid yo\'q'}
          description={search
            ? 'Boshqa ism yoki raqam bilan qidirib ko\'ring.'
            : 'Yangi mijoz qo\'ng\'iroq qilganda shu yerga qo\'shib boring.'}
          action={!search && (
            <button type="button" onClick={() => setModalOpen(true)}
              className="btn-primary mt-1 flex items-center gap-2 text-sm focus-visible:ring-2 focus-visible:ring-primary/40">
              <Plus size={14} /> Birinchi lidni qo'shish
            </button>
          )} />
      )}

      <ul className="space-y-2">
        {leads.map((lead, i) => {
          const meta = statusMeta(lead.status);
          return (
            <motion.li key={lead.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.2 }} className="card">
              <div className="flex flex-wrap items-start gap-3">
                <span aria-hidden="true" className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full gradient-bg text-sm font-semibold text-white">
                  {lead.name?.charAt(0)?.toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-gray-800 dark:text-white">{lead.name}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-400">
                    <a href={`tel:${lead.phone}`}
                      className="inline-flex items-center gap-1 text-gray-500 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/40 dark:text-gray-400">
                      <Phone size={10} aria-hidden="true" /> {lead.phone}
                    </a>
                    <span>{sourceLabel(lead.source)}</span>
                    {lead.interestedIn && <span>• {lead.interestedIn}</span>}
                    <span>• {new Date(lead.createdAt).toLocaleDateString('uz-UZ')}</span>
                  </p>
                  {lead.note && <p className="mt-1 text-xs text-gray-500">{lead.note}</p>}
                </div>
                <span className={`badge flex-shrink-0 ${meta.tone}`}>{meta.label}</span>
                <button type="button" onClick={() => deleteMutation.mutate(lead.id)}
                  disabled={deleteMutation.isPending} aria-label={`${lead.name} — o'chirish`}
                  className="btn-ghost flex-shrink-0 rounded-lg p-1.5 text-red-400 hover:bg-red-50 disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-red-300 dark:hover:bg-red-500/10">
                  <Trash2 size={13} />
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5 border-t border-gray-100 pt-3 dark:border-gray-800">
                {STATUSES.filter(s => s.value !== lead.status).map(s => (
                  <button key={s.value} type="button"
                    onClick={() => statusMutation.mutate({ id: lead.id, status: s.value })}
                    disabled={statusMutation.isPending}
                    className="rounded-lg px-2 py-1 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-primary/40 dark:hover:bg-gray-800 dark:hover:text-gray-100">
                    {s.label}
                  </button>
                ))}
              </div>
            </motion.li>
          );
        })}
      </ul>

      <AnimatePresence>
        {modalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
            onClick={e => e.target === e.currentTarget && setModalOpen(false)}
            onKeyDown={e => e.key === 'Escape' && setModalOpen(false)}>
            <motion.div initial={{ scale: 0.97, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.97, y: 12 }}
              transition={{ duration: 0.18 }}
              role="dialog" aria-modal="true" aria-labelledby="lead-modal-title"
              className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-gray-900">
              <div className="mb-4 flex items-center justify-between">
                <h2 id="lead-modal-title" className="text-lg font-bold text-gray-800 dark:text-white">Yangi lid</h2>
                <button type="button" onClick={() => setModalOpen(false)} aria-label="Yopish"
                  className="btn-ghost rounded-lg p-1.5 focus-visible:ring-2 focus-visible:ring-primary/40">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label htmlFor="lead-name" className="mb-1.5 block text-sm font-medium">Ism *</label>
                  <input id="lead-name" autoFocus value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Ali Valiyev" className="input-field" />
                </div>
                <div>
                  <label htmlFor="lead-phone" className="mb-1.5 block text-sm font-medium">Telefon *</label>
                  <input id="lead-phone" type="tel" value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="+998 90 123 45 67" className="input-field" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="lead-source" className="mb-1.5 block text-sm font-medium">Qayerdan</label>
                    <select id="lead-source" value={form.source}
                      onChange={e => setForm(f => ({ ...f, source: e.target.value }))} className="input-field">
                      {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="lead-interest" className="mb-1.5 block text-sm font-medium">Qiziqqan yo'nalish</label>
                    <input id="lead-interest" value={form.interestedIn}
                      onChange={e => setForm(f => ({ ...f, interestedIn: e.target.value }))}
                      placeholder="Ingliz tili" className="input-field" />
                  </div>
                </div>
                <div>
                  <label htmlFor="lead-note" className="mb-1.5 block text-sm font-medium">Izoh</label>
                  <textarea id="lead-note" rows={2} value={form.note}
                    onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                    placeholder="Masalan: kechqurungi guruh so'radi" className="input-field resize-none" />
                </div>
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setModalOpen(false)} className="btn-ghost flex-1">Bekor</button>
                  <button type="submit" disabled={createMutation.isPending}
                    className="btn-primary flex-1 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-primary/40">
                    {createMutation.isPending ? 'Saqlanmoqda...' : 'Qo\'shish'}
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

function StatTile({ label, value, icon: Icon, tone, hint }) {
  return (
    <div className="card">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-gray-500">{label}</p>
        <span aria-hidden="true" className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl ${tone}`}>
          <Icon size={15} />
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-white">{value ?? 0}</p>
      {hint && <p className="mt-0.5 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}
