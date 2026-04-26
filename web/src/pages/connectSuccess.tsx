import { CheckCircle2 } from 'lucide-react';

function connectedProvider() {
  const params = new URLSearchParams(window.location.search);
  const provider = params.get('provider');
  return provider === 'microsoft' ? 'microsoft' : provider === 'google' ? 'google' : null;
}

export default function ConnectSuccessPage() {
  const provider = connectedProvider();
  const title = provider ? `${provider} account connected` : 'account connected';

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6 py-16 bg-background text-foreground">
      <div className="w-full max-w-md">
        <CheckCircle2 className="w-10 h-10 text-primary mb-5" />

        <h1 className="text-3xl font-extrabold tracking-tight leading-tight mb-4">{title}</h1>

        <p className="text-muted-foreground leading-relaxed mb-8">
          you're all set. head back to iMessage and try asking{' '}
          <span className="text-foreground">"what's on today?"</span>,{' '}
          <span className="text-foreground">"am i free tomorrow afternoon?"</span>,{' '}
          <span className="text-foreground">"what's john's email?"</span>, or{' '}
          <span className="text-foreground">"what's on my task list?"</span>
        </p>

        <p className="text-xs text-muted-foreground">you can close this tab.</p>
      </div>
    </main>
  );
}
