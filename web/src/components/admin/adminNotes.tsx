import { useState, useCallback } from 'react';
import { Pencil, Save, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useAdminContext } from './context';
import type { AdminUser } from '@/api/types';
import { useUpdateAdminNotes } from '@/api/admin';

export function AdminNotes({ user }: { user: AdminUser }) {
  const adminContext = useAdminContext();
  const updateNotes = useUpdateAdminNotes(adminContext.adminKey);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const handleEdit = useCallback(() => {
    setDraft(user.adminNotes ?? '');
    setEditing(true);
  }, [user.adminNotes]);

  const handleCancel = useCallback(() => {
    setEditing(false);
  }, []);

  const handleSave = useCallback(() => {
    updateNotes.mutate({ userId: user.id, notes: draft }, { onSuccess: () => setEditing(false) });
  }, [updateNotes, user.id, draft]);

  if (editing) {
    return (
      <div className="mt-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoFocus
          rows={2}
          className="w-full p-2.5 rounded-lg bg-admin-surface border border-admin-border text-xs text-neutral-300 placeholder:text-neutral-600 outline-none focus:border-neutral-500 transition-colors resize-none"
          placeholder="Add notes about this user..."
        />
        <div className="flex justify-end gap-1.5 mt-1.5">
          <button
            onClick={handleCancel}
            disabled={updateNotes.isPending}
            className="px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1 bg-admin-border text-neutral-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-3 h-3" />
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={updateNotes.isPending}
            className={cn(
              'px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer',
              'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30',
            )}
          >
            <Save className="w-3 h-3" />
            {updateNotes.isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    );
  }

  const hasNotes = user.adminNotes && user.adminNotes.trim().length > 0;

  if (!hasNotes) {
    return (
      <button
        onClick={handleEdit}
        className="mt-3 cursor-pointer text-xs text-neutral-600 hover:text-neutral-400 transition-colors flex items-center gap-1"
      >
        <Pencil className="w-3 h-3" />
        Add admin notes
      </button>
    );
  }

  return (
    <button
      title="Edit notes"
      onClick={handleEdit}
      aria-label="Edit notes"
      className="mt-3 cursor-pointer text-neutral-600 hover:text-white"
    >
      <span className="text-xs font-medium mr-2">Admin Notes</span>
      <span className="text-xs text-neutral-300 whitespace-pre-wrap">{user.adminNotes}</span>
      <Pencil className="w-4 h-3 inline ml-1.5" />
    </button>
  );
}
