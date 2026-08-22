import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Which center the CRM views are currently showing. Persisted so switching
// pages does not silently drop you back into an "all centers" view - that mix
// is exactly what made one center's data show up while looking at another.
export const useBranchStore = create(
  persist(
    (set) => ({
      branchId: null,
      setBranchId: (branchId) => set({ branchId: branchId || null }),
      clearBranch: () => set({ branchId: null }),
    }),
    { name: 'neyron-branch' }
  )
);
