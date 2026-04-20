import { useInfiniteQuery, useMutation } from '@tanstack/react-query';

import { apiClient } from '@/api/client';
import { queryClient } from '@/api/queryClient';
import type { AdminMatch, AdminUser, CompatibilityCheck, ConversationPage, PaginatedResponse } from '@/api/types';

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

export function useAdminGroupConversation(adminKey: string | null, matchId: string | null) {
  return useInfiniteQuery({
    retry: false,
    structuralSharing: false,
    refetchInterval: 2 * ONE_MINUTE,
    enabled: !!adminKey && !!matchId,
    queryKey: ['admin', 'group-conversation', matchId],
    queryFn: ({ pageParam }: { pageParam: number | undefined }) => {
      const params = new URLSearchParams();
      if (pageParam) params.set('cursor', String(pageParam));
      const qs = params.toString();
      return apiClient<ConversationPage>(`/api/admin/matches/${matchId}/messages${qs ? `?${qs}` : ''}`, {
        headers: adminHeaders(adminKey!),
      });
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function useStartIntroduction(adminKey: string | null) {
  return useMutation({
    mutationFn: ({ userAId, userBId }: { userAId: string; userBId: string }) => {
      if (!adminKey) throw new Error('Admin key is required');
      return apiClient<AdminMatch>('/api/admin/introduce/start', {
        method: 'POST',
        body: { userAId, userBId },
        headers: adminHeaders(adminKey),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'matches'] });
    },
  });
}

export function useUpdateDrafts(adminKey: string | null) {
  return useMutation({
    mutationFn: (data: { matchId: string; draftMessageA?: string; draftMessageB?: string }) => {
      if (!adminKey) throw new Error('Admin key is required');

      return apiClient<AdminMatch>(`/api/admin/introduce/${data.matchId}/drafts`, {
        method: 'PUT',
        headers: adminHeaders(adminKey),
        body: { draftMessageA: data.draftMessageA, draftMessageB: data.draftMessageB },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'matches'] });
    },
  });
}

export function useSendOptIn(key: string | null) {
  return useMutation({
    mutationFn: (matchId: string) => {
      return apiClient<AdminMatch>(`/api/admin/introduce/${matchId}/send-opt-in`, {
        method: 'POST',
        headers: adminHeaders(key!),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'matches'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

export function useToggleOptIn(key: string | null) {
  return useMutation({
    mutationFn: ({ matchId, userId, optedIn }: { matchId: string; userId: string; optedIn: boolean }) => {
      return apiClient<AdminMatch>(`/api/admin/introduce/${matchId}/toggle-opt-in`, {
        method: 'POST',
        body: { userId, optedIn },
        headers: adminHeaders(key!),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'matches'] });
    },
  });
}

export function useSendGroupIntro(key: string | null) {
  return useMutation({
    mutationFn: (matchId: string) => {
      return apiClient<AdminMatch>(`/api/admin/introduce/${matchId}/send-group`, {
        method: 'POST',
        headers: adminHeaders(key!),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'matches'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

export function useSendContactCard(key: string | null) {
  return useMutation({
    mutationFn: (userId: string | null) => {
      if (!userId) throw new Error('User ID is required');

      return apiClient<{ success: boolean }>(`/api/admin/users/${userId}/send-contact-card`, {
        method: 'POST',
        headers: adminHeaders(key!),
      });
    },
  });
}

export function useAdminMatches(
  adminKey: string | null,
  status: string,
  sort: string,
  order: string,
  refetchInterval?: number | false,
) {
  return useInfiniteQuery({
    retry: false,
    enabled: !!adminKey,
    refetchInterval: refetchInterval || false,
    ...(refetchInterval ? { structuralSharing: false } : {}),
    queryKey: ['admin', 'matches', status, sort, order],
    queryFn: ({ pageParam }) => {
      return apiClient<PaginatedResponse<AdminMatch>>(
        `/api/admin/matches?status=${status}&sort=${sort}&order=${order}&page=${pageParam}`,
        { headers: adminHeaders(adminKey!) },
      );
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const totalPages = Math.ceil(lastPage.total / lastPage.limit);
      return lastPage.page < totalPages ? lastPage.page + 1 : undefined;
    },
  });
}

export function useApproveMatch(adminKey: string | null) {
  return useMutation({
    mutationFn: (matchId: string) => {
      if (!adminKey) throw new Error('Admin key is required');
      return apiClient<AdminMatch>(`/api/admin/matches/${matchId}/approve`, {
        method: 'POST',
        headers: adminHeaders(adminKey),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'matches'] });
    },
  });
}

export function useRejectMatch(adminKey: string | null) {
  return useMutation({
    mutationFn: (matchId: string) => {
      if (!adminKey) throw new Error('Admin key is required');
      return apiClient<{ id: string; status: string }>(`/api/admin/matches/${matchId}/reject`, {
        method: 'POST',
        headers: adminHeaders(adminKey),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'matches'] });
    },
  });
}

export function useForceTriggerMatching(adminKey: string | null) {
  return useMutation({
    mutationFn: (userId: string | null) => {
      if (!adminKey) throw new Error('Admin key is required');
      if (!userId) throw new Error('User ID is required');

      return apiClient<{ userId: string; candidates: number; created: number }>(
        `/api/admin/matching/refresh/${userId}`,
        { method: 'POST', headers: adminHeaders(adminKey) },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'matches'] });
    },
  });
}

export function useCompatibilityCheck(adminKey: string | null) {
  return useMutation({
    mutationFn: ({ userAId, userBId }: { userAId: string; userBId: string }) => {
      if (!adminKey) throw new Error('Admin key is required');
      return apiClient<CompatibilityCheck>('/api/admin/introduce/check', {
        method: 'POST',
        body: { userAId, userBId },
        headers: adminHeaders(adminKey),
      });
    },
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
