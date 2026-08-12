import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, Users, Download, Loader2, X, Snowflake, ChevronRight } from 'lucide-react';
import api from '../../config/axios';
import toast from 'react-hot-toast';
import { friendlyAiErrorMessage } from '../../utils/aiErrors';
import { RowSkeleton } from '../../components/ui/Skeleton';
import ErrorState from '../../components/ui/ErrorState';
import EmptyState from '../../components/ui/EmptyState';
import { formatSum, PAYMENT_METHODS, methodLabel } from '../../utils/finance';

const monthLabel = (m) => {
  const [y, mo] = m.split('-');
  const names = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'];
  return `${names[parseInt(mo, 10) - 1]} ${y}`;
};

const STATUS_STYLE = {
  paid: { label: "To'langan", cls: 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-500/10 dark:text-green-400' },
  partial: { label: 'Qisman', cls: 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-500/10 dark:text-amber-400' },
  unpaid: { label: "To'lanmagan", cls: 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400' },
};

export default function ReceptionPayments() {
  const qc = useQueryClient();
  const [groupId, setGroupId] = useState('');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [editing, setEditing] = useState(null);

  const { data: groups = [] } = useQuery({
    queryKey: ['reception-groups'],
    queryFn: () => api.get('/reception/groups').then(r => {
      const data = r.data?.data || r.data || [];
      return Array.isArray(data) ? data : [];
    }),
  });

  useEffect(() => {
    if (!groupId && Array.isArray(groups) && groups.length) setGroupId(groups[0].id);
  }, [groups, groupId]);

  const paymentsQuery = useQuery({
    queryKey: ['reception-payments', groupId, month],
    queryFn: () => api.get(`/payments/group/${groupId}?month=${month}`).then(r => r.data?.data || {}),
    enabled: !!groupId,
  });

  const students = Array.isArray(paymentsQuery.data?.students) ? paymentsQuery.data.students : [];
  const monthlyFee = paymentsQuery.data?.monthlyFee || 0;
  const totals = paymentsQuery.data?.totals || { expected: 0, collected: 0, debt: 0 };

  const paymentMutation = useMutation({
    mutationFn: (payload) => api.post('/payments', { ...payload, month }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reception-payments', groupId, month] });
      qc.invalidateQueries({ queryKey: ['finance-summary'] });
      toast.success('To\'lov saqlandi');
      setEditing(null);
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Saqlab bo\'lmadi'),
  });

  const [exporting, setExporting] = useState(false);
  const exportExcel = async () => {
    if (!groupId) return;
    setExporting(true);
    try {
      const res = await api.get(`/payments/group/${groupId}/export`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${groups?.find(g => g.id === groupId)?.name || 'guruh'}-tolovlar.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(friendlyAiErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const counts = students.reduce((acc, s) => {
    acc[s.status] = (acc[s.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <main className="mx-auto max-w-3xl pb-10">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-800 dark:text-white">To'lovlar</h1>
          <p className="mt-0.5 text-sm text-gray-500">Kim qancha to'lagan va nima uchun to'lamagan</p>
        </div>
        <button type="button" onClick={exportExcel} disabled={!groupId || exporting}
          className="btn-outline flex items-center gap-2 disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-primary/40">
          {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
          Excel yuklab olish
        </button>
      </header>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <label htmlFor="pay-group" className="sr-only">Guruh</label>
          <select id="pay-group" value={groupId} onChange={e => setGroupId(e.target.value)}
            className="input-field focus-visible:ring-2 focus-visible:ring-primary/40">
            {groups?.map(g => (
              <option key={g.id} value={g.id}>{g.name} ({g._count?.students || 0} o'quvchi)</option>
            ))}
          </select>
        </div>
        <div className="sm:w-48">
          <label htmlFor="pay-month" className="sr-only">Oy</label>
          <input id="pay-month" type="month" value={month} onChange={e => setMonth(e.target.value)}
            className="input-field focus-visible:ring-2 focus-visible:ring-primary/40" />
        </div>
      </div>

      {paymentsQuery.isError && <ErrorState error={paymentsQuery.error} onRetry={paymentsQuery.refetch} />}

      {!paymentsQuery.isError && students.length > 0 && (
        <>
          <div className="mb-3 grid grid-cols-3 gap-3">
            {[
              { label: "To'lagan", value: counts.paid || 0, tone: 'text-green-600' },
              { label: 'Qisman', value: counts.partial || 0, tone: 'text-amber-600' },
              { label: "To'lamagan", value: counts.unpaid || 0, tone: 'text-red-500' },
            ].map(c => (
              <div key={c.label} className="card py-3 text-center">
                <p className={`text-xl font-bold tabular-nums ${c.tone}`}>{c.value}</p>
                <p className="mt-0.5 text-xs text-gray-400">{c.label}</p>
              </div>
            ))}
          </div>

          {monthlyFee > 0 ? (
            <div className="mb-5 grid grid-cols-3 gap-3">
              <div className="card py-3 text-center">
                <p className="text-sm font-bold tabular-nums text-primary">{formatSum(totals.collected)}</p>
                <p className="mt-0.5 text-xs text-gray-400">Yig'ilgan</p>
              </div>
              <div className="card py-3 text-center">
                <p className="text-sm font-bold tabular-nums text-gray-400">{formatSum(totals.expected)}</p>
                <p className="mt-0.5 text-xs text-gray-400">Kutilgan</p>
              </div>
              <div className="card py-3 text-center">
                <p className="text-sm font-bold tabular-nums text-red-500">{formatSum(totals.debt)}</p>
                <p className="mt-0.5 text-xs text-gray-400">Qarz</p>
              </div>
            </div>
          ) : (
            <p role="note" className="mb-5 rounded-2xl bg-amber-50 p-3 text-center text-xs text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
              Bu guruh uchun oylik to'lov summasi belgilanmagan — daromad hisoblanmaydi.
            </p>
          )}
        </>
      )}

      <p className="mb-2 text-xs text-gray-400">{monthLabel(month)}</p>

      <div className="space-y-2">
        {paymentsQuery.isLoading && <RowSkeleton count={5} />}

        {students.map((s, i) => {
          const style = STATUS_STYLE[s.status] || STATUS_STYLE.unpaid;
          return (
            <motion.div key={s.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.25), duration: 0.2 }}
              className="card flex flex-wrap items-center gap-3">
              <span aria-hidden="true" className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full gradient-bg text-sm font-semibold text-white">
                {s.name?.charAt(0)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 dark:text-white">
                  <span className="truncate">{s.name}</span>
                  {s.isFrozen && (
                    <span className="badge flex-shrink-0 bg-cyan-100 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400">
                      <Snowflake size={9} aria-hidden="true" /> Muzlatilgan
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-400">
                  @{s.username}
                  {s.paidAmount > 0 && <> • {formatSum(s.paidAmount)} / {formatSum(s.expectedAmount)}</>}
                  {s.payment?.method && s.paidAmount > 0 && <> • {methodLabel(s.payment.method)}</>}
                </p>
                {s.payment?.note && (
                  <p className="mt-1 rounded-lg bg-gray-50 px-2 py-1 text-xs text-gray-600 dark:bg-gray-800/60 dark:text-gray-300">
                    {s.payment.note}
                  </p>
                )}
              </div>

              <button type="button" onClick={() => setEditing(s)}
                aria-label={`${s.name} — to'lovni tahrirlash`}
                className={`flex flex-shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-primary/40 ${style.cls}`}>
                {style.label}
                <ChevronRight size={12} aria-hidden="true" />
              </button>
            </motion.div>
          );
        })}

        {!paymentsQuery.isLoading && groupId && students.length === 0 && (
          <EmptyState icon={Users} title="Bu guruhda o'quvchi yo'q"
            description="O'quvchi qo'shilgach, to'lovlar shu yerda ko'rinadi." />
        )}
        {!paymentsQuery.isLoading && !groupId && (
          <EmptyState icon={Wallet} title="Hali guruhlar mavjud emas"
            description="Avval guruh oching, keyin to'lovlarni shu yerdan yuritasiz." />
        )}
      </div>

      <AnimatePresence>
        {editing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
            onClick={e => e.target === e.currentTarget && setEditing(null)}
            onKeyDown={e => e.key === 'Escape' && setEditing(null)}>
            <motion.div initial={{ scale: 0.97, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.97, y: 12 }}
              transition={{ duration: 0.18 }}
              role="dialog" aria-modal="true" aria-labelledby="payment-modal-title"
              className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-gray-900">
              <div className="mb-1 flex items-center justify-between">
                <h2 id="payment-modal-title" className="text-lg font-bold text-gray-800 dark:text-white">{editing.name}</h2>
                <button type="button" onClick={() => setEditing(null)} aria-label="Yopish"
                  className="btn-ghost rounded-lg p-1.5 focus-visible:ring-2 focus-visible:ring-primary/40">
                  <X size={16} />
                </button>
              </div>
              <p className="mb-4 text-sm text-gray-500">{monthLabel(month)} uchun to'lov</p>

              <PaymentForm student={editing} monthlyFee={monthlyFee}
                pending={paymentMutation.isPending}
                onSubmit={(payload) => paymentMutation.mutate({ studentId: editing.id, ...payload })}
                onCancel={() => setEditing(null)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function PaymentForm({ student, monthlyFee, pending, onSubmit, onCancel }) {
  const expected = student.expectedAmount || monthlyFee || 0;
  const [amount, setAmount] = useState(String(student.paidAmount || ''));
  const [method, setMethod] = useState(student.payment?.method || 'cash');
  const [note, setNote] = useState(student.payment?.note || '');

  const paid = Number(amount) || 0;
  const remaining = Math.max(0, expected - paid);
  // The backend rejects a short payment without a reason, so mirror that here.
  const noteRequired = expected > paid;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (noteRequired && !note.trim()) {
      return toast.error("To'liq to'lanmagan — sababini yozing");
    }
    onSubmit({ amount: paid, expectedAmount: expected, method, note: note.trim() });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="pay-amount" className="mb-1.5 block text-sm font-medium">
          To'langan summa (so'm)
        </label>
        <input id="pay-amount" type="number" min="0" inputMode="numeric" autoFocus value={amount}
          onChange={e => setAmount(e.target.value)} placeholder="0" className="input-field" />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[
            { label: "To'liq", value: expected },
            { label: 'Yarmi', value: Math.round(expected / 2) },
            { label: 'Hech narsa', value: 0 },
          ].map(p => (
            <button key={p.label} type="button" onClick={() => setAmount(String(p.value))}
              className="rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-200 focus-visible:ring-2 focus-visible:ring-primary/40 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-gray-50 p-3 text-sm dark:bg-gray-800/50">
        <div className="flex justify-between text-gray-600 dark:text-gray-300">
          <span>Oylik to'lov</span>
          <span className="tabular-nums">{formatSum(expected)}</span>
        </div>
        <div className={`mt-1 flex justify-between font-semibold ${remaining > 0 ? 'text-red-500' : 'text-green-600'}`}>
          <span>{remaining > 0 ? 'Qolgan qarz' : "To'liq to'langan"}</span>
          <span className="tabular-nums">{formatSum(remaining)}</span>
        </div>
      </div>

      <div>
        <label htmlFor="pay-method" className="mb-1.5 block text-sm font-medium">To'lov turi</label>
        <select id="pay-method" value={method} onChange={e => setMethod(e.target.value)} className="input-field">
          {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>

      <div>
        <label htmlFor="pay-note" className="mb-1.5 block text-sm font-medium">
          Izoh {noteRequired && <span className="text-red-500">*</span>}
        </label>
        <textarea id="pay-note" rows={2} value={note} onChange={e => setNote(e.target.value)}
          required={noteRequired}
          placeholder={noteRequired ? "Nima uchun to'liq to'lamadi?" : 'Ixtiyoriy'}
          className="input-field resize-none" />
        {noteRequired && (
          <p className="mt-1 text-xs text-gray-400">
            Masalan: "Oyligi 15-kuni keladi", "Yarmini keyingi hafta beradi"
          </p>
        )}
      </div>

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
