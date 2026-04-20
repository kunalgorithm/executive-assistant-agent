import { useEffect, useState, type CSSProperties } from 'react';

const SAYLA_PHONE = import.meta.env.VITE_SAYLA_PHONE || '+14158663676';
const SMS_LINK = `sms:${SAYLA_PHONE}?body=${encodeURIComponent('Hey Sayla')}`;
const HOUSEHOLD_LINK = `sms:${SAYLA_PHONE}?body=${encodeURIComponent("I'm interested in Sayla Household.")}`;

type ThreadMessage = {
  sender: 'user' | 'sayla';
  text: string;
};

type UseCase = {
  eyebrow: string;
  title: string;
  description: string;
  messages: ThreadMessage[];
};

const heroMessages: ThreadMessage[] = [
  {
    sender: 'user',
    text: 'Tomorrow is a lot. Move my dentist, keep school pickup, and find somewhere nice for dinner with my parents on Friday.',
  },
  {
    sender: 'sayla',
    text: 'Done. Dentist is now Thursday at 3pm, school pickup stays put, and I booked dinner for Friday at 7:30. I sent the plan to your parents too.',
  },
  { sender: 'user', text: 'Perfect. Thank you.' },
  { sender: 'sayla', text: 'Happy to. 😌' },
];

const useCases: UseCase[] = [
  {
    eyebrow: 'Sort The Schedule',
    title: 'Untangle the day.',
    description:
      'Appointments, pickups, meetings, errands. When the day stops fitting together, Sayla helps you move the pieces without dropping anything important.',
    messages: [
      {
        sender: 'user',
        text: 'Wednesday is impossible. Keep the doctor and school pickup. Move everything else.',
      },
      {
        sender: 'sayla',
        text: 'Handled. I moved the haircut to Thursday, pushed lunch with Anna to Friday, and checked the plumber can still come after pickup. Want the full day sent over?',
      },
      { sender: 'user', text: 'Yes please.' },
      { sender: 'sayla', text: 'Sent. Tomorrow makes sense again. ✨' },
    ],
  },
  {
    eyebrow: 'Coordinate The People',
    title: 'Find a plan that actually works.',
    description:
      "Group dinners, family visits, birthday plans, shared calendars. Sayla does the back-and-forth and brings back a plan everyone's actually available for.",
    messages: [
      {
        sender: 'user',
        text: 'Can you find a dinner time next week that works for me, Nora, Sam, and my brother?',
      },
      {
        sender: 'sayla',
        text: 'Wednesday at 7:30 works for everyone. I booked a table for four at Trullo and sent the details to the group.',
      },
    ],
  },
  {
    eyebrow: 'Remember What Matters',
    title: 'Stop keeping it all in your head.',
    description:
      'Birthdays, renewals, forms, bills, passports, follow-ups. Sayla helps you remember the invisible things before they become stressful.',
    messages: [
      {
        sender: 'user',
        text: "Don't let me forget Mia's birthday, the rent, or my passport renewal.",
      },
      {
        sender: 'sayla',
        text: "Done. Mia's birthday gift reminder is set for Tuesday, rent is pinned for the 1st, and I'll nudge you two weeks before the passport paperwork is due.",
      },
    ],
  },
  {
    eyebrow: 'Plan The Trip',
    title: 'Text the destination. Get the plan.',
    description:
      'Weekends away, family visits, flights, trains, hotels, dinner reservations. Sayla plans the details and gives you back the trip, not the research.',
    messages: [
      {
        sender: 'user',
        text: 'Can you plan a weekend in Lisbon in June? Morning flight, walkable hotel, one really good dinner.',
      },
      {
        sender: 'sayla',
        text: 'Absolutely. I found the best Friday morning flight, a hotel in Chiado, and booked dinner at Prado for Saturday night. Itinerary is ready when you are.',
      },
    ],
  },
  {
    eyebrow: 'Handle The Life Admin',
    title: 'Get the annoying stuff done.',
    description:
      'Returns, repair appointments, service calls, deliveries, forms. The little tasks are rarely difficult. There are just too many of them. That is where Sayla helps.',
    messages: [
      {
        sender: 'user',
        text: 'Book the car service, schedule the internet repair, and remind me to return the blender.',
      },
      {
        sender: 'sayla',
        text: "Done. The car is booked for Friday morning, internet repair is set for Monday between 1 and 3, and I'll remind you about the blender tomorrow after lunch.",
      },
    ],
  },
  {
    eyebrow: 'Stay Ahead Of The Day',
    title: 'Know what matters this morning.',
    description:
      'Each morning, Sayla can send a simple brief: what is on, what needs attention, what has already been handled, and what you can safely ignore until later.',
    messages: [
      {
        sender: 'sayla',
        text: "Good morning. Here's today:\n\n📅 Dentist at 11:30, school pickup at 3:15\n📧 2 messages need a reply\n✅ Internet repair confirmed for Monday\n⚠️ Your train price is about to change - want me to book it now?",
      },
      { sender: 'user', text: 'Yes, book it.' },
      { sender: 'sayla', text: "Done. You're set. ☕" },
    ],
  },
];

const steps = [
  {
    title: 'Text Sayla like a person',
    description: "Start with the thing you don't want to carry in your head anymore. No special format. Just ask.",
  },
  {
    title: 'Connect the basics once',
    description:
      'Calendar, email, travel accounts, reminders. A short setup helps Sayla work with the tools you already use.',
  },
  {
    title: 'Get time back every week',
    description: 'The value is simple: fewer loose ends, fewer tabs, fewer things waiting in your head for later.',
  },
];

const pricingTiers = [
  {
    name: 'Sayla Personal',
    price: '$29/mo',
    description: 'For one person who wants less life admin and more breathing room.',
    features: [
      'Unlimited texts',
      'Scheduling, reminders, and follow-through',
      'Trips, reservations, and everyday planning',
      'Daily morning briefings',
    ],
    ctaLabel: 'Start free trial',
    ctaHref: SMS_LINK,
    featured: true,
  },
  {
    name: 'Sayla Household',
    price: '$79/mo',
    description: 'For couples and families coordinating more than one life at once.',
    features: [
      'Everything in Personal',
      'Shared planning for home and family',
      'Appointments, school, travel, and group coordination',
      'Multiple people in the loop',
    ],
    ctaLabel: 'Start with household',
    ctaHref: HOUSEHOLD_LINK,
    featured: false,
  },
];

const heroHighlights = ['Sort the schedule', 'Coordinate the people', 'Remember what matters', 'Handle the life admin'];
const lifeAreas = ['Schedules', 'Family', 'Friends', 'Trips', 'Errands', 'Birthdays'];

function revealStyle(delay: number): CSSProperties {
  return { transitionDelay: `${delay}ms` };
}

function ConversationMockup({
  messages,
  timestamp,
  compact = false,
  showTypingIndicator = false,
}: {
  messages: ThreadMessage[];
  timestamp: string;
  compact?: boolean;
  showTypingIndicator?: boolean;
}) {
  return (
    <div className={`imessage-shell${compact ? ' imessage-shell--compact' : ''}`}>
      <div className="imessage-shell__notch" aria-hidden="true" />
      <div className="imessage-shell__screen">
        <div className="imessage-shell__status">
          <span>9:41</span>
          <span>5G 100%</span>
        </div>

        <div className="imessage-shell__header">
          <span className="imessage-shell__back">Messages</span>

          <div className="imessage-shell__contact">
            <span className="imessage-shell__avatar">S</span>

            <span className="imessage-shell__contact-copy">
              <strong>Sayla</strong>
              <small>iMessage assistant</small>
            </span>
          </div>

          <span className="imessage-shell__info">•••</span>
        </div>

        <p className="imessage-shell__timestamp">{timestamp}</p>

        <div className="imessage-thread">
          {messages.map((message, index) => (
            <div className={`bubble-row bubble-row--${message.sender}`} key={`${message.sender}-${index}`}>
              <div className={`bubble bubble--${message.sender}`}>{message.text}</div>
            </div>
          ))}

          {showTypingIndicator ? (
            <div className="bubble-row bubble-row--sayla" aria-hidden="true">
              <div className="typing-bubble">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const pageStyles = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Instrument+Serif:ital,wght@0,400;1,400&display=swap');

:root {
  --sayla-bg: #1A1917;
  --sayla-ink: #171614;
  --sayla-cream: #F5F1EB;
  --sayla-cream-panel: #ECE3D7;
  --sayla-card: #211F1C;
  --sayla-card-soft: rgba(245, 241, 235, 0.035);
  --sayla-card-strong: rgba(245, 241, 235, 0.06);
  --sayla-border: rgba(255, 255, 255, 0.06);
  --sayla-border-strong: rgba(255, 255, 255, 0.12);
  --sayla-muted: rgba(245, 241, 235, 0.68);
  --sayla-muted-strong: rgba(245, 241, 235, 0.84);
  --sayla-accent: #8B9E8B;
  --sayla-accent-deep: #6F836F;
  --sayla-accent-soft: rgba(139, 158, 139, 0.16);
  --sayla-accent-glow: rgba(139, 158, 139, 0.18);
  --sayla-imessage-blue: #0A84FF;
  --sayla-imessage-recv: #ECE7DF;
  --sayla-radius: 32px;
  --sayla-max: 1100px;
  --sayla-ease: cubic-bezier(0.16, 1, 0.3, 1);
  --sayla-shadow: 0 28px 80px rgba(0, 0, 0, 0.28);
  --sayla-soft-shadow: 0 18px 60px rgba(0, 0, 0, 0.16);
}

html {
  scroll-behavior: smooth;
}

body {
  margin: 0;
  background: var(--sayla-bg);
  color: var(--sayla-cream);
  font-family: 'DM Sans', system-ui, sans-serif;
}

#root {
  min-height: 100vh;
}

.sayla-page {
  position: relative;
  min-height: 100vh;
  background: var(--sayla-bg);
  color: var(--sayla-cream);
  overflow: clip;
}

.sayla-page::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  opacity: 0.12;
  mix-blend-mode: soft-light;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23noise)' opacity='0.48'/%3E%3C/svg%3E");
  background-size: 220px 220px;
  z-index: 0;
}

.sayla-page::after {
  content: '';
  position: fixed;
  left: -10rem;
  bottom: -12rem;
  width: 32rem;
  height: 32rem;
  border-radius: 50%;
  background: rgba(139, 158, 139, 0.08);
  filter: blur(130px);
  pointer-events: none;
  z-index: 0;
}

.sayla-page > * {
  position: relative;
  z-index: 1;
}

.sayla-container {
  width: min(calc(100% - 2.5rem), var(--sayla-max));
  margin: 0 auto;
}

.sayla-nav {
  position: sticky;
  top: 0;
  z-index: 30;
  padding: 1.15rem 0;
  transition:
    background 220ms var(--sayla-ease),
    border-color 220ms var(--sayla-ease),
    box-shadow 220ms var(--sayla-ease);
}

.sayla-nav.is-scrolled {
  background: rgba(26, 25, 23, 0.78);
  border-bottom: 1px solid var(--sayla-border);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.12);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.sayla-nav__inner {
  width: min(calc(100% - 2.5rem), var(--sayla-max));
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.sayla-brand {
  color: var(--sayla-cream);
  text-decoration: none;
  font-family: 'Instrument Serif', Georgia, serif;
  font-size: 1.65rem;
  letter-spacing: -0.03em;
}

.sayla-nav__actions {
  display: flex;
  align-items: center;
  gap: 1.15rem;
}

.sayla-nav__link {
  color: var(--sayla-muted);
  text-decoration: none;
  font-size: 0.95rem;
  transition: color 180ms ease;
}

.sayla-nav__link:hover,
.sayla-footer__item:hover {
  color: var(--sayla-cream);
}

.sayla-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: 3.35rem;
  padding: 0 1.45rem;
  border-radius: 999px;
  border: 1px solid transparent;
  background: var(--sayla-accent);
  color: var(--sayla-cream);
  text-decoration: none;
  font-size: 0.98rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  transition:
    transform 220ms var(--sayla-ease),
    box-shadow 220ms var(--sayla-ease),
    background 220ms var(--sayla-ease);
}

.sayla-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 12px 36px rgba(139, 158, 139, 0.22);
}

.sayla-button--small {
  min-height: 2.65rem;
  padding: 0 1.1rem;
  font-size: 0.92rem;
}

.sayla-button--ghost {
  background: transparent;
  border-color: var(--sayla-border-strong);
  color: var(--sayla-cream);
}

.sayla-button--ghost:hover {
  background: rgba(255, 255, 255, 0.04);
  box-shadow: none;
}

[data-reveal] {
  opacity: 0;
  transform: translateY(28px);
  transition:
    opacity 700ms var(--sayla-ease),
    transform 700ms var(--sayla-ease);
}

[data-reveal].is-visible {
  opacity: 1;
  transform: translateY(0);
}

.sayla-hero {
  padding: 3.4rem 0 6.25rem;
}

.sayla-hero__layout {
  display: grid;
  grid-template-columns: minmax(0, 1.02fr) minmax(0, 0.98fr);
  gap: 4rem;
  align-items: center;
}

.sayla-hero__copy {
  position: relative;
}

.sayla-eyebrow {
  margin: 0 0 1.25rem;
  color: var(--sayla-accent);
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.24em;
  text-transform: uppercase;
}

.sayla-hero h1,
.sayla-section-head h2,
.sayla-scenario__title,
.sayla-quote,
.sayla-pricing__headline,
.sayla-cta__headline {
  margin: 0;
  font-family: 'Instrument Serif', Georgia, serif;
  font-weight: 400;
  letter-spacing: -0.04em;
}

.sayla-hero h1 {
  max-width: 9ch;
  font-size: clamp(4rem, 9vw, 6rem);
  line-height: 0.92;
  text-wrap: balance;
}

.sayla-hero__lede {
  max-width: 34rem;
  margin: 1.65rem 0 0;
  color: var(--sayla-muted-strong);
  font-size: 1.16rem;
  line-height: 1.75;
}

.sayla-hero__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem 1.15rem;
  margin-top: 2rem;
}

.sayla-hero__meta {
  width: 100%;
  margin: 0;
  color: var(--sayla-muted);
  font-size: 0.95rem;
}

.sayla-hero__details {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 1rem;
  align-items: end;
  margin-top: 2.35rem;
}

.sayla-hero__note {
  max-width: 25rem;
  padding: 1.35rem 1.4rem;
  border-radius: 24px;
  border: 1px solid var(--sayla-border);
  background: rgba(255, 255, 255, 0.018);
  box-shadow: var(--sayla-soft-shadow);
}

.sayla-hero__note-label {
  margin: 0;
  color: var(--sayla-accent);
  font-size: 0.76rem;
  font-weight: 600;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.sayla-hero__note-copy {
  margin: 0.8rem 0 0;
  color: var(--sayla-muted-strong);
  font-size: 1rem;
  line-height: 1.7;
}

.sayla-hero__signal-list {
  display: grid;
  gap: 0.65rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.sayla-hero__signal-list li {
  padding: 0.65rem 0 0;
  color: var(--sayla-muted);
  font-size: 0.86rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  border-top: 1px solid var(--sayla-border);
}

.sayla-phone-stage {
  position: relative;
  display: flex;
  justify-content: center;
  padding: 2rem 0 2rem 2rem;
}

.sayla-phone-stage::before {
  content: '';
  position: absolute;
  inset: 20% 8% 4% 22%;
  border-radius: 999px;
  background: radial-gradient(circle, var(--sayla-accent-glow) 0%, rgba(196, 120, 91, 0.05) 45%, transparent 72%);
  filter: blur(28px);
}

.sayla-phone-stage__arch {
  position: absolute;
  inset: 0.6rem 2.4rem 0.6rem 0.5rem;
  border-radius: 48% 52% 40% 60% / 30% 44% 56% 70%;
  border: 1px solid var(--sayla-border);
  background: rgba(255, 255, 255, 0.018);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.015);
}

.sayla-phone-stage::after {
  content: '';
  position: absolute;
  inset: 8% auto auto 4%;
  width: 9rem;
  height: 9rem;
  border-radius: 50%;
  border: 1px solid var(--sayla-border);
  opacity: 0.45;
}

.sayla-float-chip {
  position: absolute;
  z-index: 2;
  padding: 0.68rem 0.95rem;
  border-radius: 999px;
  border: 1px solid var(--sayla-border);
  background: rgba(26, 25, 23, 0.74);
  color: var(--sayla-cream);
  font-size: 0.78rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.sayla-float-chip--top {
  top: 0.5rem;
  left: 0;
}

.sayla-float-chip--bottom {
  right: 0;
  bottom: 1rem;
}

.imessage-shell {
  position: relative;
  width: min(100%, 430px);
  padding: 0.9rem;
  border-radius: 42px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: #efe9df;
  box-shadow: var(--sayla-shadow);
  transform: rotate(6deg);
  animation: floatPhone 8s var(--sayla-ease) infinite;
}

.imessage-shell--compact {
  width: 100%;
  max-width: 440px;
  padding: 0.75rem;
  transform: none;
  animation: none;
}

.imessage-shell__notch {
  width: 34%;
  height: 1.45rem;
  margin: 0 auto 0.8rem;
  border-radius: 999px;
  background: #151515;
}

.imessage-shell__screen {
  border-radius: 34px;
  padding: 0.9rem 0.95rem 1rem;
  background: #fcfaf7;
  color: var(--sayla-ink);
  font-family:
    -apple-system,
    BlinkMacSystemFont,
    'SF Pro Text',
    'DM Sans',
    sans-serif;
}

.imessage-shell__status,
.imessage-shell__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.imessage-shell__status {
  color: rgba(23, 22, 20, 0.62);
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.imessage-shell__header {
  gap: 0.75rem;
  margin-top: 0.85rem;
}

.imessage-shell__back,
.imessage-shell__info {
  color: rgba(10, 132, 255, 0.88);
  font-size: 0.82rem;
  white-space: nowrap;
}

.imessage-shell__contact {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  min-width: 0;
}

.imessage-shell__avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  background: rgba(196, 120, 91, 0.18);
  color: var(--sayla-accent);
  font-size: 0.9rem;
  font-weight: 700;
}

.imessage-shell__contact-copy {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.04rem;
  min-width: 0;
}

.imessage-shell__contact-copy strong {
  font-size: 0.93rem;
  letter-spacing: -0.01em;
}

.imessage-shell__contact-copy small {
  color: rgba(23, 22, 20, 0.54);
  font-size: 0.72rem;
}

.imessage-shell__timestamp {
  margin: 1rem 0 0.9rem;
  color: rgba(23, 22, 20, 0.44);
  font-size: 0.72rem;
  text-align: center;
}

.imessage-thread {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.bubble-row {
  display: flex;
}

.bubble-row--user {
  justify-content: flex-end;
}

.bubble-row--sayla {
  justify-content: flex-start;
}

.bubble {
  max-width: 82%;
  padding: 0.76rem 0.92rem 0.82rem;
  border-radius: 1.32rem;
  line-height: 1.38;
  font-size: 0.95rem;
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.22) inset;
  white-space: pre-line;
  text-wrap: pretty;
}

.bubble--user {
  background: var(--sayla-imessage-blue);
  color: white;
  border-bottom-right-radius: 0.45rem;
}

.bubble--sayla {
  background: var(--sayla-imessage-recv);
  color: var(--sayla-ink);
  border-bottom-left-radius: 0.45rem;
}

.typing-bubble {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.85rem 0.95rem;
  border-radius: 1.3rem;
  border-bottom-left-radius: 0.45rem;
  background: var(--sayla-imessage-recv);
}

.typing-dot {
  width: 0.42rem;
  height: 0.42rem;
  border-radius: 50%;
  background: rgba(23, 22, 20, 0.4);
  animation: typingPulse 1.6s infinite ease-in-out;
}

.typing-dot:nth-child(2) {
  animation-delay: 0.18s;
}

.typing-dot:nth-child(3) {
  animation-delay: 0.36s;
}

.sayla-proof,
.sayla-use-cases,
.sayla-how,
.sayla-testimonial,
.sayla-pricing,
.sayla-final {
  border-top: 1px solid var(--sayla-border);
}

.sayla-proof,
.sayla-use-cases,
.sayla-how,
.sayla-testimonial,
.sayla-pricing {
  padding: 5.5rem 0;
}

.sayla-proof__panel {
  padding: clamp(1.6rem, 3vw, 2.25rem);
  border-radius: calc(var(--sayla-radius) + 2px);
  border: 1px solid var(--sayla-border);
  background: rgba(255, 255, 255, 0.02);
}

.sayla-proof__line {
  margin: 0 0 1.5rem;
  color: var(--sayla-muted);
  font-size: 0.9rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.sayla-proof__logos {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 1rem;
}

.sayla-proof__logo {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 4.5rem;
  border-radius: 22px;
  border: 1px solid var(--sayla-border);
  color: rgba(245, 241, 235, 0.42);
  background: rgba(255, 255, 255, 0.015);
}

.sayla-proof__logo span {
  color: var(--sayla-muted-strong);
  font-size: 0.92rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.sayla-section-head {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
  gap: 2rem;
  align-items: end;
  margin-bottom: 3rem;
}

.sayla-section-head h2 {
  font-size: clamp(2.85rem, 5vw, 4.5rem);
  line-height: 0.96;
  text-wrap: balance;
}

.sayla-section-head p:last-child {
  margin: 0;
  max-width: 28rem;
  color: var(--sayla-muted);
  font-size: 1.05rem;
  line-height: 1.75;
}

.sayla-scenario-list {
  display: grid;
  gap: 1.5rem;
}

.sayla-scenario {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1.02fr) minmax(0, 0.98fr);
  gap: 2.4rem;
  align-items: center;
  padding: clamp(1.5rem, 3vw, 2.6rem);
  border-radius: var(--sayla-radius);
  border: 1px solid var(--sayla-border);
  background: var(--sayla-card-soft);
  box-shadow: var(--sayla-soft-shadow);
  overflow: hidden;
}

.sayla-scenario::before {
  content: '';
  position: absolute;
  top: 1.4rem;
  left: 1.4rem;
  width: 5rem;
  height: 5rem;
  border-radius: 50%;
  border: 1px solid var(--sayla-border);
  opacity: 0.28;
}

.sayla-scenario.is-light {
  background: var(--sayla-cream-panel);
  color: var(--sayla-ink);
  border-color: rgba(23, 22, 20, 0.08);
}

.sayla-scenario.is-light::before {
  border-color: rgba(23, 22, 20, 0.12);
}

.sayla-scenario.is-reversed .sayla-scenario__copy {
  order: 2;
}

.sayla-scenario.is-reversed .sayla-scenario__mockup {
  order: 1;
}

.sayla-scenario__copy {
  position: relative;
  z-index: 1;
  max-width: 29rem;
}

.sayla-scenario__index {
  display: inline-block;
  margin-bottom: 0.45rem;
  color: var(--sayla-accent);
  font-family: 'Instrument Serif', Georgia, serif;
  font-size: clamp(3rem, 7vw, 4.8rem);
  line-height: 0.85;
  letter-spacing: -0.05em;
}

.sayla-scenario__title {
  margin-top: 0.65rem;
  font-size: clamp(2.4rem, 4vw, 3.4rem);
  line-height: 0.98;
}

.sayla-scenario__description {
  margin: 1.15rem 0 0;
  color: var(--sayla-muted-strong);
  font-size: 1.05rem;
  line-height: 1.8;
}

.sayla-scenario.is-light .sayla-eyebrow {
  color: var(--sayla-accent-deep);
}

.sayla-scenario.is-light .sayla-scenario__description {
  color: rgba(23, 22, 20, 0.7);
}

.sayla-scenario__mockup {
  display: flex;
  justify-content: flex-end;
}

.sayla-scenario.is-reversed .sayla-scenario__mockup {
  justify-content: flex-start;
}

.sayla-how__panel {
  padding: clamp(2rem, 4vw, 3.5rem);
  border-radius: calc(var(--sayla-radius) + 8px);
  background: var(--sayla-cream-panel);
  color: var(--sayla-ink);
  box-shadow: 0 26px 72px rgba(0, 0, 0, 0.16);
}

.sayla-how__panel .sayla-eyebrow {
  color: var(--sayla-accent-deep);
}

.sayla-how__panel .sayla-section-head p:last-child {
  color: rgba(23, 22, 20, 0.68);
}

.sayla-how__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1.25rem;
}

.sayla-step {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 1rem;
  padding: 1.8rem;
  border-radius: 26px;
  border: 1px solid rgba(23, 22, 20, 0.08);
  background: rgba(23, 22, 20, 0.035);
}

.sayla-step__number {
  color: rgba(111, 131, 111, 0.9);
  font-family: 'Instrument Serif', Georgia, serif;
  font-size: 2.8rem;
  font-weight: 400;
  line-height: 1;
  letter-spacing: -0.05em;
}

.sayla-step h3 {
  margin: 0;
  font-size: 1.08rem;
  letter-spacing: -0.02em;
}

.sayla-step p {
  margin: 0.65rem 0 0;
  color: rgba(23, 22, 20, 0.68);
  line-height: 1.7;
}

.sayla-testimonial__wrap {
  max-width: 56rem;
  margin: 0 auto;
  text-align: center;
}

.sayla-testimonial__card {
  position: relative;
  padding: clamp(2rem, 4vw, 3.5rem);
  border-radius: calc(var(--sayla-radius) + 8px);
  border: 1px solid var(--sayla-border);
  background: rgba(255, 255, 255, 0.02);
  overflow: hidden;
}

.sayla-testimonial__card::before {
  content: '“';
  position: absolute;
  left: 1.6rem;
  top: 0.5rem;
  color: rgba(139, 158, 139, 0.24);
  font-family: 'Instrument Serif', Georgia, serif;
  font-size: 8rem;
  line-height: 1;
}

.sayla-quote {
  font-size: clamp(2.4rem, 5vw, 4.25rem);
  line-height: 1.04;
  font-style: italic;
  text-wrap: balance;
}

.sayla-quote__attribution {
  margin: 1.35rem 0 0;
  color: var(--sayla-muted);
  font-size: 0.95rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.sayla-pricing__headline {
  max-width: 9ch;
  font-size: clamp(2.85rem, 5vw, 4.4rem);
  line-height: 0.96;
}

.sayla-pricing__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.5rem;
  margin-top: 2.8rem;
}

.sayla-tier {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  padding: 2.25rem;
  border-radius: calc(var(--sayla-radius) + 4px);
  border: 1px solid var(--sayla-border);
  background: rgba(255, 255, 255, 0.02);
  box-shadow: var(--sayla-soft-shadow);
}

.sayla-tier.is-featured {
  background: rgba(139, 158, 139, 0.08);
  border-color: rgba(139, 158, 139, 0.32);
  transform: translateY(-0.6rem);
}

.sayla-tier__eyebrow {
  margin: 0;
  color: var(--sayla-muted);
  font-size: 0.82rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.sayla-tier__name {
  margin: 0.7rem 0 0;
  font-size: 1.6rem;
  letter-spacing: -0.03em;
}

.sayla-tier__price {
  margin: 0.35rem 0 0;
  font-family: 'Instrument Serif', Georgia, serif;
  font-size: 3.35rem;
  letter-spacing: -0.05em;
}

.sayla-tier__description {
  margin: 1rem 0 0;
  color: var(--sayla-muted);
  line-height: 1.7;
}

.sayla-tier__features {
  display: grid;
  gap: 0.95rem;
  margin: 1.6rem 0 2rem;
  padding: 0;
  list-style: none;
}

.sayla-tier__features li {
  padding-top: 0.95rem;
  border-top: 1px solid var(--sayla-border);
  color: var(--sayla-muted-strong);
  line-height: 1.65;
}

.sayla-tier__actions {
  margin-top: auto;
}

.sayla-final {
  padding: 5.5rem 0 2.25rem;
}

.sayla-cta {
  padding: clamp(2rem, 4vw, 3.5rem);
  border-radius: calc(var(--sayla-radius) + 10px);
  background: var(--sayla-cream);
  color: var(--sayla-ink);
  box-shadow: 0 24px 72px rgba(0, 0, 0, 0.18);
}

.sayla-cta__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
}

.sayla-cta__headline {
  max-width: 8ch;
  font-size: clamp(3rem, 6vw, 4.8rem);
  line-height: 0.92;
}

.sayla-cta__copy {
  margin: 1rem 0 0;
  color: rgba(23, 22, 20, 0.68);
  font-size: 1.08rem;
}

.sayla-footer {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem 1rem;
  padding: 1.75rem 0 0;
  color: var(--sayla-muted);
  font-size: 0.9rem;
}

.sayla-footer__item {
  color: inherit;
  text-decoration: none;
  transition: color 180ms ease;
}

@keyframes floatPhone {
  0%,
  100% {
    transform: translateY(0px) rotate(6deg);
  }

  50% {
    transform: translateY(-12px) rotate(5.2deg);
  }
}

@keyframes typingPulse {
  0%,
  80%,
  100% {
    opacity: 0.35;
    transform: translateY(0);
  }

  40% {
    opacity: 0.9;
    transform: translateY(-2px);
  }
}

@media (max-width: 1080px) {
  .sayla-hero__layout,
  .sayla-section-head,
  .sayla-scenario,
  .sayla-pricing__grid,
  .sayla-cta__inner {
    grid-template-columns: 1fr;
  }

  .sayla-hero__layout,
  .sayla-section-head,
  .sayla-scenario,
  .sayla-cta__inner {
    display: grid;
  }

  .sayla-phone-stage {
    padding-left: 0;
  }

  .sayla-hero__details {
    grid-template-columns: 1fr;
  }

  .sayla-scenario.is-reversed .sayla-scenario__copy,
  .sayla-scenario.is-reversed .sayla-scenario__mockup {
    order: initial;
  }

  .sayla-scenario__mockup,
  .sayla-scenario.is-reversed .sayla-scenario__mockup {
    justify-content: flex-start;
  }

  .sayla-cta__inner {
    gap: 1.5rem;
  }
}

@media (max-width: 820px) {
  .sayla-nav__link {
    display: none;
  }

  .sayla-proof__logos,
  .sayla-how__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .sayla-float-chip {
    display: none;
  }
}

@media (max-width: 640px) {
  .sayla-container,
  .sayla-nav__inner {
    width: min(calc(100% - 1.35rem), var(--sayla-max));
  }

  .sayla-hero {
    padding-top: 2.2rem;
  }

  .sayla-hero h1 {
    font-size: clamp(3.15rem, 14vw, 4.3rem);
  }

  .sayla-hero__lede,
  .sayla-scenario__description,
  .sayla-step p,
  .sayla-tier__description {
    font-size: 1rem;
  }

  .sayla-phone-stage::after {
    display: none;
  }

  .sayla-phone-stage__arch {
    inset: 1.1rem 0.8rem;
  }

  .imessage-shell {
    width: min(100%, 380px);
    transform: none;
    animation: none;
  }

  .sayla-tier.is-featured {
    transform: none;
  }

  .sayla-proof__logos,
  .sayla-how__grid,
  .sayla-pricing__grid {
    grid-template-columns: 1fr;
  }

  .sayla-step,
  .sayla-nav__inner {
    align-items: flex-start;
  }

  .sayla-footer {
    gap: 0.4rem 0.8rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }

  *,
  *::before,
  *::after {
    animation: none !important;
    transition-duration: 0.01ms !important;
    transition-delay: 0ms !important;
  }

  [data-reveal] {
    opacity: 1;
    transform: none;
  }
}
`;

export default function Landing() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setIsScrolled(window.scrollY > 12);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  useEffect(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      elements.forEach((element) => element.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.2, rootMargin: '0px 0px -8% 0px' },
    );

    elements.forEach((element) => observer.observe(element));

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <>
      <style>{pageStyles}</style>

      <main className="sayla-page" id="top">
        <header className={`sayla-nav${isScrolled ? ' is-scrolled' : ''}`}>
          <div className="sayla-nav__inner">
            <a className="sayla-brand" href="#top">
              Sayla
            </a>

            <div className="sayla-nav__actions">
              <a className="sayla-nav__link" href="#how-it-works">
                How it works
              </a>
              <a className="sayla-nav__link" href="#pricing">
                Pricing
              </a>
              <a className="sayla-button sayla-button--small" href={SMS_LINK}>
                Text Sayla
              </a>
            </div>
          </div>
        </header>

        <section className="sayla-hero">
          <div className="sayla-container sayla-hero__layout">
            <div className="sayla-hero__copy" data-reveal="true" style={revealStyle(0)}>
              <p className="sayla-eyebrow">For real life, not just work</p>
              <h1>The person you text when life has too many moving parts.</h1>
              <p className="sayla-hero__lede">
                Sayla lives in iMessage and helps with the things that pile up: rescheduling appointments, coordinating
                plans, remembering what matters, planning trips, and getting the life admin done.
              </p>

              <div className="sayla-hero__actions">
                <a className="sayla-button" href={SMS_LINK}>
                  Text Sayla →
                </a>
                <p className="sayla-hero__meta">No app to learn. No new system. Just text.</p>
              </div>

              <div className="sayla-hero__details">
                <div className="sayla-hero__note">
                  <p className="sayla-hero__note-label">The point is relief</p>
                  <p className="sayla-hero__note-copy">
                    Not another productivity system. Not another inbox. Just less mental clutter and more time back for
                    the parts of life you actually care about.
                  </p>
                </div>

                <ul className="sayla-hero__signal-list" aria-label="Common tasks">
                  {heroHighlights.map((highlight) => (
                    <li key={highlight}>{highlight}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="sayla-phone-stage" data-reveal="true" style={revealStyle(140)}>
              <div className="sayla-phone-stage__arch" aria-hidden="true" />
              <span className="sayla-float-chip sayla-float-chip--top">No app to learn</span>
              <span className="sayla-float-chip sayla-float-chip--bottom">Answers in seconds</span>
              <ConversationMockup messages={heroMessages} showTypingIndicator timestamp="Today 8:14 AM" />
            </div>
          </div>
        </section>

        <section className="sayla-proof">
          <div className="sayla-container">
            <div className="sayla-proof__panel" data-reveal="true">
              <p className="sayla-proof__line">Made for the ordinary chaos of modern life.</p>

              <div className="sayla-proof__logos">
                {lifeAreas.map((area, index) => (
                  <div className="sayla-proof__logo" data-reveal="true" key={area} style={revealStyle(index * 60)}>
                    <span>{area}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="sayla-use-cases">
          <div className="sayla-container">
            <div className="sayla-section-head">
              <div data-reveal="true">
                <p className="sayla-eyebrow">What people actually use it for</p>
                <h2>The things that quietly eat your week.</h2>
              </div>

              <p data-reveal="true" style={revealStyle(100)}>
                Not abstract productivity. Real life. The reschedules, reminders, messages, bookings, and loose ends
                that are never huge on their own but somehow take over the day.
              </p>
            </div>

            <div className="sayla-scenario-list">
              {useCases.map((useCase, index) => (
                <article
                  className={`sayla-scenario${index % 2 === 1 ? ' is-reversed is-light' : ''}`}
                  data-reveal="true"
                  key={useCase.title}
                  style={revealStyle(index * 80)}
                >
                  <div className="sayla-scenario__copy">
                    <span className="sayla-scenario__index">{String(index + 1).padStart(2, '0')}</span>
                    <p className="sayla-eyebrow">{useCase.eyebrow}</p>
                    <h3 className="sayla-scenario__title">{useCase.title}</h3>
                    <p className="sayla-scenario__description">{useCase.description}</p>
                  </div>

                  <div className="sayla-scenario__mockup">
                    <ConversationMockup compact messages={useCase.messages} timestamp="Today" />
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="sayla-how" id="how-it-works">
          <div className="sayla-container">
            <div className="sayla-how__panel">
              <div className="sayla-section-head">
                <div data-reveal="true">
                  <p className="sayla-eyebrow">How it works</p>
                  <h2>Text it the way you&apos;d text a helpful person.</h2>
                </div>

                <p data-reveal="true" style={revealStyle(100)}>
                  Sayla works best on the ordinary requests you would otherwise keep postponing: move this, book that,
                  remind me, sort this out, tell me what I&apos;m forgetting.
                </p>
              </div>

              <div className="sayla-how__grid">
                {steps.map((step, index) => (
                  <div className="sayla-step" data-reveal="true" key={step.title} style={revealStyle(index * 90)}>
                    <span className="sayla-step__number">{String(index + 1).padStart(2, '0')}</span>
                    <div>
                      <h3>{step.title}</h3>
                      <p>{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="sayla-testimonial">
          <div className="sayla-container sayla-testimonial__wrap">
            <div className="sayla-testimonial__card" data-reveal="true">
              <p className="sayla-quote">
                &quot;I use it for the things that never seem big enough to make a list, but somehow drain an entire
                week. It just gives me my head back.&quot;
              </p>
              <p className="sayla-quote__attribution" data-reveal="true" style={revealStyle(100)}>
                Working parent
              </p>
            </div>
          </div>
        </section>

        <section className="sayla-pricing" id="pricing">
          <div className="sayla-container">
            <div className="sayla-section-head">
              <div data-reveal="true">
                <p className="sayla-eyebrow">Pricing</p>
                <h2 className="sayla-pricing__headline">Simple plans for people who want their time back.</h2>
              </div>

              <p data-reveal="true" style={revealStyle(100)}>
                Start with one life, or bring the whole household. Either way, the goal is the same: fewer loose ends
                and more room to breathe.
              </p>
            </div>

            <div className="sayla-pricing__grid">
              {pricingTiers.map((tier, index) => (
                <article
                  className={`sayla-tier${tier.featured ? ' is-featured' : ''}`}
                  data-reveal="true"
                  key={tier.name}
                  style={revealStyle(index * 100)}
                >
                  <p className="sayla-tier__eyebrow">{tier.featured ? 'Most popular' : 'For households'}</p>
                  <h3 className="sayla-tier__name">{tier.name}</h3>
                  <p className="sayla-tier__price">{tier.price}</p>
                  <p className="sayla-tier__description">{tier.description}</p>

                  <ul className="sayla-tier__features">
                    {tier.features.map((feature) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>

                  <div className="sayla-tier__actions">
                    <a className={`sayla-button${tier.featured ? '' : ' sayla-button--ghost'}`} href={tier.ctaHref}>
                      {tier.ctaLabel}
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="sayla-final">
          <div className="sayla-container">
            <div className="sayla-cta" data-reveal="true">
              <div className="sayla-cta__inner">
                <div>
                  <p className="sayla-eyebrow">Reclaim time</p>
                  <h2 className="sayla-cta__headline">Get your time back.</h2>
                  <p className="sayla-cta__copy">
                    Start with the things that keep slipping to tomorrow. Your first week is free.
                  </p>
                </div>

                <a className="sayla-button" href={SMS_LINK}>
                  Text Sayla →
                </a>
              </div>
            </div>

            <footer className="sayla-footer">
              <span>© 2026 Sayla</span>
              <a className="sayla-footer__item" href="#top">
                Privacy
              </a>
              <a className="sayla-footer__item" href="#top">
                Terms
              </a>
              <a className="sayla-footer__item" href="#top">
                @sayla on X
              </a>
            </footer>
          </div>
        </section>
      </main>
    </>
  );
}
