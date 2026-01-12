import YahooFinance from "yahoo-finance2";

// Initialize Yahoo Finance v3 client
const yahooFinance = new YahooFinance();

interface CachedQuote {
  ticker: string;
  price: number;
  change: number;
  changePercent: number;
  currency: string;
  name: string;
  fetchedAt: number;
}

// In-memory cache for stock quotes
const quoteCache = new Map<string, CachedQuote>();

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

    const cachedQuote: CachedQuote = {
      ticker: quote.symbol || normalizedTicker,
      price: quote.regularMarketPrice || 0,
      change: quote.regularMarketChange || 0,
      changePercent: quote.regularMarketChangePercent || 0,
      currency: quote.currency || "USD",
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
}

/**
 * Get cache stats
 */
export function getCacheStats(): { size: number; entries: string[] } {
  return {
    size: quoteCache.size,
    entries: Array.from(quoteCache.keys()),
  };
}

