import { LogOut } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useAdminUsers } from '@/api/admin';
import { type Tab, tabConfig, useAdminContext } from './context';

function TabButton(props: { tabKey: Tab; onClick?: () => void }) {
  const tab = tabConfig[props.tabKey];
  const adminContext = useAdminContext();

  const handleClick = () => {
    adminContext.setTab(props.tabKey);
    props.onClick?.();
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        'px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer',
        adminContext.tab === props.tabKey ? 'bg-admin-border text-white' : 'text-neutral-500 hover:text-neutral-300',
      )}
    >
      <tab.icon className="w-3 h-3 inline mr-1" />
      {tab.label}
    </button>
  );
}

export function AdminTopBar() {
  const adminContext = useAdminContext();

  const { data: usersData } = useAdminUsers(adminContext.adminKey, adminContext.sort, adminContext.order);

  return (
    <div className="border-b border-admin-border px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <h1 className="text-sm font-semibold text-neutral-300">executive assistant admin</h1>
        <div className="flex items-center gap-1 bg-admin-surface rounded-lg p-0.5">
          <TabButton tabKey="users" />
          <TabButton tabKey="analytics" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-neutral-600">{usersData?.pages[0]?.total ?? 0} users</span>
        <button
          onClick={adminContext.removeAdminKey}
          className="text-neutral-600 hover:text-neutral-300 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
