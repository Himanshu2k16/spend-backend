/**
 * Exchange rates via open.er-api.com — free, no API key, ~160 currencies,
 * updated daily. Cached in memory for 12h; an approximate offline table
 * keeps conversion working when the network is unavailable.
 */

const API = "https://open.er-api.com/v6/latest";

const USD_FALLBACK: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  INR: 88,
  AED: 3.67,
  JPY: 152,
};

export interface RateTable {
  /** How many units of X one USD buys. */
  usdTo: Record<string, number>;
  fetchedAt: number;
  live: boolean;
}

const TTL = 12 * 60 * 60 * 1000;
let cache: RateTable | null = null;

export async function getUsdRates(): Promise<RateTable> {
  if (cache && Date.now() - cache.fetchedAt < TTL) return cache;

  try {
    const res = await fetch(`${API}/USD`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as { rates?: Record<string, number> };
    if (!json.rates) throw new Error("no rates in response");

    const usdTo: Record<string, number> = {};
    for (const [code, rate] of Object.entries(json.rates)) {
      if (/^[A-Z]{3}$/.test(code) && typeof rate === "number" && rate > 0) {
        usdTo[code] = rate;
      }
    }
    cache = { usdTo, fetchedAt: Date.now(), live: true };
    return cache;
  } catch (err) {
    console.warn("[spend-backend] rates fetch failed, using offline table:", err);
    return { usdTo: { ...USD_FALLBACK }, fetchedAt: Date.now(), live: false };
  }
}

/** Convert an amount between currencies using a USD-based rate table. */
export function convert(amount: number, from: string, to: string, table: RateTable): number {
  if (from === to) return amount;
  const fromRate = table.usdTo[from];
  const toRate = table.usdTo[to];
  if (!fromRate || !toRate) return amount;
  return (amount / fromRate) * toRate;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
