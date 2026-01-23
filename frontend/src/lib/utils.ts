import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Convert minor units (øre/cents) to major units (kr/dollars) for display
export function fromMinorUnits(minorUnits: number | null | undefined): number {
  if (minorUnits == null) return 0;
  return minorUnits / 100;
}

// Convert major units to minor units for storage
export function toMinorUnits(majorUnits: number): number {
  return Math.round(majorUnits * 100);
}

// Format currency from minor units (divides by 100)
export function formatCurrency(minorUnits: number, currency = "SEK"): string {
  const majorUnits = fromMinorUnits(minorUnits);
  return new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(majorUnits);
}

// Format raw number (no conversion) - useful for percentages or already converted values
export function formatNumber(num: number): string {
  return new Intl.NumberFormat("sv-SE").format(num);
}

export function formatPercent(value: number): string {
  return new Intl.NumberFormat("sv-SE", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 100);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

export function getYearMonth(date: Date = new Date()): number {
  return date.getFullYear() * 100 + (date.getMonth() + 1);
}

export function parseYearMonth(
  yearMonth: number,
): { year: number; month: number } {
  return {
    year: Math.floor(yearMonth / 100),
    month: yearMonth % 100,
  };
}

export function getMonthName(month: number): string {
  const date = new Date(2024, month - 1, 1);
  return date.toLocaleString("en-US", { month: "long" });
}

export function parseYearWeek(
  yearWeek: number,
): { year: number; week: number } {
  return {
    year: Math.floor(yearWeek / 100),
    week: yearWeek % 100,
  };
}

export function formatYearWeek(yearWeek: number): string {
  const { year, week } = parseYearWeek(yearWeek);
  return `W${week} ${year}`;
}
