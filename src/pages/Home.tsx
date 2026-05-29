import { Hero } from "@/components/landing/Hero";
import { About } from "@/components/landing/About";
import { Benefits } from "@/components/landing/Benefits";
import { Services } from "@/components/landing/Services";
import { Locations } from "@/components/landing/Locations";
import { Testimonials } from "@/components/landing/Testimonials";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { Footer } from "@/components/landing/Footer";
import { WhatsAppChat } from "@/components/WhatsAppChat";

const Home = () => {
  return (
    <div className="min-h-screen bg-background">
      <Hero />
      <About />
      <Benefits />
      <Services />
      <Locations />
      <Testimonials />
      <FinalCTA />
      <Footer />
      <WhatsAppChat />
    </div>
  );
};

export default Home;
