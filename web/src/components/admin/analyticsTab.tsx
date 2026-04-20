import { ChevronDown, X } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useMemo, useRef, useState } from 'react';

import { cn } from '@/lib/utils';
import { useAdminUsers } from '@/api/admin';
import { useAdminContext } from './context';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { eventCategoryColor, fullName, timeAgo } from './helpers';
import type { AnalyticsEvent, AnalyticsFilters } from '@/api/types';
import { useAnalyticEvents, useAnalyticsEventTypes } from '@/api/events';

const ROW_HEIGHT = 52;

function FilterPill(props: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-admin-border text-xs text-neutral-300">
      {props.label}
      <button onClick={props.onRemove} className="hover:text-white cursor-pointer">
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

function MultiSelectDropdown(props: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-admin-surface text-xs text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
      >
        {props.label}
        {props.selected.length > 0 && (
          <span className="ml-1 px-1.5 py-0.5 rounded bg-blue-600 text-white text-[10px]">{props.selected.length}</span>
        )}
        <ChevronDown className={cn('w-3 h-3 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-56 max-h-60 overflow-y-auto rounded-lg bg-admin-surface border border-admin-border shadow-xl z-50">
          {props.options.length === 0 && <div className="px-3 py-2 text-xs text-neutral-500">No options</div>}

          {props.options.map((opt) => (
            <button
              key={opt}
              onClick={() => props.onToggle(opt)}
              className={cn(
                'w-full text-left px-3 py-1.5 text-xs hover:bg-admin-border/50 cursor-pointer transition-colors',
                props.selected.includes(opt) ? 'text-blue-400' : 'text-neutral-400',
              )}
            >
              <span className={cn('inline-block w-3 mr-2', props.selected.includes(opt) ? 'opacity-100' : 'opacity-0')}>
                *
              </span>
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function UserSearchDropdown(props: { selected: string[]; onToggle: (userId: string, name: string) => void }) {
  const adminContext = useAdminContext();
  const { data: usersData } = useAdminUsers(adminContext.adminKey, adminContext.sort, adminContext.order);
  const allUsers = useMemo(() => usersData?.pages.flatMap((p) => p.items) ?? [], [usersData]);

  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    return allUsers.filter((u) => {
      const name = fullName(u, '').toLowerCase();
      return name.includes(query) || u.id.includes(query);
    });
  }, [allUsers, search]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-admin-surface text-xs text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
      >
        Users
        {props.selected.length > 0 && (
          <span className="ml-1 px-1.5 py-0.5 rounded bg-blue-600 text-white text-[10px]">{props.selected.length}</span>
        )}
        <ChevronDown className={cn('w-3 h-3 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-64 rounded-lg bg-admin-surface border border-admin-border shadow-xl z-50">
          <div className="p-2 border-b border-admin-border">
            <input
              type="text"
              value={search}
              placeholder="Search users..."
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-2 py-1 rounded bg-admin-bg text-xs text-neutral-300 placeholder-neutral-600 outline-none"
            />
          </div>

          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 && <div className="px-3 py-2 text-xs text-neutral-500">No users found</div>}
            {filtered.map((u) => (
              <button
                key={u.id}
                onClick={() => props.onToggle(u.id, fullName(u))}
                className={cn(
                  'w-full text-left px-3 py-1.5 text-xs hover:bg-admin-border/50 cursor-pointer transition-colors',
                  props.selected.includes(u.id) ? 'text-blue-400' : 'text-neutral-400',
                )}
              >
                {fullName(u, u.phoneNumber)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MetadataFields(props: { metadata: unknown }) {
  if (!props.metadata || typeof props.metadata !== 'object') return null;
  const entries = Object.entries(props.metadata as Record<string, unknown>);
  if (entries.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
      {entries.map(([key, value]) => (
        <span key={key} className="text-[10px]">
          <span className="text-neutral-600">{key}: </span>
          <span className="text-neutral-400">{String(value ?? '—')}</span>
        </span>
      ))}
    </div>
  );
}

function EventRow(props: { event: AnalyticsEvent; onUserClick: () => void }) {
  return (
    <div className="flex items-start gap-3 px-4 py-2 border-b border-admin-border/50 hover:bg-admin-surface/30">
      <div className="shrink-0 w-44 mt-1">
        <span className={cn('px-2 py-1 rounded text-[10px] font-medium', eventCategoryColor(props.event.event))}>
          {props.event.event}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {props.event.userId ? (
            <button
              onClick={props.onUserClick}
              className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer truncate"
            >
              {fullName(props.event.user, props.event.user.phoneNumber || props.event.userId?.slice(0, 8))}
            </button>
          ) : null}
          <span className="text-[10px] text-neutral-600 shrink-0">{timeAgo(props.event.createdAt)}</span>
        </div>

        <MetadataFields metadata={props.event.metadata} />
      </div>
    </div>
  );
}

function FiltersBar(props: {
  filters: AnalyticsFilters;
  setFilters: (f: AnalyticsFilters) => void;
  userNames: Record<string, string>;
}) {
  const adminContext = useAdminContext();
  const { data: eventTypes } = useAnalyticsEventTypes(adminContext.adminKey);

  const hasFilters =
    (props.filters.events?.length ?? 0) > 0 ||
    (props.filters.userIds?.length ?? 0) > 0 ||
    props.filters.after ||
    props.filters.before;

  return (
    <div className="sticky top-0 z-10 bg-admin-bg border-b border-admin-border px-4 py-2 flex flex-wrap items-center gap-2">
      <MultiSelectDropdown
        label="Events"
        options={eventTypes ?? []}
        selected={props.filters.events ?? []}
        onToggle={(event) => {
          const current = props.filters.events ?? [];
          const next = current.includes(event) ? current.filter((e) => e !== event) : [...current, event];
          props.setFilters({ ...props.filters, events: next.length > 0 ? next : undefined });
        }}
      />

      <UserSearchDropdown
        selected={props.filters.userIds ?? []}
        onToggle={(userId) => {
          const current = props.filters.userIds ?? [];
          const next = current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId];
          props.setFilters({ ...props.filters, userIds: next.length > 0 ? next : undefined });
        }}
      />

      <input
        type="datetime-local"
        value={props.filters.after ? props.filters.after.slice(0, 16) : ''}
        onChange={(e) =>
          props.setFilters({
            ...props.filters,
            after: e.target.value ? new Date(e.target.value).toISOString() : undefined,
          })
        }
        className="px-2 py-1 rounded-lg bg-admin-surface text-xs text-neutral-400 outline-none"
        placeholder="After"
      />

      <input
        type="datetime-local"
        value={props.filters.before ? props.filters.before.slice(0, 16) : ''}
        onChange={(e) =>
          props.setFilters({
            ...props.filters,
            before: e.target.value ? new Date(e.target.value).toISOString() : undefined,
          })
        }
        className="px-2 py-1 rounded-lg bg-admin-surface text-xs text-neutral-400 outline-none"
        placeholder="Before"
      />

      {hasFilters && (
        <button
          onClick={() => props.setFilters({})}
          className="px-2 py-1 rounded-lg text-xs text-neutral-500 hover:text-neutral-300 cursor-pointer"
        >
          Clear all
        </button>
      )}

      {/* Active filter pills */}
      <div className="flex flex-wrap gap-1 ml-2">
        {props.filters.events?.map((e) => (
          <FilterPill
            key={e}
            label={e}
            onRemove={() => {
              const next = props.filters.events!.filter((ev) => ev !== e);
              props.setFilters({ ...props.filters, events: next.length > 0 ? next : undefined });
            }}
          />
        ))}

        {props.filters.userIds?.map((id) => (
          <FilterPill
            key={id}
            label={props.userNames[id] || id.slice(0, 8)}
            onRemove={() => {
              const next = props.filters.userIds!.filter((uid) => uid !== id);
              props.setFilters({ ...props.filters, userIds: next.length > 0 ? next : undefined });
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function AnalyticsTab() {
  const adminContext = useAdminContext();
  const [filters, setFilters] = useState<AnalyticsFilters>({});

  // Apply prefilter from context on mount
  useEffect(() => {
    if (adminContext.analyticsPrefilter) {
      setFilters(adminContext.analyticsPrefilter);
      adminContext.setAnalyticsPrefilter(null);
    }
    // oxlint-disable-next-line eslint-plugin-react-hooks/exhaustive-deps
  }, []);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useAnalyticEvents(
    adminContext.adminKey,
    filters,
  );

  // Flatten pages
  const allEvents = useMemo(() => data?.pages.flatMap((p) => p.events) ?? [], [data]);
  const userNames = useMemo(() => {
    const names: Record<string, string> = {};
    for (const page of data?.pages ?? []) {
      Object.assign(names, page.users);
    }
    return names;
  }, [data]);

  const parentRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useInfiniteScroll(hasNextPage, isFetchingNextPage, fetchNextPage);
  const virtualizer = useVirtualizer({
    count: allEvents.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  const handleUserClick = (userId: string) => {
    adminContext.setTab('users');
    adminContext.setSelectedUserId(userId);
  };

  return (
    <div className="flex flex-col w-full h-full">
      <FiltersBar filters={filters} setFilters={setFilters} userNames={userNames} />

      <div ref={parentRef} className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="flex flex-col gap-0">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-admin-border/50">
                <div className="w-24 h-4 rounded bg-admin-surface animate-pulse" />
                <div className="w-20 h-3 rounded bg-admin-surface animate-pulse" />
                <div className="w-12 h-3 rounded bg-admin-surface animate-pulse" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && allEvents.length === 0 && (
          <div className="flex items-center justify-center h-full text-sm text-neutral-600">No events found</div>
        )}

        {!isLoading && allEvents.length > 0 && (
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const event = allEvents[virtualRow.index]!;
              return (
                <div
                  key={event.id}
                  className="absolute top-0 left-0 w-full"
                  style={{ transform: `translateY(${virtualRow.start}px)` }}
                >
                  <EventRow event={event} onUserClick={() => event.userId && handleUserClick(event.userId)} />
                </div>
              );
            })}
          </div>
        )}

        <div ref={sentinelRef} className="shrink-0">
          {isFetchingNextPage && <div className="px-4 py-3 text-xs text-neutral-600 text-center">Loading more...</div>}
        </div>
      </div>
    </div>
  );
}
