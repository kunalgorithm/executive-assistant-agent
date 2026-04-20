import { useCallback, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Loader2, Search, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { fullName } from './helpers';
import { useAdminContext } from './context';
import { useAdminUsers, useCompatibilityCheck, useStartIntroduction } from '@/api/admin';

export function IntroduceModeBar() {
  const adminContext = useAdminContext();

  const startIntro = useStartIntroduction(adminContext.adminKey);
  const compatCheck = useCompatibilityCheck(adminContext.adminKey);
  const { data: usersData } = useAdminUsers(adminContext.adminKey, adminContext.sort, adminContext.order);
  const allUsers = usersData?.pages.flatMap((p) => p.items) ?? [];

  const introSelectedUsers = allUsers.filter((u) => adminContext.selectedForIntro.has(u.id));
  const hasTwoSelected = adminContext.selectedForIntro.size === 2;

  const getSelectedIds = useCallback(() => {
    const ids = Array.from(adminContext.selectedForIntro);
    if (ids.length !== 2) return null;
    return { userAId: ids[0]!, userBId: ids[1]! };
  }, [adminContext.selectedForIntro]);

  // Reset stale compatibility results when selection changes
  useEffect(() => {
    compatCheck.reset();
    // oxlint-disable-next-line eslint-plugin-react-hooks/exhaustive-deps
  }, [adminContext.selectedForIntro]);

  const handleCheckCompatibility = useCallback(() => {
    const ids = getSelectedIds();
    if (!ids) return;
    compatCheck.mutate(ids);
  }, [getSelectedIds, compatCheck]);

  const handleGenerateDrafts = useCallback(() => {
    const ids = getSelectedIds();
    if (!ids) return;
    startIntro.mutate(ids, {
      onSuccess: (data) => {
        adminContext.setIntroduceMode(false);
        adminContext.setSelectedForIntro(new Set());
        adminContext.setTab('matches');
        adminContext.setMatchStatusFilter('drafting');
        adminContext.setSelectedMatchId(data.id);
      },
    });
    // oxlint-disable-next-line eslint-plugin-react-hooks/exhaustive-deps
  }, [getSelectedIds]);

  const compatibility = compatCheck.data;
  const hasWarnings = compatibility && compatibility.warnings.length > 0;

  return (
    <div className="border-b border-admin-border px-6 py-2 flex flex-col gap-2 bg-blue-500/5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs text-neutral-400">Select 2 users to introduce:</span>
          {introSelectedUsers.map((u) => (
            <span key={u.id} className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-xs font-medium">
              {fullName(u, u.phoneNumber)}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={adminContext.handleCancelIntroduce}
            className="px-3 py-1.5 rounded-lg text-neutral-400 text-xs font-medium hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-3 h-3 inline mr-1" />
            Cancel
          </button>
          {hasTwoSelected && (
            <button
              onClick={handleCheckCompatibility}
              disabled={compatCheck.isPending}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer bg-admin-surface text-neutral-300 hover:text-white"
            >
              {compatCheck.isPending ? (
                <Loader2 className="w-3 h-3 inline mr-1 animate-spin" />
              ) : (
                <Search className="w-3 h-3 inline mr-1" />
              )}
              Check Compatibility
            </button>
          )}
          <button
            onClick={handleGenerateDrafts}
            disabled={!hasTwoSelected || startIntro.isPending}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer',
              hasTwoSelected && !startIntro.isPending
                ? 'bg-blue-600 text-white hover:bg-blue-500'
                : 'bg-admin-surface text-neutral-600 cursor-not-allowed',
            )}
          >
            {startIntro.isPending ? 'Generating Drafts...' : 'Generate Drafts'}
          </button>
        </div>
      </div>

      {startIntro.isError && <span className="text-xs text-red-400">{(startIntro.error as Error).message}</span>}

      {compatibility && (
        <div className="flex flex-wrap items-center gap-3">
          {hasWarnings ? (
            compatibility.warnings.map((w, i) => (
              <span key={i} className="flex items-center gap-1 text-xs text-amber-400">
                <AlertTriangle className="w-3 h-3 shrink-0" />
                {w}
              </span>
            ))
          ) : (
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <CheckCircle className="w-3 h-3" />
              Compatible
            </span>
          )}

          {compatibility.similarityScore !== null && (
            <span
              className={cn(
                'text-xs font-mono px-1.5 py-0.5 rounded',
                compatibility.similarityScore >= 0.5
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-amber-500/10 text-amber-400',
              )}
            >
              Similarity: {(compatibility.similarityScore * 100).toFixed(0)}%
            </span>
          )}
        </div>
      )}
    </div>
  );
}
