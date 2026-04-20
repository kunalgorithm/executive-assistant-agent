import { motion } from 'motion/react';
import { ArrowRight, MessageCircle } from 'lucide-react';

const SAYLA_PHONE = import.meta.env.VITE_SAYLA_PHONE || '+14158663676';
const SAYLA_SMS_LINK = `sms:${SAYLA_PHONE}&body=${encodeURIComponent('hi sayla 👋')}`;

export function HeroSection() {
  return (
    <section className="min-h-dvh flex flex-col items-center justify-center relative px-6">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-125 h-125 md:w-175 md:h-175 bg-primary/6 rounded-full blur-3xl"
        />
      </div>

      <div className="relative z-10 text-center max-w-3xl mx-auto">
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-xs font-semibold text-primary uppercase tracking-[0.25em] mb-6"
        >
          get plugged in
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-[0.95] mb-8 font-instrument"
        >
          the right intro changes <span className="text-gradient italic">everything</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto mb-12 leading-relaxed"
        >
          sayla is the most connected person you know. text her what you&apos;re into and she&apos;ll make the intro.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.8 }}
        >
          <a
            href={SAYLA_SMS_LINK}
            className="inline-flex items-center gap-3 h-16 px-12 rounded-2xl bg-foreground text-background text-lg font-bold tracking-tight hover:scale-105 active:scale-[0.98] transition-all duration-300 shadow-xl hover:shadow-2xl cursor-pointer no-underline"
          >
            <MessageCircle className="w-5 h-5" />
            get started
            <ArrowRight className="w-5 h-5" />
          </a>
        </motion.div>
      </div>
    </section>
  );
}
