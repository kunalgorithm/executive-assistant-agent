import type { SubmitEvent } from 'react';
import { useAdminContext } from './context';

function LoginForm() {
  const adminContext = useAdminContext();

  const onSubmit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const value = new FormData(e.currentTarget).get('key');
    if (!value || typeof value !== 'string' || !value.trim()) return;

    adminContext.setAdminKey(value.trim());
  };

  return (
    <form onSubmit={onSubmit}>
      <input
        type="password"
        name="key"
        placeholder="admin key"
        aria-label="Admin key"
        autoFocus
        className="w-full h-12 px-4 rounded-xl bg-admin-surface border border-admin-border text-white text-sm placeholder:text-neutral-600 outline-none focus:border-neutral-500 transition-colors"
      />
      <button
        type="submit"
        className="w-full h-12 mt-3 rounded-xl bg-white text-black text-sm font-semibold hover:bg-neutral-200 transition-colors cursor-pointer"
      >
        continue
      </button>
    </form>
  );
}

export function LoginScreen() {
  return (
    <div className="min-h-screen bg-admin-bg flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-white mb-2">admin</h1>
        <p className="text-sm text-neutral-500 mb-8">enter your admin key to continue</p>

        <LoginForm />
      </div>
    </div>
  );
}
