import { useState, useCallback, useMemo } from 'react';
import { Check, X, Clock, Send, MessageSquare, Info } from 'lucide-react';

import {
  useSendOptIn,
  useRejectMatch,
  useToggleOptIn,
  useAdminMatches,
  useApproveMatch,
  useUpdateDrafts,
  useSendGroupIntro,
  useAdminGroupConversation,
} from '@/api/admin';
import { cn } from '@/lib/utils';
import type { AdminMatch } from '@/api/types';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { MATCH_FILTER_TABS, useAdminContext, type MatchFilterTab } from './context';
import { fullName, introStatusColor, timeAgo, formatTimestamp } from '@/components/admin/helpers';

const FILTER_LABELS: Record<string, string> = {
  suggested: 'Suggested',
  drafting: 'Drafting',
  awaiting_opt_in: 'Awaiting Opt-In',
  ready: 'Ready',
  notified: 'Notified',
  rejected: 'Rejected',
  others: 'Others',
};

const OPT_IN_POLL_INTERVAL = 5000;

// --- Shared components ---

function ScoreBar({ label, value, color }: { label: string; value: number | null; color: string }) {
  const pct = Math.round((value ?? 0) * 100);
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-neutral-500 w-20 shrink-0">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-admin-surface overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-neutral-400 w-10 text-right">{pct}%</span>
    </div>
  );
}

function UserCard({ user }: { user: AdminMatch['userA'] }) {
  return (
    <div className="rounded-xl bg-admin-surface border border-admin-border p-4 space-y-2">
      <div>
        <div className="text-sm font-semibold text-white">{fullName(user)}</div>
        {user.title && <div className="text-xs text-neutral-400">{user.title}</div>}
      </div>
      {user.bio && <p className="text-xs text-neutral-500 line-clamp-3">{user.bio}</p>}
      {user.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {user.tags.map((tag) => (
            <span key={tag} className="px-2 py-0.5 rounded-full bg-admin-border text-neutral-400 text-[10px]">
              {tag}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-3 text-[10px] text-neutral-600">
        {user.primaryIntent && <span>Intent: {user.primaryIntent.replace(/_/g, ' ')}</span>}
        {user.timezone && <span>{user.timezone.split('/').pop()?.replace(/_/g, ' ')}</span>}
      </div>
    </div>
  );
}

function ErrorMessage({ error }: { error: Error | null }) {
  if (!error) return null;
  return <div className="text-xs text-red-400">{error.message || 'An error occurred'}</div>;
}

// --- Status-specific action panels ---

type ActionDetailProps = {
  match: AdminMatch;
  onStatusChange: (status: MatchFilterTab) => void;
};

function SuggestedActions({ match, onStatusChange }: ActionDetailProps) {
  const adminContext = useAdminContext();
  const approveMatch = useApproveMatch(adminContext.adminKey);
  const rejectMatch = useRejectMatch(adminContext.adminKey);

  return (
    <>
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={() =>
            approveMatch.mutate(match.id, {
              onSuccess: () => onStatusChange('drafting'),
            })
          }
          disabled={approveMatch.isPending}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-green-600 text-white text-sm font-medium hover:bg-green-500 transition-colors cursor-pointer disabled:opacity-50"
        >
          <Check className="w-4 h-4" />
          {approveMatch.isPending ? 'Approving...' : 'Approve'}
        </button>
        <button
          onClick={() =>
            rejectMatch.mutate(match.id, {
              onSuccess: () => adminContext.setSelectedMatchId(null),
            })
          }
          disabled={rejectMatch.isPending}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600/20 text-red-400 text-sm font-medium hover:bg-red-600/30 transition-colors cursor-pointer disabled:opacity-50"
        >
          <X className="w-4 h-4" />
          {rejectMatch.isPending ? 'Rejecting...' : 'Reject'}
        </button>
      </div>
      <ErrorMessage error={approveMatch.error ?? rejectMatch.error} />
    </>
  );
}

function DraftingActions({ match }: { match: AdminMatch }) {
  const adminContext = useAdminContext();
  const [draftA, setDraftA] = useState(match.draftMessageA ?? '');
  const [draftB, setDraftB] = useState(match.draftMessageB ?? '');
  const updateDrafts = useUpdateDrafts(adminContext.adminKey);
  const sendOptIn = useSendOptIn(adminContext.adminKey);

  const isDirty = draftA !== (match.draftMessageA ?? '') || draftB !== (match.draftMessageB ?? '');

  const handleSave = useCallback(() => {
    updateDrafts.mutate({ matchId: match.id, draftMessageA: draftA, draftMessageB: draftB });
  }, [updateDrafts, match.id, draftA, draftB]);

  const handleSendOptIn = useCallback(() => {
    if (isDirty) {
      updateDrafts.mutate(
        { matchId: match.id, draftMessageA: draftA, draftMessageB: draftB },
        { onSuccess: () => sendOptIn.mutate(match.id) },
      );
    } else {
      sendOptIn.mutate(match.id);
    }
  }, [isDirty, updateDrafts, sendOptIn, match.id, draftA, draftB]);

  return (
    <div className="space-y-4 pt-2">
      <div className="text-xs font-medium text-neutral-500">Introduction Drafts</div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-neutral-400">Message to</span>
            <span className="text-xs font-semibold text-white">{fullName(match.userA, match.userA.phoneNumber)}</span>
          </div>
          <textarea
            value={draftA}
            onChange={(e) => setDraftA(e.target.value)}
            rows={8}
            className="w-full p-3 rounded-xl bg-admin-surface border border-admin-border text-white text-sm outline-none focus:border-neutral-500 transition-colors"
          />
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-neutral-400">Message to</span>
            <span className="text-xs font-semibold text-white">{fullName(match.userB, match.userB.phoneNumber)}</span>
          </div>
          <textarea
            value={draftB}
            onChange={(e) => setDraftB(e.target.value)}
            rows={8}
            className="w-full p-3 rounded-xl bg-admin-surface border border-admin-border text-white text-sm outline-none focus:border-neutral-500 transition-colors"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isDirty && (
          <button
            onClick={handleSave}
            disabled={updateDrafts.isPending}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-admin-border text-neutral-300 hover:text-white transition-colors cursor-pointer"
          >
            {updateDrafts.isPending ? 'Saving...' : 'Save Drafts'}
          </button>
        )}
        <button
          onClick={handleSendOptIn}
          disabled={sendOptIn.isPending || !draftA.trim() || !draftB.trim()}
          className={cn(
            'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer',
            draftA.trim() && draftB.trim() && !sendOptIn.isPending
              ? 'bg-blue-600 text-white hover:bg-blue-500'
              : 'bg-admin-surface text-neutral-600 cursor-not-allowed',
          )}
        >
          <Send className="w-3 h-3 inline mr-1" />
          {sendOptIn.isPending ? 'Sending...' : 'Send Opt-In Requests'}
        </button>
      </div>

      <ErrorMessage error={sendOptIn.error ?? updateDrafts.error} />
    </div>
  );
}

function OptInToggle({
  match,
  user,
  optedIn,
  declined,
}: {
  match: AdminMatch;
  user: AdminMatch['userA'];
  optedIn: boolean;
  declined: boolean;
}) {
  const adminContext = useAdminContext();
  const toggleOptIn = useToggleOptIn(adminContext.adminKey);

  if (declined) {
    return (
      <span className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-red-500/10 text-red-400">
        <X className="w-3 h-3" />
        No
      </span>
    );
  }

  return (
    <button
      onClick={() => toggleOptIn.mutate({ matchId: match.id, userId: user.id, optedIn: !optedIn })}
      disabled={toggleOptIn.isPending}
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer',
        optedIn
          ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
          : 'bg-neutral-500/10 text-neutral-500 hover:bg-neutral-500/20',
      )}
    >
      {optedIn ? <Check className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
      {optedIn ? 'Yes' : 'Waiting'}
    </button>
  );
}

function AwaitingOptInActions({ match }: { match: AdminMatch }) {
  return (
    <div className="space-y-4 pt-2">
      <div className="text-xs font-medium text-neutral-500">Opt-In Status</div>
      <div className="space-y-2">
        {[
          { user: match.userA, optedIn: match.userAOptedIn, declined: match.userADeclined },
          { user: match.userB, optedIn: match.userBOptedIn, declined: match.userBDeclined },
        ].map(({ user, optedIn, declined }) => (
          <div
            key={user.id}
            className="flex items-center justify-between rounded-xl bg-admin-surface border border-admin-border px-4 py-3"
          >
            <div>
              <div className="text-sm text-white font-medium">{fullName(user, user.phoneNumber)}</div>
              <div className="text-xs text-neutral-600">{user.title || user.phoneNumber}</div>
            </div>
            <OptInToggle match={match} user={user} optedIn={optedIn} declined={declined} />
          </div>
        ))}
      </div>

      {/* Show drafts read-only */}
      {(match.draftMessageA || match.draftMessageB) && (
        <div className="space-y-3">
          <div className="text-xs font-medium text-neutral-500">Sent Messages</div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { user: match.userA, draft: match.draftMessageA },
              { user: match.userB, draft: match.draftMessageB },
            ].map(({ user, draft }) => (
              <div key={user.id} className="rounded-xl bg-admin-surface border border-admin-border p-3">
                <div className="text-xs font-medium text-neutral-400 mb-1">{fullName(user)}</div>
                <p className="text-xs text-neutral-500 whitespace-pre-wrap">{draft}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ReadyActions({ match }: { match: AdminMatch }) {
  const adminContext = useAdminContext();
  const sendGroupIntro = useSendGroupIntro(adminContext.adminKey);

  return (
    <div className="space-y-3 pt-2">
      <div className="text-xs font-medium text-neutral-500">Both users opted in</div>
      <button
        onClick={() => sendGroupIntro.mutate(match.id)}
        disabled={sendGroupIntro.isPending}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-green-600 text-white text-sm font-medium hover:bg-green-500 transition-colors cursor-pointer disabled:opacity-50"
      >
        <Send className="w-4 h-4" />
        {sendGroupIntro.isPending ? 'Sending...' : 'Send Group Intro'}
      </button>
      <ErrorMessage error={sendGroupIntro.error} />
    </div>
  );
}

function NotifiedInfo() {
  return (
    <div className="pt-2">
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500/10 text-blue-400">
        <Check className="w-3 h-3" />
        Group chat created
      </span>
    </div>
  );
}

// --- Group conversation panel ---

function GroupConversationPanel({ match }: { match: AdminMatch }) {
  const adminContext = useAdminContext();
  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useAdminGroupConversation(
    adminContext.adminKey,
    match.id,
  );

  const userNames: Record<string, string> = useMemo(
    () => ({
      [match.userA.id]: fullName(match.userA),
      [match.userB.id]: fullName(match.userB),
    }),
    [match.userA, match.userB],
  );

  const messages = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((p) => [...p.messages].reverse());
  }, [data]);

  const sentinelRef = useInfiniteScroll(hasNextPage, isFetchingNextPage, fetchNextPage);

  return (
    <div className="flex-1 min-h-0 overflow-auto flex flex-col-reverse p-3 gap-1.5">
      {isLoading && <div className="text-center text-neutral-500 text-sm py-8">loading...</div>}
      {!isLoading && messages.length === 0 && (
        <div className="text-center text-neutral-600 text-sm py-8">no group messages yet</div>
      )}

      {messages.map((msg, i) => {
        const olderMsg = messages[i + 1];
        const showTimestamp =
          !olderMsg || new Date(msg.createdAt).getTime() - new Date(olderMsg.createdAt).getTime() > 30 * 60 * 1000;

        const isUserA = msg.fromUserId === match.userA.id;
        const isUserB = msg.fromUserId === match.userB.id;
        const isSayla = !isUserA && !isUserB;

        return (
          <div key={msg.id}>
            {showTimestamp && (
              <div className="text-center text-[10px] text-neutral-600 py-1.5">{formatTimestamp(msg.createdAt)}</div>
            )}
            <div className={cn('flex', isUserB ? 'justify-end' : isSayla ? 'justify-center' : 'justify-start')}>
              <div
                className={cn(
                  'max-w-[80%] px-3 py-2 rounded-2xl text-[13px] leading-snug',
                  isUserA && 'bg-blue-500/20 border border-blue-400/25 text-blue-50 rounded-bl-md',
                  isUserB && 'bg-purple-500/20 border border-purple-400/25 text-purple-50 rounded-br-md',
                  isSayla && 'bg-emerald-500/15 border border-emerald-400/20 text-emerald-100 italic',
                )}
              >
                <div
                  className={cn(
                    'text-[10px] font-semibold',
                    isUserA && 'text-blue-300',
                    isUserB && 'text-purple-300',
                    isSayla && 'text-emerald-300',
                  )}
                >
                  {isSayla ? 'Sayla' : (userNames[msg.fromUserId!] ?? 'Unknown')}
                </div>
                {msg.content || (msg.mediaUrl ? '[media]' : '[empty]')}
              </div>
            </div>
          </div>
        );
      })}

      <div ref={sentinelRef} className="shrink-0">
        {isFetchingNextPage && (
          <div className="text-center text-xs text-neutral-500 py-2">loading older messages...</div>
        )}
      </div>
    </div>
  );
}

// --- Match detail panel ---

type DetailTab = 'details' | 'messages';

function MatchDetailContent({ match, onStatusChange }: ActionDetailProps) {
  const commonTags = match.userA.tags.filter((t) => match.userB.tags.includes(t));

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      {/* Score breakdown */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Score Breakdown</h3>
          <span className="text-lg font-bold text-white">{Math.round((match.score ?? 0) * 100)}%</span>
        </div>
        <ScoreBar label="Intent" value={match.intentScore} color="bg-blue-500" />
        <ScoreBar label="Similarity" value={match.similarityScore} color="bg-purple-500" />
      </div>

      {/* Match reason */}
      {match.matchReason && (
        <div className="rounded-xl bg-admin-surface border border-admin-border p-4">
          <div className="text-xs text-neutral-500 mb-1">Why this match</div>
          <p className="text-sm text-neutral-300">{match.matchReason}</p>
        </div>
      )}

      {/* User cards */}
      <div className="grid grid-cols-2 gap-4">
        <UserCard user={match.userA} />
        <UserCard user={match.userB} />
      </div>

      {/* Common tags */}
      {commonTags.length > 0 && (
        <div>
          <div className="text-xs text-neutral-500 mb-2">Common interests</div>
          <div className="flex flex-wrap gap-1">
            {commonTags.map((tag) => (
              <span key={tag} className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 text-[10px]">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Status-specific actions */}
      {match.status === 'suggested' && <SuggestedActions match={match} onStatusChange={onStatusChange} />}
      {match.status === 'drafting' && <DraftingActions key={match.id} match={match} />}
      {match.status === 'awaiting_opt_in' && <AwaitingOptInActions match={match} />}
      {match.status === 'ready' && <ReadyActions match={match} />}
      {match.status === 'notified' && <NotifiedInfo />}
    </div>
  );
}

function MatchDetail({ match, onStatusChange }: ActionDetailProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>('details');
  const hasGroupChat = match.status === 'notified';

  if (!hasGroupChat) {
    return <MatchDetailContent match={match} onStatusChange={onStatusChange} />;
  }

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
      {/* Tab bar */}
      <div className="shrink-0 border-b border-admin-border px-4 flex items-center gap-1">
        <button
          onClick={() => setActiveTab('details')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors cursor-pointer border-b-2',
            activeTab === 'details'
              ? 'border-white text-white'
              : 'border-transparent text-neutral-500 hover:text-neutral-300',
          )}
        >
          <Info className="w-3.5 h-3.5" />
          Details
        </button>
        <button
          onClick={() => setActiveTab('messages')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors cursor-pointer border-b-2',
            activeTab === 'messages'
              ? 'border-white text-white'
              : 'border-transparent text-neutral-500 hover:text-neutral-300',
          )}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Messages
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'details' ? (
        <MatchDetailContent match={match} onStatusChange={onStatusChange} />
      ) : (
        <GroupConversationPanel match={match} />
      )}
    </div>
  );
}

// --- Match list ---

function MatchList({ matches, selectedId }: { matches: AdminMatch[]; selectedId: string | null }) {
  const adminContext = useAdminContext();

  return (
    <div className="divide-y divide-admin-border">
      {matches.map((match) => (
        <button
          key={match.id}
          onClick={() => adminContext.setSelectedMatchId(match.id)}
          className={cn(
            'w-full px-4 py-3 text-left transition-colors cursor-pointer',
            selectedId === match.id ? 'bg-admin-surface' : 'hover:bg-admin-surface/50',
          )}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-white font-medium">{fullName(match.userA)}</span>
              <span className="text-neutral-600">x</span>
              <span className="text-white font-medium">{fullName(match.userB)}</span>
            </div>
            <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-medium', introStatusColor(match.status))}>
              {match.status}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-neutral-600">
            <span className="font-medium text-neutral-400">{Math.round((match.score ?? 0) * 100)}%</span>
            <span>{timeAgo(match.createdAt)}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

// --- Main tab ---

export default function MatchesTab() {
  const adminContext = useAdminContext();
  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useAdminMatches(
    adminContext.adminKey,
    adminContext.matchStatusFilter,
    'score',
    'desc',
    adminContext.matchStatusFilter === 'awaiting_opt_in' ? OPT_IN_POLL_INTERVAL : false,
  );

  const matches = data?.pages.flatMap((p) => p.items) ?? [];
  const selectedMatch = matches.find((m) => m.id === adminContext.selectedMatchId) ?? null;
  const sentinelRef = useInfiniteScroll(hasNextPage, isFetchingNextPage, fetchNextPage);

  const handleStatusChange = useCallback((newStatus: MatchFilterTab) => {
    adminContext.setMatchStatusFilter(newStatus);
    adminContext.setSelectedMatchId(null);
    // oxlint-disable-next-line eslint-plugin-react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex w-full h-full">
      {/* Left panel — match list */}
      <div className="w-100 shrink-0 border-r border-admin-border flex flex-col h-full">
        {/* Filter bar */}
        <div className="border-b border-admin-border px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-1 flex-wrap">
            {MATCH_FILTER_TABS.map((s) => (
              <button
                key={s}
                onClick={() => {
                  adminContext.setMatchStatusFilter(s);
                  adminContext.setSelectedMatchId(null);
                }}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer',
                  adminContext.matchStatusFilter === s
                    ? 'bg-admin-border text-white'
                    : 'text-neutral-500 hover:text-neutral-300',
                )}
              >
                {FILTER_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-auto">
          {isLoading && <div className="text-center text-neutral-500 text-sm py-12">loading matches...</div>}
          {!isLoading && matches.length === 0 && (
            <div className="text-center text-neutral-600 text-sm py-12">no matches found</div>
          )}
          {matches.length > 0 && <MatchList matches={matches} selectedId={adminContext.selectedMatchId} />}
          <div ref={sentinelRef} className="shrink-0">
            {isFetchingNextPage && <div className="text-center text-xs text-neutral-500 py-2">loading more...</div>}
          </div>
        </div>
      </div>

      {/* Right panel — match detail */}
      <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
        {selectedMatch ? (
          <MatchDetail match={selectedMatch} onStatusChange={handleStatusChange} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-neutral-600 text-sm">
            Select a match to view details
          </div>
        )}
      </div>
    </div>
  );
}
