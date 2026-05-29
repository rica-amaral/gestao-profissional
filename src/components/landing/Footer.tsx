import { Phone, Stethoscope } from "lucide-react";
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
          <div className="p-3 rounded-xl bg-primary/10">
            <Stethoscope className="h-8 w-8 text-primary" />
          </div>
          <p className="text-lg font-bold text-foreground">Gestão de Profissional</p>
        </div>

        <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-4 sm:gap-8 text-sm text-muted-foreground">
          {WHATSAPP_DISPLAY && (
            <a
              href={whatsappHref()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 hover:text-primary transition-colors"
            >
              <Phone className="h-4 w-4 shrink-0" />
              WhatsApp: {WHATSAPP_DISPLAY}
            </a>
          )}
          {INSTAGRAM_URL && (
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 hover:text-primary transition-colors"
            >
              <InstagramIcon className="h-4 w-4" />
              {INSTAGRAM_HANDLE}
            </a>
          )}
        </div>

        {CITY_LINE && <p className="text-sm text-muted-foreground">{CITY_LINE}</p>}

        <p className="text-xs text-muted-foreground/80 pt-2">
          © {year} Gestão de Profissional. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
};
