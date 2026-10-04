/** Minimal date helpers (server side) — dates are stored as yyyy-mm-dd strings. */

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function addMonthsKey(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function daysInMonthKey(key: string): number {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

export function isoOf(key: string, day: number): string {
  return `${key}-${String(day).padStart(2, "0")}`;
}
