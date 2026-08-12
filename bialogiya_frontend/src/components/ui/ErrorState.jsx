import { AlertTriangle, RefreshCw } from 'lucide-react';

// One human sentence and a way out - never a raw error object.
export default function ErrorState({ error, onRetry, title = 'Ma\'lumotni yuklab bo\'lmadi' }) {
  const message = error?.response?.data?.message
    || (error?.message === 'Network Error' ? 'Internetga ulanishda muammo bor.' : null)
    || 'Kutilmagan xatolik yuz berdi. Birozdan keyin qayta urinib ko\'ring.';

  return (
    <div role="alert" className="card flex flex-col items-center gap-3 py-10 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-50 text-red-500 dark:bg-red-500/10">
        <AlertTriangle size={20} />
      </div>
      <div>
        <p className="font-semibold text-gray-800 dark:text-white">{title}</p>
        <p className="mt-1 max-w-sm text-sm text-gray-500">{message}</p>
      </div>
      {onRetry && (
        <button type="button" onClick={onRetry}
          className="btn-outline mt-1 inline-flex items-center gap-2 text-sm focus-visible:ring-2 focus-visible:ring-primary/40">
          <RefreshCw size={14} /> Qayta urinish
        </button>
      )}
    </div>
  );
}
