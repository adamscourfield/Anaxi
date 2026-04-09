import LandingNav from "@/components/landing/LandingNav";
import HeroSection from "@/components/landing/HeroSection";
import ValuePropsSection from "@/components/landing/ValuePropsSection";
import DualEngineSection from "@/components/landing/DualEngineSection";
import CTASection from "@/components/landing/CTASection";
import LandingFooter from "@/components/landing/LandingFooter";

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col font-sans">
      <LandingNav />
      <main className="flex-1">
        <HeroSection />
        <ValuePropsSection />
        <DualEngineSection />
        <CTASection />
      </main>
      <LandingFooter />
    </div>
  );
}
