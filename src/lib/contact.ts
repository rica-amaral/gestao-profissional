/** Contato oficial — preencha com os dados do profissional */
export const WHATSAPP_E164 = "";          // Ex: "5511999990000"
export const WHATSAPP_DISPLAY = "";       // Ex: "(11) 99999-0000"

export const INSTAGRAM_URL = "";          // Ex: "https://www.instagram.com/seuperfil/"
export const INSTAGRAM_HANDLE = "";       // Ex: "@seuperfil"

export const CITY_LINE = "";              // Ex: "São Paulo – SP"

export const defaultWhatsAppMessage = "Olá! Gostaria de agendar uma consulta.";

export function whatsappHref(message: string = defaultWhatsAppMessage) {
  return `https://wa.me/${WHATSAPP_E164}?text=${encodeURIComponent(message)}`;
}

/** Abre conversa com o cliente (número em E.164 ou local com DDD). */
export function whatsappClientHref(phone: string, message: string) {
  const digits = phone.replace(/\D/g, "");
  const n = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${n}?text=${encodeURIComponent(message)}`;
}
