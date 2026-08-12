import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Wallet, AlertCircle, Sparkles, ArrowRight,
  PiggyBank, Receipt, Table2, ChevronDown,
} from 'lucide-react';
import api from '../../config/axios';
import { Skeleton, StatTileSkeleton } from '../../components/ui/Skeleton';
import ErrorState from '../../components/ui/ErrorState';
import {
  formatSum, formatCompactSum, formatMonth, categoryLabel, methodLabel, useChartColors,
} from '../../utils/finance';

const currentMonth = () => new Date().toISOString().slice(0, 7);

const monthOptions = () => {
  const out = [];
  const now = new Date();
  for (let i = 0; i < 12; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(d.toISOString().slice(0, 7));
  }
  return out;
};

function StatTile({ label, value, hint, icon: Icon, tone = 'neutral', change }) {
  const tones = {
    neutral: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
    income: 'bg-primary/10 text-primary',
    expense: 'bg-orange-100 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400',
    debt: 'bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-400',
  };

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-gray-500">{label}</p>
        {Icon && (
          <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>
            <Icon size={15} />
          </span>
        )}
      </div>
      <p className="mt-2 text-xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-2xl">{value}</p>
      <div className="mt-1 flex items-center gap-1.5 text-xs">
        {typeof change === 'number' && (
          <span className={`inline-flex items-center gap-0.5 font-semibold ${change >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {change >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {Math.abs(change)}%
          </span>
        )}
        {hint && <span className="text-gray-400">{hint}</span>}
      </div>
    </div>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-900">
      <p className="mb-1.5 text-xs font-semibold text-gray-800 dark:text-white">{formatMonth(label)}</p>
      {payload.map(p => (
        <p key={p.dataKey} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
          <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
          {p.name}: <span className="font-semibold text-gray-900 dark:text-white">{formatSum(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

export default function FinanceDashboard() {
  const [month, setMonth] = useState(currentMonth);
  const [showTable, setShowTable] = useState(false);
  const colors = useChartColors();

  const summaryQuery = useQuery({
    queryKey: ['finance-summary', month],
    queryFn: () => api.get(`/finance/summary?month=${month}&months=6`).then(r => r.data.data),
  });

  const groupsQuery = useQuery({
    queryKey: ['finance-by-group', month],
    queryFn: () => api.get(`/finance/by-group?month=${month}`).then(r => r.data.data),
  });

  const adviceQuery = useQuery({
    queryKey: ['finance-advice', month],
    queryFn: () => api.get(`/finance/advice?month=${month}`).then(r => r.data.data),
    retry: false,
  });

  const s = summaryQuery.data;
  const hasData = s?.series?.some(r => r.income > 0 || r.expense > 0);

  const expenseRows = Object.entries(s?.expensesByCategory || {})
    .map(([category, amount]) => ({ category, label: categoryLabel(category), amount }))
    .sort((a, b) => b.amount - a.amount);

  const topGroups = (groupsQuery.data?.groups || []).filter(g => g.collected > 0).slice(0, 6);

  return (
    <main className="mx-auto max-w-5xl pb-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-800 dark:text-white">Moliya</h1>
          <p className="mt-0.5 text-sm text-gray-500">Daromad, xarajat va foyda tahlili</p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="finance-month" className="sr-only">Oyni tanlang</label>
          <select id="finance-month" value={month} onChange={e => setMonth(e.target.value)}
            className="input-field w-40 focus-visible:ring-2 focus-visible:ring-primary/40">
            {monthOptions().map(m => <option key={m} value={m}>{formatMonth(m)}</option>)}
          </select>
          <Link to="/finance/expenses"
            className="btn-primary flex items-center gap-2 text-sm focus-visible:ring-2 focus-visible:ring-primary/40">
            <Receipt size={15} /> Xarajatlar
          </Link>
        </div>
      </header>

      {summaryQuery.isError && (
        <ErrorState error={summaryQuery.error} onRetry={summaryQuery.refetch} />
      )}

      {!summaryQuery.isError && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {summaryQuery.isLoading ? <StatTileSkeleton count={4} /> : (
              <>
                <StatTile label="Tushum" value={formatSum(s.current.income)} icon={Wallet} tone="income"
                  change={s.change.income} hint="o'tgan oyga nisbatan" />
                <StatTile label="Xarajat" value={formatSum(s.current.expense)} icon={Receipt} tone="expense"
                  change={s.change.expense} hint="o'tgan oyga nisbatan" />
                <StatTile label={s.current.profit >= 0 ? 'Sof foyda' : 'Zarar'}
                  value={formatSum(Math.abs(s.current.profit))} icon={PiggyBank}
                  tone={s.current.profit >= 0 ? 'income' : 'debt'}
                  hint={s.current.profit >= 0 ? 'tushum − xarajat' : 'xarajat tushumdan ko\'p'} />
                <StatTile label="Yig'ilmagan qarz" value={formatSum(s.outstanding)} icon={AlertCircle} tone="debt"
                  hint="shu oy uchun" />
              </>
            )}
          </div>

          <section aria-labelledby="pl-heading" className="card mb-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 id="pl-heading" className="font-bold text-gray-800 dark:text-white">Daromad va xarajat</h2>
                <p className="text-xs text-gray-400">Oxirgi 6 oy</p>
              </div>
              <button type="button" onClick={() => setShowTable(v => !v)}
                aria-expanded={showTable}
                className="btn-ghost flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs focus-visible:ring-2 focus-visible:ring-primary/40">
                <Table2 size={13} /> Jadval ko'rinishi
                <ChevronDown size={12} className={`transition-transform ${showTable ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {summaryQuery.isLoading && <Skeleton className="h-64 w-full rounded-xl" />}

            {!summaryQuery.isLoading && !hasData && (
              <p className="py-14 text-center text-sm text-gray-400">
                Bu davrda moliyaviy yozuv yo'q. To'lovlarni belgilang yoki xarajat qo'shing.
              </p>
            )}

            {!summaryQuery.isLoading && hasData && (
              <>
                <div className="overflow-x-auto">
                  <ResponsiveContainer width="100%" height={260} minWidth={320}>
                    <BarChart data={s.series} barGap={2} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.2)" />
                      <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fontSize: 11, fill: '#94A3B8' }}
                        axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={formatCompactSum} tick={{ fontSize: 11, fill: '#94A3B8' }}
                        axisLine={false} tickLine={false} width={56} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
                      <Legend iconType="circle" iconSize={8}
                        wrapperStyle={{ fontSize: 12, paddingTop: 8, color: '#64748B' }} />
                      <Bar dataKey="income" name="Tushum" fill={colors.income} radius={[4, 4, 0, 0]} maxBarSize={26} />
                      <Bar dataKey="expense" name="Xarajat" fill={colors.expense} radius={[4, 4, 0, 0]} maxBarSize={26} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {showTable && (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <caption className="sr-only">Oylik daromad, xarajat va foyda jadvali</caption>
                      <thead className="text-gray-500">
                        <tr className="border-b border-gray-100 dark:border-gray-800">
                          <th scope="col" className="py-2 pr-3 font-medium">Oy</th>
                          <th scope="col" className="py-2 pr-3 text-right font-medium">Tushum</th>
                          <th scope="col" className="py-2 pr-3 text-right font-medium">Xarajat</th>
                          <th scope="col" className="py-2 text-right font-medium">Foyda</th>
                        </tr>
                      </thead>
                      <tbody>
                        {s.series.map(row => (
                          <tr key={row.month} className="border-b border-gray-50 last:border-0 dark:border-gray-800/50">
                            <th scope="row" className="py-2 pr-3 font-medium text-gray-700 dark:text-gray-200">{formatMonth(row.month)}</th>
                            <td className="py-2 pr-3 text-right tabular-nums text-gray-600 dark:text-gray-300">{formatSum(row.income)}</td>
                            <td className="py-2 pr-3 text-right tabular-nums text-gray-600 dark:text-gray-300">{formatSum(row.expense)}</td>
                            <td className={`py-2 text-right font-semibold tabular-nums ${row.profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                              {formatSum(row.profit)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </section>

          {!summaryQuery.isLoading && hasData && s.forecast.basedOnMonths > 1 && (
            <section aria-labelledby="forecast-heading" className="card mb-4">
              <h2 id="forecast-heading" className="mb-1 font-bold text-gray-800 dark:text-white">Keyingi oy prognozi</h2>
              <p className="mb-4 text-xs text-gray-400">
                Oxirgi {s.forecast.basedOnMonths} oyning o'rtachasi asosida — kafolat emas, mo'ljal
              </p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Kutilayotgan tushum', value: s.forecast.expectedIncome, tone: 'text-primary' },
                  { label: 'Kutilayotgan xarajat', value: s.forecast.expectedExpense, tone: 'text-orange-500' },
                  { label: 'Kutilayotgan foyda', value: s.forecast.expectedProfit, tone: s.forecast.expectedProfit >= 0 ? 'text-green-600' : 'text-red-500' },
                ].map(f => (
                  <div key={f.label} className="rounded-2xl bg-gray-50 p-3 dark:bg-gray-800/50">
                    <p className="text-xs text-gray-500">{f.label}</p>
                    <p className={`mt-1 text-sm font-bold tabular-nums ${f.tone}`}>{formatSum(f.value)}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="mb-4 grid gap-4 lg:grid-cols-2">
            <section aria-labelledby="cat-heading" className="card">
              <h2 id="cat-heading" className="mb-4 font-bold text-gray-800 dark:text-white">Xarajat toifalari</h2>
              {summaryQuery.isLoading && <Skeleton className="h-40 w-full rounded-xl" />}
              {!summaryQuery.isLoading && expenseRows.length === 0 && (
                <p className="py-10 text-center text-sm text-gray-400">Bu oyda xarajat kiritilmagan.</p>
              )}
              {!summaryQuery.isLoading && expenseRows.length > 0 && (
                <ul className="space-y-3">
                  {expenseRows.map(row => {
                    const pct = Math.round((row.amount / s.current.expense) * 100);
                    return (
                      <li key={row.category}>
                        <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                          <span className="text-gray-700 dark:text-gray-200">{row.label}</span>
                          <span className="font-semibold tabular-nums text-gray-900 dark:text-white">{formatSum(row.amount)}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                          <div className="h-full rounded-full transition-all duration-500 motion-reduce:transition-none"
                            style={{ width: `${pct}%`, backgroundColor: colors.expense }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section aria-labelledby="method-heading" className="card">
              <h2 id="method-heading" className="mb-4 font-bold text-gray-800 dark:text-white">Tushum turlari</h2>
              {summaryQuery.isLoading && <Skeleton className="h-40 w-full rounded-xl" />}
              {!summaryQuery.isLoading && Object.keys(s.incomeByMethod || {}).length === 0 && (
                <p className="py-10 text-center text-sm text-gray-400">Bu oyda to'lov qayd etilmagan.</p>
              )}
              {!summaryQuery.isLoading && Object.keys(s.incomeByMethod || {}).length > 0 && (
                <ul className="space-y-2.5">
                  {Object.entries(s.incomeByMethod).sort((a, b) => b[1] - a[1]).map(([method, amount]) => (
                    <li key={method} className="flex items-center justify-between gap-2 rounded-xl bg-gray-50 px-3 py-2.5 dark:bg-gray-800/50">
                      <span className="text-sm text-gray-700 dark:text-gray-200">{methodLabel(method)}</span>
                      <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">{formatSum(amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section aria-labelledby="groups-heading" className="card mb-4">
            <h2 id="groups-heading" className="mb-1 font-bold text-gray-800 dark:text-white">Eng ko'p daromad keltirgan guruhlar</h2>
            <p className="mb-4 text-xs text-gray-400">O'qituvchi ulushi ayirilgandan keyingi sof summa bo'yicha</p>

            {groupsQuery.isLoading && <div className="space-y-2"><Skeleton className="h-14 w-full rounded-xl" /><Skeleton className="h-14 w-full rounded-xl" /></div>}
            {groupsQuery.isError && <ErrorState error={groupsQuery.error} onRetry={groupsQuery.refetch} title="Guruhlar tahlilini yuklab bo'lmadi" />}
            {!groupsQuery.isLoading && !groupsQuery.isError && topGroups.length === 0 && (
              <p className="py-10 text-center text-sm text-gray-400">Bu oyda hech qaysi guruhdan tushum bo'lmagan.</p>
            )}

            <ul className="space-y-2">
              {topGroups.map((g, i) => (
                <motion.li key={g.groupId} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.2 }}
                  className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-100 p-3 dark:border-gray-800">
                  <span aria-hidden="true" className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xs font-bold text-primary">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-800 dark:text-white">{g.name}</p>
                    <p className="truncate text-xs text-gray-400">
                      {g.teacher?.name || 'O\'qituvchi yo\'q'} • {g.activeCount} o'quvchi
                      {g.debt > 0 && <span className="text-red-500"> • {formatSum(g.debt)} qarz</span>}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold tabular-nums text-gray-900 dark:text-white">{formatSum(g.centerNet)}</p>
                    <p className="text-xs text-gray-400">{formatSum(g.collected)} tushum</p>
                  </div>
                  <span className={`badge flex-shrink-0 ${g.collectionRate >= 80 ? 'bg-green-100 text-green-700' : g.collectionRate >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>
                    {g.collectionRate}%
                  </span>
                </motion.li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="ai-heading" className="card border-primary/20">
            <h2 id="ai-heading" className="mb-3 flex items-center gap-2 font-bold text-gray-800 dark:text-white">
              <Sparkles size={16} className="text-primary" /> AI moliyaviy maslahat
            </h2>

            {adviceQuery.isLoading && (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full rounded-2xl" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            )}
            {adviceQuery.isError && <ErrorState error={adviceQuery.error} onRetry={adviceQuery.refetch} title="Maslahatni olishda xatolik" />}
            {!adviceQuery.isLoading && !adviceQuery.isError && !adviceQuery.data?.advice && (
              <p className="py-6 text-center text-sm text-gray-400">
                {adviceQuery.data?.message || 'Hozircha tahlil qilish uchun ma\'lumot yetarli emas.'}
              </p>
            )}

            {adviceQuery.data?.advice && (
              <FinanceAdvice advice={adviceQuery.data.advice} />
            )}
          </section>
        </>
      )}
    </main>
  );
}

function FinanceAdvice({ advice }) {
  const healthTone = {
    good: 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400',
    warning: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
    critical: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400',
  };
  const healthLabel = { good: 'Yaxshi', warning: 'Diqqat', critical: 'Jiddiy' };

  return (
    <div className="space-y-4">
      {advice.headline && (
        <div className={`rounded-2xl p-3 ${healthTone[advice.health] || healthTone.warning}`}>
          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
            <AlertCircle size={12} aria-hidden="true" />
            {healthLabel[advice.health] || 'Xulosa'}
          </div>
          <p className="text-sm font-medium">{advice.headline}</p>
        </div>
      )}

      {advice.observations?.length > 0 && (
        <div>
          <h3 className="mb-1.5 text-xs font-semibold text-gray-500">Kuzatuvlar</h3>
          <ul className="space-y-1">
            {advice.observations.map((o, i) => (
              <li key={i} className="flex gap-2 text-sm text-gray-700 dark:text-gray-200">
                <span aria-hidden="true" className="text-primary">•</span>{o}
              </li>
            ))}
          </ul>
        </div>
      )}

      {advice.risks?.length > 0 && (
        <div>
          <h3 className="mb-1.5 text-xs font-semibold text-gray-500">Xavflar</h3>
          <ul className="space-y-2">
            {advice.risks.map((r, i) => (
              <li key={i} className="border-l-2 border-amber-300 pl-3">
                <p className="text-sm text-gray-800 dark:text-gray-100">{r.risk}</p>
                {r.why && <p className="text-xs text-gray-500">{r.why}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {advice.actions?.length > 0 && (
        <div>
          <h3 className="mb-1.5 text-xs font-semibold text-gray-500">Nima qilish kerak</h3>
          <ul className="space-y-2">
            {advice.actions.map((a, i) => (
              <li key={i} className="flex gap-2 rounded-xl bg-gray-50 p-2.5 dark:bg-gray-800/50">
                <ArrowRight size={14} className="mt-0.5 flex-shrink-0 text-primary" aria-hidden="true" />
                <div>
                  <p className="text-sm text-gray-800 dark:text-gray-100">{a.action}</p>
                  {a.impact && <p className="text-xs text-gray-500">{a.impact}</p>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {advice.debtAdvice && (
        <div className="rounded-xl bg-gray-50 p-3 text-sm text-gray-700 dark:bg-gray-800/50 dark:text-gray-200">
          <span className="font-semibold">Qarzdorlik: </span>{advice.debtAdvice}
        </div>
      )}
    </div>
  );
}
