import { useQuery } from '@tanstack/react-query';
import api from '../config/axios';

// The centers this account may act in. Shared by every branch-scoped screen so
// they all agree on which center is being viewed.
export function useMyBranches() {
  return useQuery({
    queryKey: ['my-branches'],
    queryFn: () => api.get('/users/my-branches').then(r => r.data?.data || []),
    staleTime: 5 * 60 * 1000,
  });
}
