import { FeaturesSection } from "@/components/landing/features-section";
import { FinalCtaSection, LandingFooter } from "@/components/landing/final-cta-section";
import { HeroSection } from "@/components/landing/hero-section";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";
import { LandingNavbar } from "@/components/landing/landing-navbar";

/** Public home: what visitors without a session see at `/`. */
export function LandingPage() {
  return (
    // `data-landing` enables smooth anchor scrolling (see globals.css).
    <div data-landing className="min-h-screen bg-background">
      <LandingNavbar />
      <main>
        <HeroSection />
        <FeaturesSection />
        <HowItWorksSection />
        <FinalCtaSection />
      </main>
      <LandingFooter />
    </div>
  );
}
