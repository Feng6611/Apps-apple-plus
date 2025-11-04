import type { ExtensionSettings } from '@/src/lib/storage';
import { DEFAULT_SETTINGS, getSettings, subscribeToSettings } from '@/src/lib/storage';
import { getRegionLabel, normalizeRegion } from '@/src/lib/regions';
import { buildRegionUrl, extractRegionFromUrl } from '@/src/lib/url';
import type { LanguageCode, MessageKey } from '@/src/lib/i18n';
import { t } from '@/src/lib/i18n';

const OVERLAY_ID = 'appstore-region-switcher-overlay';
const TITLE_ID = 'appstore-region-switcher-title';
const SELECT_ID = 'appstore-region-switcher-select';

let messageListenerAttached = false;

export default defineContentScript({
  matches: ['https://apps.apple.com/*'],
  runAt: 'document_idle',
  main() {
    if (window.top && window.top !== window) {
      return;
    }

    let cachedSettings: ExtensionSettings = DEFAULT_SETTINGS;
    let currentLanguage: LanguageCode = DEFAULT_SETTINGS.language;
    let unsubscribe: (() => void) | undefined;

    const overlay = ensureOverlay();
    updateOverlayTexts(overlay, currentLanguage);

    const refresh = (settings: ExtensionSettings) => {
      cachedSettings = settings;
      currentLanguage = settings.language;
      updateOverlayTexts(overlay, currentLanguage);
      updateOverlay(overlay, cachedSettings, currentLanguage);
      updateFromLocation();
    };

    const updateFromLocation = () => {
      syncSelectValue(
        overlay,
        cachedSettings,
        extractRegionFromUrl(window.location.href),
        currentLanguage,
      );
    };

    getSettings()
      .then((settings) => {
        refresh(settings);
        unsubscribe = subscribeToSettings(refresh);
      })
      .catch((error) => {
        console.error('Failed to read extension settings', error);
      });

    overlay.select.addEventListener('change', (event) => {
      const target = event.target as HTMLSelectElement;
      const selected = target.value;
      if (!selected) {
        return;
      }
      const nextUrl = buildRegionUrl(window.location.href, selected);
      if (!nextUrl) {
        showStatus(overlay, 'overlayStatusUnsupported', cachedSettings, currentLanguage);
        return;
      }
      if (nextUrl === window.location.href) {
        showStatus(overlay, 'overlayStatusAlready', cachedSettings, currentLanguage);
        return;
      }
      showStatus(overlay, 'overlayStatusSwitching', cachedSettings, currentLanguage, {
        region: getRegionLabel(selected, currentLanguage),
      });
      window.location.href = nextUrl;
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        updateFromLocation();
      }
    });

    window.addEventListener('popstate', updateFromLocation);
    window.addEventListener('hashchange', updateFromLocation);

    const originalPushState = history.pushState;
    history.pushState = function (...args) {
      const result = originalPushState.apply(this, args as Parameters<typeof history.pushState>);
      updateFromLocation();
      return result;
    } as typeof history.pushState;

    const originalReplaceState = history.replaceState;
    history.replaceState = function (...args) {
      const result = originalReplaceState.apply(this, args as Parameters<typeof history.replaceState>);
      updateFromLocation();
      return result;
    } as typeof history.replaceState;

    window.addEventListener('beforeunload', () => {
      unsubscribe?.();
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
      window.removeEventListener('popstate', updateFromLocation);
      window.removeEventListener('hashchange', updateFromLocation);
    });

    if (!messageListenerAttached) {
      chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (message?.type !== 'switch-region') {
          return undefined;
        }
        const region = normalizeRegion(String(message.region ?? ''));
        const nextUrl = buildRegionUrl(window.location.href, region);
        if (!nextUrl) {
          sendResponse?.({ success: false, reason: 'unsupported' });
          return false;
        }
        sendResponse?.({ success: true, url: nextUrl });
        setTimeout(() => {
          window.location.href = nextUrl;
        }, 0);
        return true;
      });
      messageListenerAttached = true;
    }
  },
});

type OverlayElements = {
  container: HTMLDivElement;
  title: HTMLSpanElement;
  select: HTMLSelectElement;
  status: HTMLSpanElement;
};

function ensureOverlay(): OverlayElements {
  const existing = document.getElementById(OVERLAY_ID) as HTMLDivElement | null;
  if (existing) {
    const title = existing.querySelector<HTMLSpanElement>(`#${TITLE_ID}`);
    const select = existing.querySelector<HTMLSelectElement>(`#${SELECT_ID}`);
    const status = existing.querySelector<HTMLSpanElement>(`#${TITLE_ID}-status`);
    if (!title || !select || !status) {
      existing.remove();
      return createOverlay();
    }
    return { container: existing, title, select, status };
  }
  return createOverlay();
}

function createOverlay(): OverlayElements {
  const container = document.createElement('div');
  container.id = OVERLAY_ID;
  container.style.position = 'fixed';
  container.style.top = '16px';
  container.style.left = '16px';
  container.style.zIndex = '2147483647';
  container.style.background = 'rgba(17, 24, 39, 0.82)';
  container.style.color = '#f9fafb';
  container.style.borderRadius = '14px';
  container.style.padding = '10px 14px';
  container.style.boxShadow = '0 16px 30px rgba(15, 23, 42, 0.35)';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.gap = '6px';
  container.style.fontFamily = 'SF Pro Text, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  container.style.fontSize = '13px';

  const title = document.createElement('span');
  title.id = TITLE_ID;
  title.style.fontWeight = '600';

  const select = document.createElement('select');
  select.id = SELECT_ID;
  select.style.minWidth = '210px';
  select.style.padding = '6px 10px';
  select.style.borderRadius = '10px';
  select.style.border = 'none';
  select.style.fontSize = '13px';
  select.style.color = '#111827';

  const status = document.createElement('span');
  status.id = `${TITLE_ID}-status`;
  status.style.fontSize = '12px';
  status.style.opacity = '0.9';

  container.append(title, select, status);
  document.body.appendChild(container);

  return { container, title, select, status };
}

function updateOverlay(
  overlay: OverlayElements,
  settings: ExtensionSettings,
  language: LanguageCode,
): void {
  overlay.container.style.display = settings.overlayEnabled ? 'flex' : 'none';
  if (!settings.overlayEnabled) {
    return;
  }

  const currentRegion = extractRegionFromUrl(window.location.href);
  renderOptions(overlay.select, settings, currentRegion, language);
  syncSelectValue(overlay, settings, currentRegion, language);
}

function renderOptions(
  select: HTMLSelectElement,
  settings: ExtensionSettings,
  current: string | null,
  language: LanguageCode,
) {
  const favorites = [...settings.favorites];
  select.innerHTML = '';

  if (current && !favorites.includes(normalizeRegion(current))) {
    favorites.unshift(normalizeRegion(current));
  }

  if (favorites.length === 0) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = t(language, 'overlayStatusHint');
    select.appendChild(option);
    select.disabled = true;
    return;
  }

  select.disabled = false;

  for (const region of favorites) {
    const option = document.createElement('option');
    option.value = region;
    option.textContent = getRegionLabel(region, language);
    select.appendChild(option);
  }
}

function syncSelectValue(
  overlay: OverlayElements,
  settings: ExtensionSettings,
  currentRegion: string | null,
  language: LanguageCode,
) {
  if (!settings.overlayEnabled) {
    return;
  }

  if (currentRegion) {
    const normalized = normalizeRegion(currentRegion);
    const option = Array.from(overlay.select.options).find((item) => item.value === normalized);
    if (option) {
      overlay.select.value = normalized;
      overlay.status.textContent = t(language, 'overlayStatusCurrent', {
        region: getRegionLabel(normalized, language),
      });
      return;
    }
  }

  if (overlay.select.options.length > 0) {
    overlay.select.selectedIndex = 0;
    const first = overlay.select.options[overlay.select.selectedIndex]?.value;
    overlay.status.textContent = first
      ? t(language, 'overlayStatusSelected', {
          region: getRegionLabel(first, language),
        })
      : '';
  } else {
    overlay.status.textContent = t(language, 'overlayStatusNoFavorites');
  }
}

function showStatus(
  overlay: OverlayElements,
  key: MessageKey,
  settings: ExtensionSettings,
  language: LanguageCode,
  params?: Record<string, string>,
) {
  overlay.status.textContent = t(language, key, params);
  setTimeout(() => {
    syncSelectValue(overlay, settings, extractRegionFromUrl(window.location.href), language);
  }, 2000);
}

function updateOverlayTexts(overlay: OverlayElements, language: LanguageCode) {
  overlay.title.textContent = t(language, 'overlayTitle');
}
