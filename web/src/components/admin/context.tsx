import {
  useState,
  useContext,
  useCallback,
  createContext,
  type Dispatch,
  type SetStateAction,
  type PropsWithChildren,
} from 'react';
import { parseAsStringEnum, useQueryState } from 'nuqs';
import { Activity, type LucideIcon, Users, Sparkles } from 'lucide-react';

import type { AnalyticsFilters } from '@/api/types';

const STORAGE_KEY = 'admin_key';

type AdminKey = string | null;

// oxlint-disable-next-line react/only-export-components
export const TABS = ['users', 'matches', 'analytics'] as const;
const tabEnum = parseAsStringEnum(TABS.map((t) => t));
export type Tab = (typeof TABS)[number];

// oxlint-disable-next-line react/only-export-components
export const MATCH_FILTER_TABS = [
  'suggested',
  'drafting',
  'awaiting_opt_in',
  'ready',
  'notified',
  'rejected',
  'others',
] as const;
const matchFilterTabStringEnum = parseAsStringEnum(MATCH_FILTER_TABS.map((t) => t));
export type MatchFilterTab = (typeof MATCH_FILTER_TABS)[number];

// oxlint-disable-next-line react/only-export-components
export const tabConfig: Record<Tab, { label: string; icon: LucideIcon }> = {
  users: { label: 'Users', icon: Users },
  matches: { label: 'Matches', icon: Sparkles },
  analytics: { label: 'Analytics', icon: Activity },
};

type Order = 'asc' | 'desc';

type AdminContextType = {
  adminKey: AdminKey;
  setAdminKey: Dispatch<SetStateAction<AdminKey>>;

  tab: Tab;
  setTab: Dispatch<SetStateAction<Tab>>;

  matchStatusFilter: MatchFilterTab;
  setMatchStatusFilter: Dispatch<SetStateAction<MatchFilterTab>>;

  introduceMode: boolean;
  setIntroduceMode: Dispatch<SetStateAction<boolean>>;

  selectedForIntro: Set<string>;
  setSelectedForIntro: Dispatch<SetStateAction<Set<string>>>;

  sort: string;
  setSort: Dispatch<SetStateAction<string>>;

  order: Order;
  setOrder: Dispatch<SetStateAction<Order>>;

  selectedUserId: string | null;
  setSelectedUserId: Dispatch<SetStateAction<string | null>>;

  selectedMatchId: string | null;
  setSelectedMatchId: Dispatch<SetStateAction<string | null>>;

  analyticsPrefilter: AnalyticsFilters | null;
  setAnalyticsPrefilter: Dispatch<SetStateAction<AnalyticsFilters | null>>;
};

const adminContextData: AdminContextType = {
  adminKey: localStorage.getItem(STORAGE_KEY) || null,
  setAdminKey: () => {},

  tab: 'users',
  setTab: () => {},

  matchStatusFilter: 'suggested',
  setMatchStatusFilter: () => {},

  introduceMode: false,
  setIntroduceMode: () => {},

  selectedForIntro: new Set(),
  setSelectedForIntro: () => {},

  sort: 'lastMessageAt',
  setSort: () => {},

  order: 'desc',
  setOrder: () => {},

  selectedUserId: null,
  setSelectedUserId: () => {},

  selectedMatchId: null,
  setSelectedMatchId: () => {},

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
  const [introduceMode, setIntroduceMode] = useState(adminContextData.introduceMode);
  const [selectedForIntro, setSelectedForIntro] = useState<Set<string>>(adminContextData.selectedForIntro);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [analyticsPrefilter, setAnalyticsPrefilter] = useState<AnalyticsFilters | null>(null);
  const [matchStatusFilter, setMatchStatusFilter] = useQueryState(
    'match_status',
    matchFilterTabStringEnum.withDefault('suggested'),
  );

  return (
    <adminContext.Provider
      value={{
        adminKey,
        setAdminKey,
        tab,
        setTab,
        introduceMode,
        setIntroduceMode,
        selectedForIntro,
        setSelectedForIntro,
        sort,
        setSort,
        order,
        setOrder,
        selectedUserId,
        setSelectedUserId,
        selectedMatchId,
        setSelectedMatchId,
        analyticsPrefilter,
        setAnalyticsPrefilter,

        matchStatusFilter,
        setMatchStatusFilter,
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

  const handleCancelIntroduce = useCallback(() => {
    context.setIntroduceMode(false);
    context.setSelectedForIntro(new Set());
    // oxlint-disable-next-line eslint-plugin-react-hooks/exhaustive-deps
  }, []);

  return {
    ...context,
    setAdminKey,
    removeAdminKey,
    handleCancelIntroduce,
  };
}
