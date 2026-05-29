import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formata valor em reais sem centavos. Ex: 170 → "R$ 170" | 23070 → "R$ 23.070" */
export function formatBRL(value: number): string {
  return "R$ " + Math.round(value).toLocaleString("pt-BR");
}
