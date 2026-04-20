import { useInfiniteQuery, useMutation } from '@tanstack/react-query';

import { apiClient } from '@/api/client';
import { queryClient } from '@/api/queryClient';
import type { AdminUser, ConversationPage, PaginatedResponse } from '@/api/types';

export function adminHeaders(key: string): Record<string, string> {
  return { 'x-admin-key': key };
}

const ONE_MINUTE = 60_000;

export function useAdminUsers(adminKey: string | null, sort: string, order: string) {
  return useInfiniteQuery({
    retry: false,
    enabled: !!adminKey,
    structuralSharing: false,
    refetchInterval: 5 * ONE_MINUTE,
    queryKey: ['admin', 'users', sort, order],
    queryFn: ({ pageParam }) => {
      return apiClient<PaginatedResponse<AdminUser>>(`/api/admin/users?sort=${sort}&order=${order}&page=${pageParam}`, {
        headers: adminHeaders(adminKey!),
      });
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const totalPages = Math.ceil(lastPage.total / lastPage.limit);
      return lastPage.page < totalPages ? lastPage.page + 1 : undefined;
    },
  });
}

export function useAdminConversation(adminKey: string | null, userId: string | null) {
  return useInfiniteQuery({
    retry: false,
    structuralSharing: false,
    refetchInterval: 2 * ONE_MINUTE,
    enabled: !!adminKey && !!userId,
    queryKey: ['admin', 'conversation', userId],
    queryFn: ({ pageParam }: { pageParam: number | undefined }) => {
      const params = new URLSearchParams();
      if (pageParam) params.set('cursor', String(pageParam));
      const qs = params.toString();
      return apiClient<ConversationPage>(`/api/admin/users/${userId}/messages${qs ? `?${qs}` : ''}`, {
        headers: adminHeaders(adminKey!),
      });
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function useUpdateAdminNotes(key: string | null) {
  return useMutation({
    mutationFn: ({ userId, notes }: { userId: string | null; notes: string }) => {
      if (!userId) throw new Error('User ID is required');

      return apiClient<{ id: string; adminNotes: string | null }>(`/api/admin/users/${userId}/notes`, {
        method: 'PUT',
        body: { notes },
        headers: adminHeaders(key!),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'conversation'] });
    },
  });
}
