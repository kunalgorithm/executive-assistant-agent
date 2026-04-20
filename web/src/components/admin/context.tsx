import { useState, useContext, createContext, type Dispatch, type SetStateAction, type PropsWithChildren } from 'react';
import { parseAsStringEnum, useQueryState } from 'nuqs';
import { Activity, type LucideIcon, Users } from 'lucide-react';

import type { AnalyticsFilters } from '@/api/types';

const STORAGE_KEY = 'admin_key';

type AdminKey = string | null;

// oxlint-disable-next-line react/only-export-components
export const TABS = ['users', 'analytics'] as const;
const tabEnum = parseAsStringEnum(TABS.map((t) => t));
export type Tab = (typeof TABS)[number];

// oxlint-disable-next-line react/only-export-components
export const tabConfig: Record<Tab, { label: string; icon: LucideIcon }> = {
  users: { label: 'Users', icon: Users },
  analytics: { label: 'Analytics', icon: Activity },
};

type Order = 'asc' | 'desc';

type AdminContextType = {
  adminKey: AdminKey;
  setAdminKey: Dispatch<SetStateAction<AdminKey>>;

  tab: Tab;
  setTab: Dispatch<SetStateAction<Tab>>;

  sort: string;
  setSort: Dispatch<SetStateAction<string>>;

  order: Order;
  setOrder: Dispatch<SetStateAction<Order>>;

  selectedUserId: string | null;
  setSelectedUserId: Dispatch<SetStateAction<string | null>>;

  analyticsPrefilter: AnalyticsFilters | null;
  setAnalyticsPrefilter: Dispatch<SetStateAction<AnalyticsFilters | null>>;
};

const adminContextData: AdminContextType = {
  adminKey: localStorage.getItem(STORAGE_KEY) || null,
  setAdminKey: () => {},

  tab: 'users',
  setTab: () => {},

  sort: 'lastMessageAt',
  setSort: () => {},

  order: 'desc',
  setOrder: () => {},

  selectedUserId: null,
  setSelectedUserId: () => {},

  analyticsPrefilter: null,
  setAnalyticsPrefilter: () => {},
};

const adminContext = createContext<AdminContextType>(adminContextData);

export function AdminProvider(props: PropsWithChildren) {
  const [sort, setSort] = useState(adminContextData.sort);
  const [order, setOrder] = useState<Order>(adminContextData.order);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [adminKey, setAdminKey] = useState<AdminKey>(adminContextData.adminKey);
  const [tab, setTab] = useQueryState<Tab>('tab', tabEnum.withDefault(adminContextData.tab));
  const [analyticsPrefilter, setAnalyticsPrefilter] = useState<AnalyticsFilters | null>(null);

  return (
    <adminContext.Provider
      value={{
        adminKey,
        setAdminKey,
        tab,
        setTab,
        sort,
        setSort,
        order,
        setOrder,
        selectedUserId,
        setSelectedUserId,
        analyticsPrefilter,
        setAnalyticsPrefilter,
      }}
    >
      {props.children}
    </adminContext.Provider>
  );
}

// oxlint-disable-next-line react/only-export-components
export function useAdminContext() {
  const context = useContext(adminContext);
  if (!context) throw new Error('useAdminContext must be used within an AdminProvider');

  const setAdminKey = (key: string) => {
    context.setAdminKey(key);
    localStorage.setItem(STORAGE_KEY, key);
  };

  const removeAdminKey = () => {
    context.setAdminKey(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  return {
    ...context,
    setAdminKey,
    removeAdminKey,
  };
}
