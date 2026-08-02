import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number): string {
  return n.toLocaleString("zh-CN");
}

export function formatCurrency(n: number): string {
  return "¥" + n.toLocaleString("zh-CN");
}
