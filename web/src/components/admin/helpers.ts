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

export function fullName(
  user: { firstName: string | null; lastName: string | null },
  fallback?: string | null,
): string {
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || fallback || 'Unknown';
}

export function eventCategoryColor(event: string): string {
  if (event.startsWith('user_')) return 'bg-blue-500/20 text-blue-400';
  if (event.startsWith('ai_')) return 'bg-yellow-500/20 text-yellow-400';
  if (event.startsWith('admin_')) return 'bg-green-500/20 text-green-400';
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
