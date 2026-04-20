import { motion } from 'motion/react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router';

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
};

export default function HeadOfGrowth() {
  return (
    <div className="min-h-screen bg-background selection:bg-primary/20">
      {/* Nav */}
      <nav className="max-w-170 mx-auto px-6 pt-10 pb-4">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          sayla
        </Link>
      </nav>

      <div className="max-w-170 mx-auto px-6 pb-32">
        {/* Header */}
        <motion.div {...fadeUp} transition={{ duration: 0.6 }}>
          <p className="text-xs font-semibold text-primary uppercase tracking-[0.25em] mb-6">sayla · san francisco</p>
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-[0.95] mb-3 font-instrument">
            head of <span className="text-gradient italic">growth</span>
          </h1>
          <p className="text-sm text-muted-foreground tracking-wide mb-16">first growth hire · full-time</p>
        </motion.div>

        {/* The role */}
        <motion.div {...fadeUp} transition={{ duration: 0.6, delay: 0.1 }}>
          <SectionLabel>the role</SectionLabel>
          <p className="text-[15px] leading-[1.85] text-foreground/90 mb-5">
            Sayla is a superconnector — an AI agent that lives natively in iMessage and introduces you, directly and
            deliberately, to the people most likely to accelerate your goals. No app to download. No profile to
            optimize. Just a text, and then a handshake.
          </p>
          <p className="text-[15px] leading-[1.85] text-foreground/90 mb-5">
            We're looking for our first growth hire — someone hungry, with a chip on their shoulder and something to
            prove to the world. You want to build the next great connection platform and be deep in creating the brand
            for it. You'll own the strategy, the content, and the community across LinkedIn, X, Instagram, and wherever
            else the right people are paying attention.
          </p>
        </motion.div>

        <Divider />

        {/* What you'll do */}
        <motion.div {...fadeUp} transition={{ duration: 0.6 }}>
          <SectionLabel>what you'll do</SectionLabel>
          <RoleList
            items={[
              "Own Sayla's brand voice and content strategy across LinkedIn, X, Instagram, and emerging channels",
              'Build and execute organic and paid growth loops that turn Sayla into a cultural fixture in the founder, operator, and creator communities',
              'Develop the persona and ongoing narrative of Sayla as a character — not a chatbot, an entity',
              'Drive user acquisition, referrals, and ambassador programs from zero',
              'Track what moves the needle and ruthlessly iterate',
            ]}
          />
        </motion.div>

        <Divider />

        {/* Who you are */}
        <motion.div {...fadeUp} transition={{ duration: 0.6 }}>
          <SectionLabel>who you are</SectionLabel>
          <RoleList
            items={[
              'Proven track record of building audiences and driving growth on social — you have receipts',
              'Strong editorial instincts — you can write a thread that makes people forward it to someone they were already thinking about',
              'You think in distribution loops, not just posts',
              'Comfortable working directly with a founder in an environment where nothing is set yet',
              "Excited by the idea that the best consumer apps of this decade haven't been built yet",
            ]}
          />
        </motion.div>

        <Divider />

        {/* Who you'll work with */}
        <motion.div {...fadeUp} transition={{ duration: 0.6 }}>
          <SectionLabel>who you'll work with</SectionLabel>
          <p className="text-[15px] leading-[1.85] text-foreground/90">
            You'll work directly with the founder — ex-YC, previously led a marketing optimization platform managing{' '}
            <strong className="font-semibold text-foreground">$100M+</strong> in ad spend for Fortune 500 brands, and a
            nationally-ranked track athlete. The company is early and intentional. There's room to build something real
            here.
          </p>
        </motion.div>

        {/* Comp block */}
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.6 }}
          className="bg-foreground text-background my-12 p-7 relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-linear-to-r from-primary to-primary/40" />
          <div className="flex flex-wrap gap-5 justify-between">
            <CompItem label="salary" value="$140–180k" />
            <CompItem label="equity" value="extremely generous" />
            <CompItem label="location" value="sf preferred" />
          </div>
          <p className="text-xs text-foreground/30 mt-5 tracking-wide">
            Equity package reflects first hire status. We believe in making this meaningful.
          </p>
        </motion.div>

        {/* CTA */}
        <motion.div {...fadeUp} transition={{ duration: 0.6 }} className="mt-16 pt-10 border-t border-border/30">
          <p className="text-sm text-muted-foreground mb-4">
            If this sounds like the job you've been waiting to exist, reach out with a note about what you've built and
            where you'd take Sayla.
          </p>
          <a
            href="mailto:hi@sayla.com"
            className="inline-block text-2xl text-primary border-b border-primary pb-0.5 hover:opacity-80 transition-opacity font-instrument"
          >
            hi@sayla.com
          </a>
        </motion.div>
      </div>

      {/* Footer */}
      <footer className="py-10 px-6 border-t border-border/30">
        <div className="max-w-170 mx-auto flex items-center justify-between">
          <div className="font-instrument">
            <span className="text-sm text-muted-foreground/50">sayla</span>
            <span className="block text-xs text-muted-foreground/30 italic">get plugged in</span>
          </div>
          <span className="text-xs text-muted-foreground/40">cocomo ai</span>
        </div>
      </footer>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-muted-foreground mb-4">{children}</p>;
}

function Divider() {
  return <div className="w-10 h-px bg-primary/40 my-12" />;
}

function RoleList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-0">
      {items.map((item) => (
        <li
          key={item}
          className="py-2.5 pl-5 relative text-[15px] leading-relaxed text-foreground/90 border-b border-border/20 last:border-b-0"
        >
          <span className="absolute left-0 text-primary text-xs">—</span>
          {item}
        </li>
      ))}
    </ul>
  );
}

function CompItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-35">
      <p className="text-[10px] uppercase tracking-[0.2em] text-primary mb-1.5">{label}</p>
      <p className="text-2xl leading-none font-instrument">{value}</p>
    </div>
  );
}
