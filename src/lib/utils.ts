import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function safeDate(input?: string | number | Date | null): Date {
  const d = input != null ? new Date(input) : new Date(0);
  return isNaN(d.getTime()) ? new Date(0) : d;
}
