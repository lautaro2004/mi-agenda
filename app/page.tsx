import { LandingNavbar } from "@/components/landing/navbar";
import { LandingHero } from "@/components/landing/hero";
import { LandingPainPoints } from "@/components/landing/pain-points";
import { LandingTeachNotConfigure } from "@/components/landing/teach-not-configure";
import { LandingKnowsYourBusiness } from "@/components/landing/knows-your-business";
import { LandingComparison } from "@/components/landing/comparison";
import { LandingHowItWorks } from "@/components/landing/how-it-works";
import { LandingSimulatorShowcase } from "@/components/landing/simulator-showcase";
import { LandingProductPreview } from "@/components/landing/product-preview";
import { LandingBookingShowcase } from "@/components/landing/booking-showcase";
import { LandingWhatsappShowcase } from "@/components/landing/whatsapp-showcase";
import { LandingResourcesShowcase } from "@/components/landing/resources-showcase";
import { LandingMenuShowcase } from "@/components/landing/menu-showcase";
import { LandingAudience } from "@/components/landing/audience";
import { LandingOnboardingHighlight } from "@/components/landing/onboarding-highlight";
import { LandingPricing } from "@/components/landing/pricing";
import { LandingCta } from "@/components/landing/cta";
import { LandingFooter } from "@/components/landing/footer";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <LandingNavbar />
      <main className="flex-1">
        <LandingHero />
        <LandingPainPoints />
        <LandingTeachNotConfigure />
        <LandingKnowsYourBusiness />
        <LandingComparison />
        <LandingHowItWorks />
        <LandingSimulatorShowcase />
        <LandingProductPreview />
        <LandingBookingShowcase />
        <LandingWhatsappShowcase />
        <LandingResourcesShowcase />
        <LandingMenuShowcase />
        <LandingAudience />
        <LandingOnboardingHighlight />
        <LandingPricing />
        <LandingCta />
      </main>
      <LandingFooter />
    </div>
  );
}
