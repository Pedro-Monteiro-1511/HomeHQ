import type { ShoppingItem } from "@/types/homehq";

export const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export function equalShares(total: number, ids: string[]) {
  if (!ids.length) return {};
  const base = Math.floor(total / ids.length);
  let remaining = total - base * ids.length;
  return Object.fromEntries(ids.map((id) => [id, base + (remaining-- > 0 ? 1 : 0)]));
}

export function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency }).format(cents / 100);
}

export function frequencyLabel(value: string) {
  return ({ daily: "Diária", monthly: "Mensal", weekly: "Semanal", yearly: "Anual", one_time: "Única" } as Record<string, string>)[value] ?? value;
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-PT", { day: "numeric", month: "short" }).format(new Date(`${value}T12:00:00`));
}

export function formatTaskDate(value: string) {
  return new Intl.DateTimeFormat("pt-PT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function daysInMonth(month: number) {
  return month ? new Date(new Date().getFullYear(), month, 0).getDate() : 31;
}

export function getNextOccurrence(month: number, day: number) {
  const now = new Date();
  let candidate = new Date(now.getFullYear(), month - 1, day, 12);
  if (candidate < now) candidate = new Date(now.getFullYear() + 1, month - 1, day, 12);
  return candidate.toISOString().slice(0, 10);
}

export function priorityRank(value: ShoppingItem["priority"]) {
  return ({ low: 0, normal: 1, high: 2, urgent: 3 })[value];
}

export function priorityLabel(value: ShoppingItem["priority"]) {
  return ({ low: "Baixa", normal: "Normal", high: "Alta", urgent: "Urgente" })[value];
}
