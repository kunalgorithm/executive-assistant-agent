import { ArrowRight, Calendar, Mail, MessageCircle } from 'lucide-react';

const SAYLA_PHONE = import.meta.env.VITE_SAYLA_PHONE || '+14158663676';
const SMS_LINK = `sms:${SAYLA_PHONE}&body=${encodeURIComponent('hi 👋')}`;

const features = [
  { icon: Calendar, label: 'manage your calendar — create, reschedule, and cancel events from a text' },
  { icon: Mail, label: 'triage your inbox — summaries, drafts, and replies you confirm with a "yes"' },
  { icon: MessageCircle, label: 'lives in iMessage — no app, no dashboard, no new habit to form' },
];

export default function Landing() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6 py-16 bg-background text-foreground">
      <div className="w-full max-w-xl">
        <p className="text-xs font-semibold text-primary uppercase tracking-[0.25em] mb-5">executive assistant</p>

        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-[1.05] mb-5">
          your chief of staff, in iMessage.
        </h1>

        <p className="text-base md:text-lg text-muted-foreground leading-relaxed mb-10">
          text it like you would a person. it handles your calendar and email, confirms before sending anything, and
          gets out of the way.
        </p>

        <ul className="space-y-3 mb-12">
          {features.map((f) => (
            <li key={f.label} className="flex items-start gap-3 text-sm text-muted-foreground">
              <f.icon className="w-4 h-4 mt-0.5 text-primary shrink-0" />
              <span>{f.label}</span>
            </li>
          ))}
        </ul>

        <a
          href={SMS_LINK}
          className="inline-flex items-center gap-2 h-12 px-6 rounded-xl bg-foreground text-background text-sm font-semibold tracking-tight hover:opacity-90 active:scale-[0.98] transition no-underline"
        >
          get started
          <ArrowRight className="w-4 h-4" />
        </a>
      </div>
    </main>
  );
}
