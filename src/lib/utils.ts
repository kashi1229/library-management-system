import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNowStrict, isValid, parseISO } from "date-fns";

/** Merge conditional class names, resolving Tailwind conflicts last-wins. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

type DateInput = Date | string | number | null | undefined;

/** Coerce anything date-like into a `Date`, or `null` when unusable. */
export function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(typeof value === "string" ? parseISO(value) : value);
  return isValid(date) ? date : null;
}

/**
 * Format a date with the default editorial pattern, e.g. "12 Mar 2026".
 * Returns an em dash placeholder for missing values so layouts never collapse.
 */
export function formatDate(value: DateInput, pattern = "d MMM yyyy"): string {
  const date = toDate(value);
  return date ? format(date, pattern) : "—";
}

/** Relative phrasing for countdowns, e.g. "3 days ago" / "in 2 days". */
export function formatRelative(value: DateInput): string {
  const date = toDate(value);
  return date ? formatDistanceToNowStrict(date, { addSuffix: true }) : "—";
}

export type CurrencyOptions = {
  /** ISO-4217 code, e.g. "USD". */
  currency?: string;
  /** Falls back to the code when Intl formatting is unavailable. */
  fallbackSymbol?: string;
};

/**
 * Format money using the active library currency.
 * Defaults to USD/$ until the Settings singleton is wired in a later unit.
 */
export function formatCurrency(amount: number, options: CurrencyOptions = {}): string {
  const { currency = "USD", fallbackSymbol = "$" } = options;
  const value = Number.isFinite(amount) ? amount : 0;

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${fallbackSymbol}${value.toFixed(2)}`;
  }
}

/** First letters of the first and last meaningful words, max 2 characters. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

/** Join conditional class names — alias kept for call sites that read better this way. */
export const classNames = cn;
