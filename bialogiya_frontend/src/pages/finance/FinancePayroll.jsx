import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Users, Wallet, X, Check, ChevronDown } from 'lucide-react';
import api from '../../config/axios';
import toast from 'react-hot-toast';
import { RowSkeleton, Skeleton } from '../../components/ui/Skeleton';
import ErrorState from '../../components/ui/ErrorState';
import EmptyState from '../../components/ui/EmptyState';
import { formatSum, formatMonth } from '../../utils/finance';

const currentMonth = () => new Date().toISOString().slice(0, 7);
const monthOptions = () => Array.from({ length: 12 }, (_, i) => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - i, 1).toISOString().slice(0, 7);
});

// The shares a centre actually uses, phrased the way managers say them.
const SHARE_PRESETS = [
  { share: 33, label: '1/3', hint: "O'qituvchi 33%, markaz 67%" },
  { share: 50, label: '50/50', hint: "Teng bo'linadi" },
  { share: 67, label: '2/3', hint: "O'qituvchi 67%, markaz 33%" },
];

export default function FinancePayroll() {
  const qc = useQueryClient();
  const [month, setMonth] = useState(currentMonth);
  const [editing, setEditing] = useState(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['payroll', month],
    queryFn: () => api.get(`/finance/payroll?month=${month}`).then(r => r.data.data),
  });

  const salaryMutation = useMutation({
    mutationFn: ({ id, payload }) => api.put(`/finance/teachers/${id}/salary`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payroll'] });
      qc.invalidateQueries({ queryKey: ['finance-by-group'] });
      toast.success('Ish haqi shartlari saqlandi');
      setEditing(null);
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Saqlab bo\'lmadi'),
  });

  const teachers = data?.teachers || [];

  return (
    <main className="mx-auto max-w-3xl pb-10">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/finance" aria-label="Moliyaga qaytish"
            className="btn-ghost rounded-xl p-2 focus-visible:ring-2 focus-visible:ring-primary/40">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-800 dark:text-white">Ish haqi</h1>
            <p className="mt-0.5 text-sm text-gray-500">Yig'ilgan to'lovdan avtomatik hisoblanadi</p>
          </div>
        </div>
        <div>
          <label htmlFor="payroll-month" className="sr-only">Oy</label>
          <select id="payroll-month" value={month} onChange={e => setMonth(e.target.value)}
            className="input-field w-40 focus-visible:ring-2 focus-visible:ring-primary/40">
            {monthOptions().map(m => <option key={m} value={m}>{formatMonth(m)}</option>)}
          </select>
        </div>
      </header>

      {isError && <ErrorState error={error} onRetry={refetch} />}

      {isLoading && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="card"><Skeleton className="h-3 w-24" /><Skeleton className="mt-3 h-7 w-32" /></div>
            <div className="card"><Skeleton className="h-3 w-24" /><Skeleton className="mt-3 h-7 w-32" /></div>
          </div>
          <div className="space-y-2"><RowSkeleton count={3} /></div>
        </>
      )}

      {!isLoading && !isError && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="card">
              <p className="text-xs font-medium text-gray-500">Yig'ilgan tushum</p>
              <p className="mt-2 text-xl font-bold tabular-nums text-gray-900 dark:text-white">{formatSum(data.totalCollected)}</p>
            </div>
            <div className="card">
              <p className="text-xs font-medium text-gray-500">O'qituvchilarga jami</p>
              <p className="mt-2 text-xl font-bold tabular-nums text-primary">{formatSum(data.totalSalary)}</p>
            </div>
          </div>

          {data.hourlyTeachersNeedHours?.length > 0 && (
            <p role="note" className="mb-4 rounded-2xl bg-amber-50 p-3 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
              Soatbay ishlaydigan o'qituvchilar ({data.hourlyTeachersNeedHours.join(', ')}) uchun soat hisobi
              yuritilmagani sababli summa 0 ko'rsatilmoqda.
            </p>
          )}

          {teachers.length === 0 && (
            <EmptyState icon={Users} title="Guruhga biriktirilgan o'qituvchi yo'q"
              description="O'qituvchiga guruh biriktirilgach, ish haqi shu yerda avtomatik hisoblanadi." />
          )}

          <ul className="space-y-3">
            {teachers.map((t, i) => (
              <motion.li key={t.teacherId} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.3), duration: 0.2 }} className="card">
                <div className="flex flex-wrap items-center gap-3">
                  <span aria-hidden="true" className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full gradient-bg text-sm font-semibold text-white">
                    {t.name?.charAt(0)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-gray-800 dark:text-white">{t.name}</p>
                    <p className="text-xs text-gray-400">
                      {t.groups.length} guruh • {t.studentCount} o'quvchi
                    </p>
                  </div>
                  <button type="button" onClick={() => setEditing(t)}
                    className="badge bg-primary/10 text-primary focus-visible:ring-2 focus-visible:ring-primary/40"
                    aria-label={`${t.name} — ish haqi shartlarini o'zgartirish`}>
                    {t.shareLabel} <ChevronDown size={11} aria-hidden="true" />
                  </button>
                  <div className="w-full text-right sm:w-auto">
                    <p className="text-sm font-bold tabular-nums text-gray-900 dark:text-white">{formatSum(t.salary)}</p>
                    <p className="text-xs text-gray-400">{formatSum(t.collected)} dan</p>
                  </div>
                </div>

                <div className="mt-3 space-y-1 border-t border-gray-100 pt-3 dark:border-gray-800">
                  {t.groups.map(g => (
                    <div key={g.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate text-gray-500">{g.name}</span>
                      <span className="flex-shrink-0 tabular-nums text-gray-600 dark:text-gray-300">
                        {formatSum(g.collected)}
                        {g.expected > g.collected && (
                          <span className="text-red-400"> / {formatSum(g.expected)}</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.li>
            ))}
          </ul>
        </>
      )}

      <AnimatePresence>
        {editing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
            onClick={e => e.target === e.currentTarget && setEditing(null)}
            onKeyDown={e => e.key === 'Escape' && setEditing(null)}>
            <motion.div initial={{ scale: 0.97, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.97, y: 12 }}
              transition={{ duration: 0.18 }}
              role="dialog" aria-modal="true" aria-labelledby="salary-modal-title"
              className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-gray-900">
              <div className="mb-1 flex items-center justify-between">
                <h2 id="salary-modal-title" className="text-lg font-bold text-gray-800 dark:text-white">
                  {editing.name}
                </h2>
                <button type="button" onClick={() => setEditing(null)} aria-label="Yopish"
                  className="btn-ghost rounded-lg p-1.5 focus-visible:ring-2 focus-visible:ring-primary/40">
                  <X size={16} />
                </button>
              </div>
              <p className="mb-4 text-sm text-gray-500">O'qituvchi qancha ulush oladi?</p>

              <SalaryForm teacher={editing}
                pending={salaryMutation.isPending}
                onSubmit={(payload) => salaryMutation.mutate({ id: editing.teacherId, payload })}
                onCancel={() => setEditing(null)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function SalaryForm({ teacher, pending, onSubmit, onCancel }) {
  const [salaryType, setSalaryType] = useState(teacher.salaryType || 'percent');
  const [salaryShare, setSalaryShare] = useState(teacher.salaryShare ?? 50);
  const [fixedSalary, setFixedSalary] = useState(teacher.fixedSalary ?? '');
  const [hourlyRate, setHourlyRate] = useState(teacher.hourlyRate ?? '');

  const preview = salaryType === 'percent'
    ? Math.round((teacher.collected * salaryShare) / 100)
    : salaryType === 'fixed' ? Number(fixedSalary) || 0 : null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      salaryType,
      salaryShare: Number(salaryShare),
      fixedSalary: fixedSalary === '' ? null : Number(fixedSalary),
      hourlyRate: hourlyRate === '' ? null : Number(hourlyRate),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Hisoblash usuli</legend>
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: 'percent', label: 'Foiz' },
            { value: 'fixed', label: 'Qat\'iy' },
            { value: 'hourly', label: 'Soatbay' },
          ].map(opt => (
            <button key={opt.value} type="button" onClick={() => setSalaryType(opt.value)}
              aria-pressed={salaryType === opt.value}
              className={`rounded-xl border-2 py-2 text-sm font-medium transition-all focus-visible:ring-2 focus-visible:ring-primary/40 ${
                salaryType === opt.value
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:text-gray-300'}`}>
              {opt.label}
            </button>
          ))}
        </div>
      </fieldset>

      {salaryType === 'percent' && (
        <div className="space-y-2">
          {SHARE_PRESETS.map(p => (
            <button key={p.share} type="button" onClick={() => setSalaryShare(p.share)}
              aria-pressed={salaryShare === p.share}
              className={`flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left transition-all focus-visible:ring-2 focus-visible:ring-primary/40 ${
                salaryShare === p.share
                  ? 'border-primary bg-primary/5'
                  : 'border-gray-200 hover:border-gray-300 dark:border-gray-700'}`}>
              <span className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                salaryShare === p.share ? 'border-primary bg-primary' : 'border-gray-300'}`}>
                {salaryShare === p.share && <Check size={11} className="text-white" aria-hidden="true" />}
              </span>
              <span className="flex-1">
                <span className="block text-sm font-semibold text-gray-800 dark:text-white">{p.label}</span>
                <span className="block text-xs text-gray-400">{p.hint}</span>
              </span>
            </button>
          ))}

          <div>
            <label htmlFor="custom-share" className="mb-1.5 block text-sm font-medium">Boshqa foiz</label>
            <input id="custom-share" type="number" min="0" max="100" value={salaryShare}
              onChange={e => setSalaryShare(e.target.value)} className="input-field" />
          </div>
        </div>
      )}

      {salaryType === 'fixed' && (
        <div>
          <label htmlFor="fixed-salary" className="mb-1.5 block text-sm font-medium">Oylik summa (so'm)</label>
          <input id="fixed-salary" type="number" min="0" value={fixedSalary}
            onChange={e => setFixedSalary(e.target.value)} placeholder="5000000" className="input-field" />
        </div>
      )}

      {salaryType === 'hourly' && (
        <div>
          <label htmlFor="hourly-rate" className="mb-1.5 block text-sm font-medium">Bir soat uchun (so'm)</label>
          <input id="hourly-rate" type="number" min="0" value={hourlyRate}
            onChange={e => setHourlyRate(e.target.value)} placeholder="80000" className="input-field" />
          <p className="mt-1 text-xs text-gray-400">
            Soat hisobi hozircha yuritilmaydi — summa qo'lda kiritiladi.
          </p>
        </div>
      )}

      {preview !== null && (
        <div className="flex items-center gap-2 rounded-2xl bg-gray-50 p-3 dark:bg-gray-800/50">
          <Wallet size={15} className="flex-shrink-0 text-primary" aria-hidden="true" />
          <p className="text-sm text-gray-700 dark:text-gray-200">
            Shu oy uchun: <span className="font-bold tabular-nums text-gray-900 dark:text-white">{formatSum(preview)}</span>
          </p>
        </div>
      )}

      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="btn-ghost flex-1">Bekor</button>
        <button type="submit" disabled={pending}
          className="btn-primary flex-1 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-primary/40">
          {pending ? 'Saqlanmoqda...' : 'Saqlash'}
        </button>
      </div>
    </form>
  );
}
