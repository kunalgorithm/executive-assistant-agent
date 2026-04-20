import { motion } from 'motion/react';

import { cn } from '@/lib/utils';

type Message = { from: 'user' | 'sayla'; text: string };
const chatMessages: Message[] = [
  {
    from: 'user',
    text: "just got a drone and i'm kind of obsessed. the footage is decent but i want to learn how to actually edit it well",
  },
  {
    from: 'sayla',
    text: 'oh nice, what kind of drone? honestly raw footage always looks underwhelming until you grade it. are you going for cinematic or more short-form content?',
  },
  {
    from: 'user',
    text: "cinematic for sure — smooth flyovers, good color grading, that kind of thing. just don't really know where to start",
  },
  {
    from: 'sayla',
    text: 'actually i know someone who does incredible drone cinematography and runs editing workshops. want me to connect you two?',
  },
];

export function ChatPreviewSection() {
  return (
    <section className="py-28 px-6 relative">
      <div className="absolute inset-0 bg-linear-to-b from-transparent via-primary/3 to-transparent pointer-events-none" />
      <div className="max-w-2xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="text-xs font-semibold text-primary uppercase tracking-[0.25em] mb-4">real conversations</p>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight font-instrument">
            some people know everyone.
            <br />
            <span className="text-primary italic">sayla is one of them.</span>
          </h2>
        </motion.div>

        {/* Phone Mockup */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="flex justify-center"
        >
          <div className="w-95 max-w-full rounded-4xl border border-admin-border bg-admin-hover p-5 shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
            {/* Phone Header */}
            <div className="text-center pb-4 border-b border-admin-border mb-4">
              <div className="w-10 h-10 rounded-full bg-linear-to-br from-purple-500 to-pink-500 mx-auto mb-2 flex items-center justify-center text-white text-sm font-semibold">
                S
              </div>
              <p className="text-white text-[17px] font-semibold leading-tight">Sayla</p>
              <p className="text-admin-muted text-[12px] mt-0.5">iMessage</p>
            </div>

            {/* Messages */}
            <div className="space-y-2.5">
              {chatMessages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.12 }}
                  className={cn('flex', msg.from === 'user' ? 'justify-end' : 'justify-start')}
                >
                  <div
                    className={cn(
                      'max-w-[85%] px-4 py-2.5 rounded-[18px] text-[15px] leading-relaxed',
                      msg.from === 'user'
                        ? 'bg-admin-imessage text-white rounded-br-[6px]'
                        : 'bg-admin-surface border border-admin-border text-admin-imessage-recv rounded-bl-[6px]',
                    )}
                  >
                    {msg.text}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
