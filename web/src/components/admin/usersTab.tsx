import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Info,
  Activity,
  ArrowLeft,
  StickyNote,
  ArrowUpDown,
  ContactRound,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { useAdminContext } from './context';
import type { AdminUser } from '@/api/types';
import { Popover } from '@/components/ui/popover';
import { AdminNotes } from '@/components/admin/adminNotes';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { formatTimestamp, fullName, timeAgo, userStatusColor } from '@/components/admin/helpers';
import { useAdminUsers, useSendContactCard, useAdminConversation, useForceTriggerMatching } from '@/api/admin';

const userTableColumns = [
  { key: 'name', label: 'Name', sortable: false },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'lastMessageAt', label: 'Last Active', sortable: true },
  { key: 'createdAt', label: 'Created', sortable: true },
  { key: 'tags', label: 'Tags', sortable: false },
];

function UserTable({ users }: { users: AdminUser[] }) {
  const adminContext = useAdminContext();

  const handleSort = useCallback(
    (field: string) => {
      if (adminContext.sort === field) adminContext.setOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
      else {
        adminContext.setSort(field);
        adminContext.setOrder('desc');
      }
    },
    // oxlint-disable-next-line eslint-plugin-react-hooks/exhaustive-deps
    [adminContext.sort],
  );

  const handleToggleIntro = useCallback((userId: string) => {
    adminContext.setSelectedForIntro((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else if (next.size < 2) next.add(userId);

      return next;
    });
    // oxlint-disable-next-line eslint-plugin-react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-admin-border">
            {adminContext.introduceMode && <th className="w-10 py-3 px-4" />}
            {userTableColumns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'text-left py-3 px-4 text-xs font-medium text-neutral-500 uppercase tracking-wider',
                  col.sortable && 'cursor-pointer hover:text-neutral-300 select-none',
                )}
                onClick={() => col.sortable && handleSort(col.key)}
              >
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  {col.sortable && adminContext.sort === col.key && <ArrowUpDown className="w-3 h-3" />}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const isIntroSelected = adminContext.selectedForIntro.has(user.id);
            return (
              <tr
                key={user.id}
                onClick={() =>
                  adminContext.introduceMode ? handleToggleIntro(user.id) : adminContext.setSelectedUserId(user.id)
                }
                className={cn(
                  'border-b border-admin-border-subtle cursor-pointer transition-colors',
                  isIntroSelected
                    ? 'bg-blue-500/10 border-l-2 border-l-blue-500'
                    : adminContext.selectedUserId === user.id
                      ? 'bg-admin-surface'
                      : 'hover:bg-admin-hover',
                )}
              >
                {adminContext.introduceMode && (
                  <td className="py-3 px-4">
                    <input
                      readOnly
                      type="checkbox"
                      className="accent-blue-500"
                      checked={isIntroSelected ?? false}
                      aria-label="Select for introduction"
                    />
                  </td>
                )}
                <td className="py-3 px-4">
                  <div className="flex items-center gap-1.5">
                    <span className="text-white font-medium">{fullName(user, user.phoneNumber)}</span>
                    {user.adminNotes && <StickyNote className="w-3 h-3 text-yellow-500/60" />}
                  </div>
                  {user.firstName && user.phoneNumber && (
                    <div className="text-xs text-neutral-600">{user.phoneNumber}</div>
                  )}
                </td>
                <td className="py-3 px-4">
                  <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', userStatusColor(user.status))}>
                    {user.status}
                  </span>
                  {user.substatus && <div className="text-xs text-neutral-600 mt-0.5">{user.substatus}</div>}
                </td>
                <td className="py-3 px-4 text-neutral-500 text-xs">{timeAgo(user.lastMessageAt)}</td>
                <td className="py-3 px-4 text-neutral-500 text-xs">{timeAgo(user.createdAt)}</td>
                <td className="py-3 px-4">
                  <div className="flex flex-wrap gap-1 max-w-48">
                    {user.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="px-1.5 py-0.5 rounded bg-admin-surface text-xs text-neutral-400">
                        {tag}
                      </span>
                    ))}
                    {user.tags.length > 3 && <span className="text-xs text-neutral-600">+{user.tags.length - 3}</span>}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function UserInfoPopover({ user }: { user: AdminUser }) {
  const rows: { label: string; value: string | null | undefined }[] = [
    { label: 'Primary Intent', value: user.primaryIntent },
    { label: 'Title', value: user.title },
    { label: 'Bio', value: user.bio },
    { label: 'Email', value: user.email },
    { label: 'Phone', value: user.phoneNumber },
    { label: 'Timezone', value: user.timezone },
    { label: 'Status', value: [user.status, user.substatus].filter(Boolean).join(' / ') },
    { label: 'Check-ins', value: String(user.checkinCount) },
    { label: 'Last Check-in', value: user.lastCheckinAt ? formatTimestamp(user.lastCheckinAt) : null },
    { label: 'Last Message', value: user.lastMessageAt ? formatTimestamp(user.lastMessageAt) : null },
    { label: 'Created', value: formatTimestamp(user.createdAt) },
  ];

  const links: { label: string; url: string | null | undefined }[] = [
    { label: 'LinkedIn', url: user.linkedinUrl },
    { label: 'Twitter', url: user.twitterUrl },
    { label: 'Instagram', url: user.instagramUrl },
    { label: 'Website', url: user.websiteUrl },
  ].filter((l) => l.url);

  return (
    <Popover
      className="w-80 p-4 space-y-3"
      trigger={
        <button
          aria-label="View user info"
          className="p-1 rounded-lg text-neutral-400 hover:text-white transition-colors cursor-pointer bg-admin-border"
        >
          <Info className="w-3.5 h-3.5" />
        </button>
      }
    >
      <h3 className="text-sm font-semibold text-white">Extracted User Info</h3>

      <div className="space-y-1.5">
        {rows.map(
          (row) =>
            row.value &&
            (row.label === 'Title' || row.label === 'Bio' ? (
              <div key={row.label} className="text-xs mb-3">
                <span className="text-neutral-500">{row.label}</span>
                <p className="text-neutral-300 mt-0.5">{row.value}</p>
              </div>
            ) : (
              <div key={row.label} className="flex gap-2 text-xs">
                <span className="text-neutral-500 shrink-0 w-24">{row.label}</span>
                <span className="text-neutral-300 break-all">{row.value}</span>
              </div>
            )),
        )}
      </div>

      {user.tags.length > 0 && (
        <div>
          <span className="text-xs text-neutral-500">Tags</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {user.tags.map((tag) => (
              <span key={tag} className="px-1.5 py-0.5 rounded bg-neutral-800 text-xs text-neutral-400">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {links.length > 0 && (
        <div>
          <span className="text-xs text-neutral-500">Links</span>
          <div className="flex flex-wrap gap-2 mt-1">
            {links.map((link) => (
              <a
                key={link.label}
                href={link.url!}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
              >
                <ExternalLink className="w-3 h-3" />
                {link.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </Popover>
  );
}

function ConversationPanel({ users }: { users: AdminUser[] }) {
  const adminContext = useAdminContext();
  const user = users.find((u) => u.id === adminContext.selectedUserId);

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useAdminConversation(
    adminContext.adminKey,
    adminContext.selectedUserId,
  );

  // Pages come newest-first from the API; flatten in reverse-chronological order
  // for the column-reverse container (DOM child 0 = newest → rendered at bottom)
  const messages = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((p) => [...p.messages].reverse());
  }, [data]);

  const sendContactCard = useSendContactCard(adminContext.adminKey);
  const forceTriggerMatching = useForceTriggerMatching(adminContext.adminKey);
  const [contactCardSent, setContactCardSent] = useState(false);
  const sentinelRef = useInfiniteScroll(hasNextPage, isFetchingNextPage, fetchNextPage);

  // Reset when switching users
  useEffect(() => {
    setContactCardSent(false);
    forceTriggerMatching.reset();
    // oxlint-disable-next-line eslint-plugin-react-hooks/exhaustive-deps
  }, [adminContext.selectedUserId]);

  const handleSendContactCard = useCallback(() => {
    sendContactCard.mutate(adminContext.selectedUserId, {
      onSuccess: () => setContactCardSent(true),
    });
  }, [sendContactCard, adminContext.selectedUserId]);

  if (!user) {
    return <div className="flex items-center justify-center h-full text-neutral-500 text-sm">no data</div>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-admin-border px-4 py-2">
        {/* Top: name/phone/title + buttons side by side */}
        <div className="flex gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <button
                onClick={() => adminContext.setSelectedUserId(null)}
                aria-label="Close conversation"
                className="text-neutral-500 hover:text-white transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              <div className="min-w-0">
                <h2 className="text-white font-semibold">{fullName(user, user.phoneNumber)}</h2>
                <p className="text-xs text-neutral-500">{user.phoneNumber}</p>
              </div>
            </div>

            {user.title && <p className="text-xs text-neutral-400 mt-1">{user.title}</p>}
          </div>

          <div className="shrink-0 flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-2">
              <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', userStatusColor(user.status))}>
                {user.status}
              </span>
              <button
                onClick={() => {
                  adminContext.setAnalyticsPrefilter({ userIds: [adminContext.selectedUserId!] });
                  adminContext.setTab('analytics');
                }}
                className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1 bg-admin-border text-neutral-400 hover:text-white"
              >
                <Activity className="w-3 h-3" />
                View activity
              </button>
              <UserInfoPopover user={user} />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleSendContactCard}
                disabled={sendContactCard.isPending || contactCardSent}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1',
                  contactCardSent
                    ? 'bg-green-500/10 text-green-400'
                    : 'bg-admin-border text-neutral-400 hover:text-white',
                )}
              >
                <ContactRound className="w-3 h-3" />
                {sendContactCard.isPending ? 'Sending...' : contactCardSent ? 'Sent' : 'Send Contact Card'}
              </button>

              {user.status === 'ready_to_match' && (
                <button
                  onClick={() => forceTriggerMatching.mutate(adminContext.selectedUserId)}
                  disabled={forceTriggerMatching.isPending}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1',
                    forceTriggerMatching.isSuccess
                      ? 'bg-green-500/10 text-green-400'
                      : 'bg-admin-border text-neutral-400 hover:text-white',
                  )}
                >
                  <RefreshCw className={cn('w-3 h-3', forceTriggerMatching.isPending && 'animate-spin')} />
                  {forceTriggerMatching.isPending
                    ? 'Triggering...'
                    : forceTriggerMatching.isSuccess
                      ? `Found ${forceTriggerMatching.data.created} new`
                      : 'Force Trigger Matching'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Bottom: bio, tags, notes — full width */}
        {user.bio && <p className="text-xs text-neutral-500 mt-2">{user.bio}</p>}

        {user.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {user.tags.map((tag) => (
              <span key={tag} className="px-1.5 py-0.5 rounded bg-admin-surface text-xs text-neutral-400">
                {tag}
              </span>
            ))}
          </div>
        )}

        <AdminNotes user={user} />
      </div>

      {/* Messages — column-reverse for WhatsApp-like scroll */}
      <div className="flex-1 overflow-auto flex flex-col-reverse p-4 gap-2">
        {isLoading && <div className="text-center text-neutral-500 text-sm py-8">loading...</div>}
        {!isLoading && messages.length === 0 && (
          <div className="text-center text-neutral-600 text-sm py-8">no messages</div>
        )}

        {messages.map((msg, i) => {
          // In reverse-chronological order: msg at i is newer than msg at i+1
          const olderMsg = messages[i + 1];
          const isUser = msg.fromUserId === adminContext.selectedUserId;
          const showTimestamp =
            !olderMsg || new Date(msg.createdAt).getTime() - new Date(olderMsg.createdAt).getTime() > 30 * 60 * 1000;

          return (
            <div key={msg.id}>
              {showTimestamp && (
                <div className="text-center text-[11px] text-neutral-600 py-2">{formatTimestamp(msg.createdAt)}</div>
              )}
              <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[80%] px-4 py-2.5 rounded-[18px] text-[14px] leading-relaxed',
                    isUser
                      ? 'bg-admin-imessage text-white rounded-br-[6px]'
                      : 'bg-admin-surface border border-admin-border text-admin-imessage-recv rounded-bl-[6px]',
                  )}
                >
                  {msg.content || (msg.mediaUrl ? '[media]' : '[empty]')}
                </div>
              </div>
            </div>
          );
        })}

        {/* Sentinel — visually at the top (last in DOM due to column-reverse) */}
        <div ref={sentinelRef} className="shrink-0">
          {isFetchingNextPage && (
            <div className="text-center text-xs text-neutral-500 py-2">loading older messages...</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function UsersTab() {
  const adminContext = useAdminContext();

  const { data, isLoading, error, hasNextPage, fetchNextPage, isFetchingNextPage } = useAdminUsers(
    adminContext.adminKey,
    adminContext.sort,
    adminContext.order,
  );

  useEffect(() => {
    if (error) {
      adminContext.removeAdminKey();
      window.alert(
        'Failed to load users. Your admin key may be invalid or expired. Please enter a valid admin key to continue.',
      );
    }
    // oxlint-disable-next-line eslint-plugin-react-hooks/exhaustive-deps
  }, [error]);

  const users = data?.pages.flatMap((p) => p.items) ?? [];
  const sentinelRef = useInfiniteScroll(hasNextPage, isFetchingNextPage, fetchNextPage);

  return (
    <>
      <div
        className={cn(
          'border-r border-admin-border-subtle overflow-auto transition-all flex flex-col',
          adminContext.selectedUserId ? 'w-[45%]' : 'w-full',
        )}
      >
        <div className="flex-1 overflow-auto">
          {isLoading && <div className="text-center text-neutral-500 text-sm py-12">loading users...</div>}
          {!isLoading && users.length === 0 && (
            <div className="text-center text-neutral-600 text-sm py-12">no users yet</div>
          )}
          {users.length > 0 && <UserTable users={users} />}
          <div ref={sentinelRef} className="shrink-0">
            {isFetchingNextPage && <div className="text-center text-xs text-neutral-500 py-2">loading more...</div>}
          </div>
        </div>
      </div>

      {adminContext.selectedUserId && !adminContext.introduceMode && (
        <div className="flex-1">
          <ConversationPanel users={users} />
        </div>
      )}
    </>
  );
}
