import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = 'SEK'): string {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('sv-SE').format(num)
}

export function formatPercent(value: number): string {
  return new Intl.NumberFormat('sv-SE', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 100)
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('sv-SE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date))
}

export function getYearMonth(date: Date = new Date()): number {
  return date.getFullYear() * 100 + (date.getMonth() + 1)
}

export function parseYearMonth(yearMonth: number): { year: number; month: number } {
  return {
    year: Math.floor(yearMonth / 100),
    month: yearMonth % 100,
  }
}

export function getMonthName(month: number): string {
  const date = new Date(2024, month - 1, 1)
  return date.toLocaleString('en-US', { month: 'long' })
}


