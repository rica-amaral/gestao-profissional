import { MessageCircle } from "lucide-react";
import { whatsappHref, defaultWhatsAppMessage } from "@/lib/contact";

export const WhatsAppChat = () => {
  return (
    <a
      href={whatsappHref(defaultWhatsAppMessage)}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all hover:scale-110"
      style={{ backgroundColor: "#25D366" }}
      aria-label="Conversar no WhatsApp"
    >
      <MessageCircle className="h-7 w-7 text-white" />
    </a>
  );
};
