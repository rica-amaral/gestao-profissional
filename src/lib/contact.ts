/** Contato oficial */
export const WHATSAPP_E164 = "5514997106093";
export const WHATSAPP_DISPLAY = "(14) 99710-6093";

export const INSTAGRAM_URL = "https://www.instagram.com/felipeceribelli/";
export const INSTAGRAM_HANDLE = "@felipeceribelli";

export const CITY_LINE = "Bauru – SP";

export const defaultWhatsAppMessage = "Olá! Gostaria de agendar uma avaliação de quiropraxia.";

export function whatsappHref(message: string = defaultWhatsAppMessage) {
  return `https://wa.me/${WHATSAPP_E164}?text=${encodeURIComponent(message)}`;
}

/** Abre conversa com o cliente (número em E.164 ou local com DDD). */
export function whatsappClientHref(phone: string, message: string) {
  const digits = phone.replace(/\D/g, "");
  const n = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${n}?text=${encodeURIComponent(message)}`;
}
