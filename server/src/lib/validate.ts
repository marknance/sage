import dns from 'node:dns/promises';
import net from 'node:net';

const PRIVATE_RANGES = [
  /^127\./, /^10\./, /^192\.168\./, /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^169\.254\./, /^0\./, /^::1$/, /^fc00:/, /^fe80:/,
];

export function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * SSRF-safe URL validation: checks protocol and resolves hostname
 * to ensure it doesn't point to private/internal IP ranges.
 */
export async function isSafeUrl(rawUrl: string): Promise<boolean> {
  if (!isValidUrl(rawUrl)) return false;
  const parsed = new URL(rawUrl);
  const hostname = parsed.hostname;

  // Allow well-known public API hosts without DNS resolution
  const TRUSTED_HOSTS = ['api.openai.com', 'api.anthropic.com'];
  if (TRUSTED_HOSTS.includes(hostname)) return true;

  // If it's already an IP, check directly
  if (net.isIP(hostname)) {
    return !PRIVATE_RANGES.some((re) => re.test(hostname));
  }

  try {
    const { address } = await dns.lookup(hostname);
    return !PRIVATE_RANGES.some((re) => re.test(address));
  } catch {
    return false;
  }
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isWithinLength(value: string, min: number, max: number): boolean {
  const len = value.trim().length;
  return len >= min && len <= max;
}
