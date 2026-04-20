import { motion } from 'motion/react';
import { MessageCircle, Sparkles, Users } from 'lucide-react';

import { cn } from '@/lib/utils';

const steps = [
  {
    icon: MessageCircle,
    title: 'chat',
    description: 'text sayla like you would a friend. she listens, remembers, and has her own opinions.',
  },
  {
    icon: Sparkles,
    title: 'discover',
    description:
      'through real conversation, she helps you figure out what you actually want — in friends, work, everything.',
  },
  {
    icon: Users,
    title: 'connect',
    description:
      "when she finds someone you'd genuinely vibe with, she makes the intro. quality over quantity, always.",
  },
];

export function StepsSection() {
  return (
    <section className="py-28 px-6">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <p className="text-xs font-semibold text-primary uppercase tracking-[0.25em] mb-4">simple by design</p>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight font-instrument">
            no cold dms. no awkward asks.
            <br />
            <span className="text-primary italic">just a text.</span>
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 md:gap-12">
          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.15 }}
              className="text-center md:text-left"
            >
              <div
                className={cn(
                  'w-14 h-14 rounded-2xl mb-6 flex items-center justify-center',
                  'bg-primary/10 mx-auto md:mx-0',
                )}
              >
                <step.icon className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-3 tracking-tight font-instrument">{step.title}</h3>
              <p className="text-muted-foreground leading-relaxed text-[15px]">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
