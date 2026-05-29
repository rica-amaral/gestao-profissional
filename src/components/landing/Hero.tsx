import { Button } from "@/components/ui/button";
import { MessageCircle, ArrowRight } from "lucide-react";
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
          <div className="space-y-4">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-tight">
              Atendimento profissional com{" "}
              <span className="text-primary">excelência e cuidado</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              Sessões <span className="text-foreground font-medium">individuais</span> com foco no seu bem-estar.
              Agende pelo WhatsApp com rapidez e praticidade.
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
