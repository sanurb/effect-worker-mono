import { createFileRoute } from "@tanstack/react-router";

import { HeroSection, FeaturesSection, EffectDemo, Footer } from "@/components/landing";
import { NavigationBar } from "@/components/navigation";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <NavigationBar />
      <main>
        <HeroSection />
        <FeaturesSection />
        <EffectDemo />
      </main>
      <Footer />
    </div>
  );
}
