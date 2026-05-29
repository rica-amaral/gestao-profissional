import { Button } from "@/components/ui/button";
import { Check, MapPin, Phone } from "lucide-react";
import { InstagramIcon } from "@/components/icons/InstagramIcon";
import {
  CITY_LINE,
  INSTAGRAM_URL,
  WHATSAPP_DISPLAY,
  defaultWhatsAppMessage,
  whatsappHref,
} from "@/lib/contact";

export const FinalCTA = () => {
  const highlights = ["Avaliação gratuita", "Plano personalizado", "Acompanhamento especializado"];

  return (
    <section className="py-20 md:py-24 bg-sky-500 text-white relative overflow-hidden" id="contato">
      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-2xl mx-auto text-center space-y-8">
          <div className="space-y-4">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight">
              Cuidar de você é nossa prioridade
            </h2>
            <p className="text-lg md:text-xl text-white/95 leading-relaxed">
              Converse conosco e descubra como podemos te ajudar a alcançar seus objetivos de saúde e
              bem-estar.
            </p>
          </div>

          <ul className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-4 sm:gap-8 text-left sm:text-center">
            {highlights.map((item) => (
              <li key={item} className="flex items-center gap-2 text-white/95">
                <Check className="h-5 w-5 shrink-0 text-white" strokeWidth={2.5} />
                <span className="font-medium">{item}</span>
              </li>
            ))}
          </ul>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-4 pt-2">
            <Button
              size="lg"
              className="text-base rounded-xl bg-white/25 hover:bg-white/35 text-white border-0 backdrop-blur-sm"
              asChild
            >
              <a href={whatsappHref(defaultWhatsAppMessage)} target="_blank" rel="noopener noreferrer">
                <Phone className="mr-2 h-5 w-5" />
                Agendar avaliação
              </a>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="text-base rounded-xl bg-white/25 hover:bg-white/35 text-white border-white/40 backdrop-blur-sm"
              asChild
            >
              <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">
                <InstagramIcon className="mr-2 h-5 w-5" />
                Conhecer no Instagram
              </a>
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 pt-4 text-sm text-white/90">
            <span className="inline-flex items-center gap-2">
              <MapPin className="h-4 w-4 text-red-200 shrink-0" />
              {CITY_LINE}
            </span>
            <a
              href={whatsappHref()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 hover:text-white hover:underline"
            >
              <Phone className="h-4 w-4 shrink-0" />
              {WHATSAPP_DISPLAY}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};
