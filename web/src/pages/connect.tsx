import { useEffect, useState } from 'react';
import { Calendar, CheckCircle2 } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '';

function ConnectLayout(props: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6 py-16 bg-background text-foreground">
      <div className="w-full max-w-md">{props.children}</div>
    </main>
  );
}

export default function ConnectPage() {
  const [token, setToken] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get('t'));
    setDenied(params.get('denied') === '1');
  }, []);

  if (denied) {
    return (
      <ConnectLayout>
        <h1 className="text-2xl font-bold tracking-tight mb-3">connection not granted</h1>
        <p className="text-muted-foreground leading-relaxed mb-8">
          you declined the consent screen. text the assistant "connect" to get a fresh link and try again.
        </p>
      </ConnectLayout>
    );
  }

  if (!token) {
    return (
      <ConnectLayout>
        <h1 className="text-2xl font-bold tracking-tight mb-3">missing link</h1>
        <p className="text-muted-foreground leading-relaxed">
          this connect link is invalid. text the assistant "connect" to get a fresh one.
        </p>
      </ConnectLayout>
    );
  }

  const startUrl = `${API_BASE}/api/auth/google/start?t=${encodeURIComponent(token)}`;

  return (
    <ConnectLayout>
      <p className="text-xs font-semibold text-primary uppercase tracking-[0.25em] mb-5">step 1 of 1</p>

      <h1 className="text-3xl font-extrabold tracking-tight leading-tight mb-4">connect your google calendar</h1>

      <p className="text-muted-foreground leading-relaxed mb-8">
        i'll be able to read your schedule, create events, reschedule, and flag conflicts. you'll still confirm before
        anything gets written. gmail comes in a future update.
      </p>

      <ul className="space-y-2 mb-10">
        <li className="flex items-start gap-3 text-sm text-muted-foreground">
          <CheckCircle2 className="w-4 h-4 mt-0.5 text-primary shrink-0" />
          <span>read and write calendar events</span>
        </li>
        <li className="flex items-start gap-3 text-sm text-muted-foreground">
          <CheckCircle2 className="w-4 h-4 mt-0.5 text-primary shrink-0" />
          <span>you confirm before anything sends or changes</span>
        </li>
        <li className="flex items-start gap-3 text-sm text-muted-foreground">
          <CheckCircle2 className="w-4 h-4 mt-0.5 text-primary shrink-0" />
          <span>revoke anytime from your google account</span>
        </li>
      </ul>

      <a
        href={startUrl}
        className="inline-flex items-center gap-2 h-12 px-6 rounded-xl bg-foreground text-background text-sm font-semibold tracking-tight hover:opacity-90 active:scale-[0.98] transition no-underline"
      >
        <Calendar className="w-4 h-4" />
        connect google calendar
      </a>
    </ConnectLayout>
  );
}
