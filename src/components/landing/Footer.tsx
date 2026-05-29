import logoImage from "@/assets/logo-felipe-ceribelli.png";
import { Phone } from "lucide-react";
import { InstagramIcon } from "@/components/icons/InstagramIcon";
import {
  CITY_LINE,
  INSTAGRAM_HANDLE,
  INSTAGRAM_URL,
  WHATSAPP_DISPLAY,
  whatsappHref,
} from "@/lib/contact";

export const Footer = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-background border-t border-border py-12">
      <div className="container mx-auto px-4 text-center space-y-6">
        <div className="flex flex-col items-center gap-3">
          <img
            src={logoImage}
            alt="Felipe Ceribelli Quiropraxia"
            className="h-12 w-auto object-contain"
          />
          <p className="text-lg font-bold text-foreground">Felipe Ceribelli Quiropraxia</p>
        </div>

        <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-4 sm:gap-8 text-sm text-muted-foreground">
          <a
            href={whatsappHref()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 hover:text-primary transition-colors"
          >
            <Phone className="h-4 w-4 shrink-0" />
            WhatsApp: {WHATSAPP_DISPLAY}
          </a>
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 hover:text-primary transition-colors"
          >
            <InstagramIcon className="h-4 w-4" />
            {INSTAGRAM_HANDLE}
          </a>
        </div>

        <p className="text-sm text-muted-foreground">{CITY_LINE}</p>

        <p className="text-xs text-muted-foreground/80 pt-2">
          © {year} Felipe Ceribelli Quiropraxia. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
};
