export function timeAgo(date: string | null): string {
  if (!date) return '—';
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const statusColors: Record<string, string> = {
  onboarding: 'bg-yellow-500/20 text-yellow-400',
  ready_to_match: 'bg-blue-500/20 text-blue-400',
  inactive: 'bg-neutral-500/20 text-neutral-400',
};

export function userStatusColor(status: string): string {
  return statusColors[status] || 'bg-neutral-500/20 text-neutral-400';
}

const introStatusColors: Record<string, string> = {
  suggested: 'bg-cyan-500/20 text-cyan-400',
  rejected: 'bg-red-500/20 text-red-400',
  drafting: 'bg-yellow-500/20 text-yellow-400',
  awaiting_opt_in: 'bg-orange-500/20 text-orange-400',
  ready: 'bg-green-500/20 text-green-400',
  notified: 'bg-blue-500/20 text-blue-400',
  active: 'bg-emerald-500/20 text-emerald-400',
  pending: 'bg-purple-500/20 text-purple-400',
  expired: 'bg-neutral-600/20 text-neutral-500',
  reported: 'bg-red-500/20 text-red-400',
};

export function introStatusColor(status: string): string {
  return introStatusColors[status] || 'bg-neutral-500/20 text-neutral-400';
}

export function fullName(
  user: { firstName: string | null; lastName: string | null },
  fallback?: string | null,
): string {
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || fallback || 'Unknown';
}

export function eventCategoryColor(event: string): string {
  if (event.startsWith('user_') || event === 'phone_linked' || event === 'onboarding_complete')
    return 'bg-blue-500/20 text-blue-400';
  if (event.startsWith('match_') || event.includes('opt_in') || event.includes('declined'))
    return 'bg-green-500/20 text-green-400';
  if (event.startsWith('introduction_') || event.startsWith('group_')) return 'bg-yellow-500/20 text-yellow-400';
  return 'bg-neutral-500/20 text-neutral-400';
}

export function formatTimestamp(date: string): string {
  return new Date(date).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
