import { Activity, lazy, Suspense } from 'react';

import { LoginScreen } from '@/components/admin/login';
import { AdminTopBar } from '@/components/admin/topBar';
import { LoadingSpinner } from '@/components/ui/loading';
import { AdminProvider, useAdminContext } from '@/components/admin/context';

const UsersTab = lazy(() => import('@/components/admin/usersTab'));
const AnalyticsTab = lazy(() => import('@/components/admin/analyticsTab'));

function AdminContent() {
  const adminContext = useAdminContext();

  return (
    <>
      {!adminContext.adminKey ? (
        <LoginScreen />
      ) : (
        <div className="min-h-screen bg-admin-bg text-white">
          <AdminTopBar />

          <div className="flex h-[calc(100vh-49px)]">
            <Activity mode={adminContext.tab === 'users' ? 'visible' : 'hidden'}>
              <Suspense fallback={<LoadingSpinner />}>
                <UsersTab />
              </Suspense>
            </Activity>

            <Activity mode={adminContext.tab === 'analytics' ? 'visible' : 'hidden'}>
              <Suspense fallback={<LoadingSpinner />}>
                <AnalyticsTab />
              </Suspense>
            </Activity>
          </div>
        </div>
      )}
    </>
  );
}

export default function AdminPage() {
  return (
    <AdminProvider>
      <AdminContent />
    </AdminProvider>
  );
}
