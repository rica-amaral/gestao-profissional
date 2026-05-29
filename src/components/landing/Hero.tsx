import { Button } from "@/components/ui/button";
import { MessageCircle, ArrowRight } from "lucide-react";
import logoImage from "@/assets/logo-felipe-ceribelli.png";
import { defaultWhatsAppMessage, whatsappHref } from "@/lib/contact";

export const Hero = () => {
  const handleWhatsAppClick = () => {
    window.open(whatsappHref(defaultWhatsAppMessage), "_blank");
  };

  const handleScrollToServices = () => {
    document.getElementById("services")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section id="inicio" className="relative min-h-[90vh] flex items-center overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-health-bg via-background to-calm-blue -z-10" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[min(90vw,520px)] h-64 bg-primary/10 rounded-full blur-3xl -z-10" />

      <div className="container mx-auto px-4 py-20">
        <div className="max-w-3xl mx-auto text-center flex flex-col items-center space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-700">
          <div className="relative">
            <div
              className="rounded-2xl border border-primary/20 bg-card/90 shadow-health px-8 py-6 sm:px-10 sm:py-8 backdrop-blur-sm ring-1 ring-primary/10"
              style={{
                boxShadow:
                  "0 0 0 1px hsl(var(--primary) / 0.08), 0 20px 50px -12px hsl(var(--primary) / 0.25), 0 8px 24px -8px hsl(0 0% 0% / 0.12)",
              }}
            >
              <img
                src={logoImage}
                alt="Felipe Ceribelli Quiropraxia"
                className="h-[4.5rem] sm:h-24 md:h-28 lg:h-32 w-auto max-w-[min(100%,340px)] object-contain mx-auto"
              />
            </div>
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-tight">
              Alívio de dores e mobilidade com{" "}
              <span className="text-primary">Quiropraxia Profissional</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              Atendimento especializado para dores lombares, cervicais, postura, coluna e articulações.
              Sessões <span className="text-foreground font-medium">individuais</span>, em torno de 50 minutos,
              com resposta rápida pelo WhatsApp.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center w-full sm:w-auto">
            <Button
              size="lg"
              className="text-lg px-8 shadow-health hover:scale-105 transition-transform"
              onClick={handleWhatsAppClick}
            >
              <MessageCircle className="mr-2 h-5 w-5" />
              Agendar Agora
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="text-lg px-8"
              onClick={handleScrollToServices}
            >
              Ver Valores
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};
