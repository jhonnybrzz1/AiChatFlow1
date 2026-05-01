import crypto from 'crypto';

interface CacheEntry {
  value: string;
  createdAt: number;
  expiresAt: number;
  hits: number;
}

export interface AICacheStats {
  enabled: boolean;
  size: number;
  maxEntries: number;
  ttlMs: number;
  totalHits: number;
}

const parsePositiveInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`)
    .join(',')}}`;
};

export class AIResponseCache {
  private readonly entries = new Map<string, CacheEntry>();
  private readonly enabled = process.env.AI_RESPONSE_CACHE_ENABLED !== 'false';
  private readonly maxEntries = parsePositiveInt(process.env.AI_RESPONSE_CACHE_MAX_ENTRIES, 250);
  private readonly ttlMs = parsePositiveInt(process.env.AI_RESPONSE_CACHE_TTL_MS, 30 * 60 * 1000);

  createKey(payload: Record<string, unknown>): string {
    const hash = crypto.createHash('sha256');
    hash.update(stableStringify(payload));
    return hash.digest('hex');
  }

  get(key: string): string | null {
    if (!this.enabled) {
      return null;
    }

    const entry = this.entries.get(key);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return null;
    }

    entry.hits += 1;
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: string, ttlMs = this.ttlMs): void {
    if (!this.enabled || !value.trim()) {
      return;
    }

    this.entries.set(key, {
      value,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttlMs,
      hits: 0
    });

    this.prune();
  }

  clear(): void {
    this.entries.clear();
  }

  getStats(): AICacheStats {
    this.pruneExpired();

    let totalHits = 0;
    for (const entry of Array.from(this.entries.values())) {
      totalHits += entry.hits;
    }

    return {
      enabled: this.enabled,
      size: this.entries.size,
      maxEntries: this.maxEntries,
      ttlMs: this.ttlMs,
      totalHits
    };
  }

  private prune(): void {
    this.pruneExpired();

    while (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      if (!oldestKey) {
        return;
      }
      this.entries.delete(oldestKey);
    }
  }

  private pruneExpired(): void {
    const now = Date.now();
    for (const [key, entry] of Array.from(this.entries.entries())) {
      if (entry.expiresAt <= now) {
        this.entries.delete(key);
      }
    }
  }
}

export const aiResponseCache = new AIResponseCache();
