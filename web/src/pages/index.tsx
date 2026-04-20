import { Footer } from '@/components/home/footer';
import { HeroSection } from '@/components/home/hero';
import { StepsSection } from '@/components/home/steps';
import { ChatPreviewSection } from '@/components/home/chatPreview';

export default function SaylaLanding() {
  return (
    <div className="min-h-screen bg-background selection:bg-primary/20">
      <HeroSection />
      <StepsSection />
      <ChatPreviewSection />
      <Footer />
    </div>
  );
}
