import { useQuery, useInfiniteQuery } from '@tanstack/react-query';

import { apiClient } from '@/api/client';
import { adminHeaders } from '@/api/admin';
import type { AnalyticsFilters, AnalyticsPage } from '@/api/types';

const ONE_MINUTE = 60_000;

export function useAnalyticEvents(key: string | null, filters: AnalyticsFilters) {
  return useInfiniteQuery({
    retry: false,
    enabled: !!key,
    structuralSharing: false,
    refetchInterval: 5 * ONE_MINUTE,
    queryKey: ['admin', 'analytics', filters],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams();
      if (pageParam) params.set('cursor', pageParam);
      if (filters.events?.length) params.set('events', filters.events.join(','));
      if (filters.userIds?.length) params.set('userIds', filters.userIds.join(','));
      if (filters.after) params.set('after', filters.after);
      if (filters.before) params.set('before', filters.before);

      return apiClient<AnalyticsPage>(`/api/admin/events?${params.toString()}`, {
        headers: adminHeaders(key!),
      });
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function useAnalyticsEventTypes(key: string | null) {
  return useQuery({
    retry: false,
    enabled: !!key,
    queryKey: ['admin', 'analytics', 'event-types'],
    queryFn: () => {
      return apiClient<string[]>('/api/admin/event-types', { headers: adminHeaders(key!) });
    },
  });
}
