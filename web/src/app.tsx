import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router';
import { NuqsAdapter } from 'nuqs/adapters/react-router/v7';

import { ApiProvider } from '@/api/queryClient';
import { LoadingSpinner } from '@/components/ui/loading';
import { ErrorBoundary } from '@/components/errorBoundary';

const indexPage = lazy(() => import('@/pages/index'));
const adminPage = lazy(() => import('@/pages/admin'));
const connectPage = lazy(() => import('@/pages/connect'));
const connectSuccessPage = lazy(() => import('@/pages/connectSuccess'));

export function App() {
  return (
    <ErrorBoundary featureName="Application">
      <ApiProvider>
        <Suspense fallback={<LoadingSpinner />}>
          <NuqsAdapter>
            <BrowserRouter>
              <Routes>
                <Route path="/" Component={indexPage} />
                <Route path="/admin" Component={adminPage} />
                <Route path="/connect" Component={connectPage} />
                <Route path="/connect/success" Component={connectSuccessPage} />
              </Routes>
            </BrowserRouter>
          </NuqsAdapter>
        </Suspense>
      </ApiProvider>
    </ErrorBoundary>
  );
}
