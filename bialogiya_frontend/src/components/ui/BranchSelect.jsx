import { useEffect } from 'react';
import { Building2 } from 'lucide-react';
import { useBranchStore } from '../../store/branchStore';
import { useMyBranches } from '../../utils/useMyBranches';

// Center switcher. `allowAll` lets the user opt into a combined view; without
// it a center is always selected, which is the safe default for CRM screens.
export default function BranchSelect({ allowAll = false, className = '' }) {
  const { data: branches = [], isLoading } = useMyBranches();
  const branchId = useBranchStore(s => s.branchId);
  const setBranchId = useBranchStore(s => s.setBranchId);

  // Keep the selection valid: default to the first center, and recover if the
  // stored center is gone (deleted, or access revoked).
  useEffect(() => {
    if (isLoading || branches.length === 0) return;
    const stillExists = branches.some(b => b.id === branchId);
    if (!stillExists && !(allowAll && branchId === null)) {
      setBranchId(branches[0].id);
    }
  }, [branches, branchId, isLoading, allowAll, setBranchId]);

  if (isLoading) {
    return <div className={`h-10 w-44 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800 ${className}`} />;
  }
  // One center means nothing to switch between.
  if (branches.length <= 1 && !allowAll) return null;

  return (
    <div className={`relative ${className}`}>
      <Building2 size={15} aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      <label htmlFor="branch-select" className="sr-only">Markazni tanlang</label>
      <select id="branch-select" value={branchId ?? ''}
        onChange={e => setBranchId(e.target.value || null)}
        className="input-field appearance-none pl-9 pr-8 font-medium focus-visible:ring-2 focus-visible:ring-primary/40">
        {allowAll && <option value="">Barcha markazlar</option>}
        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>
    </div>
  );
}
