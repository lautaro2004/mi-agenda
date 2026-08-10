import { LandingNavbar } from "@/components/landing/navbar";
import { LandingHero } from "@/components/landing/hero";
import { LandingPainPoints } from "@/components/landing/pain-points";
import { LandingKnowsYourBusiness } from "@/components/landing/knows-your-business";
import { LandingTeachNotConfigure } from "@/components/landing/teach-not-configure";
import { LandingKnowledgeGrid } from "@/components/landing/knowledge-grid";
import { LandingBookingShowcase } from "@/components/landing/booking-showcase";
import { LandingResourcesShowcase } from "@/components/landing/resources-showcase";
import { LandingComparison } from "@/components/landing/comparison";
import { LandingProductPreview } from "@/components/landing/product-preview";
import { LandingHowItWorks } from "@/components/landing/how-it-works";
import { LandingSimulatorShowcase } from "@/components/landing/simulator-showcase";
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
        <LandingKnowsYourBusiness />
        <LandingTeachNotConfigure />
        <LandingKnowledgeGrid />
        <LandingBookingShowcase />
        <LandingResourcesShowcase />
        <LandingComparison />
        <LandingProductPreview />
        <LandingHowItWorks />
        <LandingSimulatorShowcase />
        <LandingPricing />
        <LandingCta />
      </main>
      <LandingFooter />
    </div>
  );
}
