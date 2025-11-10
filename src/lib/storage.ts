import type { RegionCode } from './regions';
import { DEFAULT_FAVORITE_REGIONS, filterValidRegions } from './regions';
import type { LanguageCode } from './i18n';

export type PanelWindowMode = 'popup' | 'sidepanel';

export interface ExtensionSettings {
  favorites: RegionCode[];
  overlayEnabled: boolean;
  language: LanguageCode;
  windowMode: PanelWindowMode;
}

const SETTINGS_KEY = 'appStoreRegionSettings';
const DEFAULT_OVERLAY_ENABLED = true;
const DEFAULT_LANGUAGE: LanguageCode = 'en';
const DEFAULT_WINDOW_MODE: PanelWindowMode = 'sidepanel';

export const DEFAULT_SETTINGS: ExtensionSettings = {
  favorites: [...DEFAULT_FAVORITE_REGIONS],
  overlayEnabled: DEFAULT_OVERLAY_ENABLED,
  language: DEFAULT_LANGUAGE,
  windowMode: DEFAULT_WINDOW_MODE,
};

function getStorageArea(): chrome.storage.LocalStorageArea {
  if (!chrome?.storage?.local) {
    throw new Error('chrome.storage.local is not available in this context');
  }
  return chrome.storage.local;
}

async function storageGet<T>(keys: string | string[] | null): Promise<T> {
  const area = getStorageArea();
  return new Promise<T>((resolve, reject) => {
    area.get(keys, (result) => {
      const error = chrome.runtime?.lastError;
      if (error) {
        reject(error);
        return;
      }
      resolve(result as T);
    });
  });
}

async function storageSet(items: Record<string, unknown>): Promise<void> {
  const area = getStorageArea();
  return new Promise<void>((resolve, reject) => {
    area.set(items, () => {
      const error = chrome.runtime?.lastError;
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function mergeSettings(partial?: Partial<ExtensionSettings>): ExtensionSettings {
  const favoritesCandidate = filterValidRegions(partial?.favorites ?? DEFAULT_FAVORITE_REGIONS);
  return {
    favorites: favoritesCandidate.length > 0 ? favoritesCandidate : [...DEFAULT_FAVORITE_REGIONS],
    overlayEnabled: partial?.overlayEnabled ?? DEFAULT_OVERLAY_ENABLED,
    language: (partial?.language ?? DEFAULT_LANGUAGE) as LanguageCode,
    windowMode: (partial?.windowMode ?? DEFAULT_WINDOW_MODE) as PanelWindowMode,
  };
}

export async function getSettings(): Promise<ExtensionSettings> {
  const stored = await storageGet<{ [SETTINGS_KEY]?: Partial<ExtensionSettings> }>(SETTINGS_KEY);
  return mergeSettings(stored?.[SETTINGS_KEY]);
}

export async function saveSettings(partial: Partial<ExtensionSettings>): Promise<ExtensionSettings> {
  const current = await getSettings();
  const next = mergeSettings({ ...current, ...partial });
  await storageSet({ [SETTINGS_KEY]: next });
  return next;
}

export function subscribeToSettings(callback: (settings: ExtensionSettings) => void): () => void {
  const listener: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (changes, areaName) => {
    if (areaName === 'local' && changes[SETTINGS_KEY]) {
      const next = mergeSettings(changes[SETTINGS_KEY].newValue as Partial<ExtensionSettings>);
      callback(next);
    }
  };

  chrome.storage.onChanged.addListener(listener);

  return () => {
    chrome.storage.onChanged.removeListener(listener);
  };
}

export async function ensureDefaultSettings(): Promise<void> {
  const stored = await storageGet<{ [SETTINGS_KEY]?: Partial<ExtensionSettings> }>(SETTINGS_KEY);
  if (!stored?.[SETTINGS_KEY]) {
    await storageSet({ [SETTINGS_KEY]: DEFAULT_SETTINGS });
  }
}
