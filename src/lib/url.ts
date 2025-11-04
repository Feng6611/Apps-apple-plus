import { normalizeRegion } from './regions';

export const APPLE_APP_STORE_HOST = 'apps.apple.com';

export function isAppleAppStoreUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === APPLE_APP_STORE_HOST;
  } catch {
    return false;
  }
}

export function extractRegionFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== APPLE_APP_STORE_HOST) {
      return null;
    }
    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments.length === 0) {
      return null;
    }
    return normalizeRegion(segments[0]);
  } catch {
    return null;
  }
}

export function buildRegionUrl(url: string, region: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== APPLE_APP_STORE_HOST) {
      return null;
    }

    const normalizedRegion = normalizeRegion(region);
    const segments = parsed.pathname.split('/');

    if (segments.length === 1) {
      segments.push(normalizedRegion);
    } else if (segments.length > 1) {
      const existing = segments[1]?.trim();
      if (existing?.length) {
        segments[1] = normalizedRegion;
      } else {
        segments.splice(1, 0, normalizedRegion);
      }
    }

    parsed.pathname = segments.join('/').replace(/\/{2,}/g, '/');
    return parsed.toString();
  } catch {
    return null;
  }
}
