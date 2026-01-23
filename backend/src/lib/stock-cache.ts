import YahooFinance from "yahoo-finance2";

// Initialize Yahoo Finance v3 client
const yahooFinance = new YahooFinance();

// Base currency for the app (all values converted to this)
const BASE_CURRENCY = "NOK";

interface CachedQuote {
  ticker: string;
  price: number;
  priceInBaseCurrency: number; // Price converted to NOK
  change: number;
  changePercent: number;
  currency: string;
  name: string;
  fetchedAt: number;
}

interface CachedExchangeRate {
  from: string;
  to: string;
  rate: number;
  fetchedAt: number;
}

// In-memory cache for stock quotes
const quoteCache = new Map<string, CachedQuote>();

// In-memory cache for exchange rates
const exchangeRateCache = new Map<string, CachedExchangeRate>();

// Cache TTL: 24 hours
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// Delay between sequential requests to avoid rate limiting
const REQUEST_DELAY_MS = 500;

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get FX pair symbol for Yahoo Finance (e.g., "USDNOK=X")
 */
function getFxSymbol(from: string, to: string): string {
  return `${from.toUpperCase()}${to.toUpperCase()}=X`;
}

/**
 * Get a cached exchange rate if it exists and is still valid
 */
function getCachedExchangeRate(from: string, to: string): number | null {
  // Same currency = rate of 1
  if (from.toUpperCase() === to.toUpperCase()) {
    return 1;
  }

  const key = `${from.toUpperCase()}-${to.toUpperCase()}`;
  const cached = exchangeRateCache.get(key);
  if (!cached) return null;

  const age = Date.now() - cached.fetchedAt;
  if (age > CACHE_TTL_MS) {
    exchangeRateCache.delete(key);
    return null;
  }

  return cached.rate;
}

/**
 * Fetch exchange rate from Yahoo Finance
 */
async function fetchExchangeRate(from: string, to: string): Promise<number> {
  const fromUpper = from.toUpperCase();
  const toUpper = to.toUpperCase();

  // Same currency = rate of 1
  if (fromUpper === toUpper) {
    return 1;
  }

  // Check cache first
  const cached = getCachedExchangeRate(fromUpper, toUpper);
  if (cached !== null) {
    console.log(`[StockCache] FX cache hit for ${fromUpper}/${toUpper}: ${cached}`);
    return cached;
  }

  try {
    const symbol = getFxSymbol(fromUpper, toUpper);
    console.log(`[StockCache] Fetching FX rate ${symbol}`);
    const quote = await yahooFinance.quote(symbol);
    const rate = quote.regularMarketPrice || 1;

    // Cache the rate
    const key = `${fromUpper}-${toUpper}`;
    exchangeRateCache.set(key, {
      from: fromUpper,
      to: toUpper,
      rate,
      fetchedAt: Date.now(),
    });

    console.log(`[StockCache] FX rate ${fromUpper}/${toUpper}: ${rate}`);
    return rate;
  } catch (error) {
    console.warn(`[StockCache] Failed to fetch FX rate ${fromUpper}/${toUpper}:`, error);
    // Return 1 as fallback (no conversion)
    return 1;
  }
}

/**
 * Convert a price from one currency to base currency (NOK)
 */
export async function convertToBaseCurrency(
  amount: number,
  fromCurrency: string,
): Promise<number> {
  const rate = await fetchExchangeRate(fromCurrency, BASE_CURRENCY);
  return amount * rate;
}

/**
 * Get the current base currency
 */
export function getBaseCurrency(): string {
  return BASE_CURRENCY;
}

/**
 * Get a cached quote if it exists and is still valid
 */
export function getCachedQuote(ticker: string): CachedQuote | null {
  const cached = quoteCache.get(ticker.toUpperCase());
  if (!cached) return null;

  const age = Date.now() - cached.fetchedAt;
  if (age > CACHE_TTL_MS) {
    quoteCache.delete(ticker.toUpperCase());
    return null;
  }

  return cached;
}

/**
 * Fetch a single stock quote with caching
 * Automatically converts price to base currency (NOK)
 */
export async function fetchQuote(ticker: string): Promise<CachedQuote | null> {
  const normalizedTicker = ticker.toUpperCase();

  // Check cache first
  const cached = getCachedQuote(normalizedTicker);
  if (cached) {
    console.log(`[StockCache] Cache hit for ${normalizedTicker}`);
    return cached;
  }

  // Fetch from Yahoo Finance
  try {
    console.log(`[StockCache] Fetching ${normalizedTicker} from Yahoo Finance`);
    const quote = await yahooFinance.quote(normalizedTicker);

    const price = quote.regularMarketPrice || 0;
    const currency = quote.currency || "USD";

    // Convert price to base currency (NOK)
    await sleep(REQUEST_DELAY_MS); // Rate limit before FX call
    const priceInBaseCurrency = await convertToBaseCurrency(price, currency);

    const cachedQuote: CachedQuote = {
      ticker: quote.symbol || normalizedTicker,
      price,
      priceInBaseCurrency,
      change: quote.regularMarketChange || 0,
      changePercent: quote.regularMarketChangePercent || 0,
      currency,
      name: quote.shortName || quote.longName || normalizedTicker,
      fetchedAt: Date.now(),
    };

    quoteCache.set(normalizedTicker, cachedQuote);
    return cachedQuote;
  } catch (error) {
    console.warn(`[StockCache] Failed to fetch ${normalizedTicker}:`, error);
    return null;
  }
}

/**
 * Fetch multiple stock quotes with rate limiting and caching
 * Returns a map of ticker -> quote (or null if failed)
 */
export async function fetchQuotesWithRateLimit(
  tickers: string[],
): Promise<Map<string, CachedQuote | null>> {
  const results = new Map<string, CachedQuote | null>();
  const tickersToFetch: string[] = [];

  // First, check cache for all tickers
  for (const ticker of tickers) {
    const normalizedTicker = ticker.toUpperCase();
    const cached = getCachedQuote(normalizedTicker);
    if (cached) {
      console.log(`[StockCache] Cache hit for ${normalizedTicker}`);
      results.set(normalizedTicker, cached);
    } else {
      tickersToFetch.push(normalizedTicker);
    }
  }

  // Fetch remaining tickers with delays
  for (let i = 0; i < tickersToFetch.length; i++) {
    const ticker = tickersToFetch[i];

    // Add delay between requests (skip for first request)
    if (i > 0) {
      await sleep(REQUEST_DELAY_MS);
    }

    const quote = await fetchQuote(ticker);
    results.set(ticker, quote);
  }

  return results;
}

/**
 * Clear the entire cache (useful for testing)
 */
export function clearCache(): void {
  quoteCache.clear();
  exchangeRateCache.clear();
}

/**
 * Get cache stats
 */
export function getCacheStats(): {
  quotes: { size: number; entries: string[] };
  exchangeRates: { size: number; entries: string[] };
} {
  return {
    quotes: {
      size: quoteCache.size,
      entries: Array.from(quoteCache.keys()),
    },
    exchangeRates: {
      size: exchangeRateCache.size,
      entries: Array.from(exchangeRateCache.keys()),
    },
  };
}
