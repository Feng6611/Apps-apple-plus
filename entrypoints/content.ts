import type { ExtensionSettings } from '@/src/lib/storage';
import { DEFAULT_SETTINGS, getSettings, subscribeToSettings } from '@/src/lib/storage';
import { getRegionLabel, normalizeRegion } from '@/src/lib/regions';
import { buildRegionUrl, extractRegionFromUrl } from '@/src/lib/url';
import type { LanguageCode, MessageKey } from '@/src/lib/i18n';
import { t } from '@/src/lib/i18n';

const OVERLAY_ID = 'appstore-region-switcher-overlay';
const TITLE_ID = 'appstore-region-switcher-title';
const SELECT_ID = 'appstore-region-switcher-select';
const EMBED_STYLE_ID = 'appstore-region-switcher-embed-style';
const EMBED_CONTAINER_ID = 'appstore-region-switcher-embed';
const EMBED_HOST_SELECTOR =
  'body > div > div > div.navigation-container.svelte-sh6d9r > div > nav > div.navigation__header.svelte-13li0vp > div.platform-selector-container.svelte-8pxmff';

type NavigationEmbedController = {
  update: (settings: ExtensionSettings, language: LanguageCode, currentRegion: string) => void;
};

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
    injectEmbedStyles();
    const embed = createNavigationEmbed((code) => {
      attemptRegionSwitch(code, overlay, cachedSettings, currentLanguage);
    });
    updateOverlayTexts(overlay, currentLanguage);

    const refresh = (settings: ExtensionSettings) => {
      cachedSettings = settings;
      currentLanguage = settings.language;
      updateOverlayTexts(overlay, currentLanguage);
      updateOverlay(overlay, cachedSettings, currentLanguage);
      updateFromLocation();
    };

    const updateFromLocation = () => {
      const rawRegion = extractRegionFromUrl(window.location.href);
      const normalizedRegion = normalizeRegion(rawRegion ?? 'us');
      syncSelectValue(overlay, cachedSettings, rawRegion, currentLanguage);
      embed.update(cachedSettings, currentLanguage, normalizedRegion);
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
      attemptRegionSwitch(selected, overlay, cachedSettings, currentLanguage);
    });

    function attemptRegionSwitch(
      region: string,
      overlayElements: OverlayElements,
      settings: ExtensionSettings,
      language: LanguageCode,
    ) {
      const nextUrl = buildRegionUrl(window.location.href, region);
      if (!nextUrl) {
        showStatus(overlayElements, 'overlayStatusUnsupported', settings, language);
        return;
      }
      if (nextUrl === window.location.href) {
        showStatus(overlayElements, 'overlayStatusAlready', settings, language);
        return;
      }
      showStatus(overlayElements, 'overlayStatusSwitching', settings, language, {
        region: getRegionLabel(region, language),
      });
      window.location.href = nextUrl;
    }

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

function injectEmbedStyles(): void {
  if (document.getElementById(EMBED_STYLE_ID)) {
    return;
  }
  const style = document.createElement('style');
  style.id = EMBED_STYLE_ID;
  style.textContent = `
    #${EMBED_CONTAINER_ID} {
      position: relative;
      margin-top: 12px;
    }
    #${EMBED_CONTAINER_ID} *,
    #${EMBED_CONTAINER_ID} *::before,
    #${EMBED_CONTAINER_ID} *::after {
      box-sizing: border-box;
      font-family: inherit;
    }
    #${EMBED_CONTAINER_ID} .asrs-embed__trigger {
      width: 100%;
      padding: 10px 14px;
      border-radius: 10px;
      border: 1px solid #d1d5db;
      background: #ffffff;
      display: flex;
      align-items: center;
      gap: 12px;
      justify-content: space-between;
      font-size: 13px;
      color: #111827;
      cursor: pointer;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
      transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
    }
    #${EMBED_CONTAINER_ID} .asrs-embed__trigger:hover {
      border-color: #0066cc;
      box-shadow: 0 3px 6px rgba(0, 102, 204, 0.12);
      background: #f9fbff;
    }
    #${EMBED_CONTAINER_ID} .asrs-embed__trigger:disabled {
      cursor: default;
      opacity: 0.65;
      box-shadow: none;
    }
    #${EMBED_CONTAINER_ID} .asrs-embed__prefix {
      font-weight: 500;
      color: #4b5563;
    }
    #${EMBED_CONTAINER_ID} .asrs-embed__value {
      margin-left: auto;
      font-weight: 600;
      color: #111827;
    }
    #${EMBED_CONTAINER_ID} .asrs-embed__icon {
      display: flex;
      align-items: center;
      margin-left: 8px;
      transition: transform 0.2s ease;
      color: #6b7280;
    }
    #${EMBED_CONTAINER_ID}.asrs-embed--open .asrs-embed__icon {
      transform: rotate(-180deg);
    }
    #${EMBED_CONTAINER_ID} .asrs-embed__options {
      position: absolute;
      top: calc(100% + 6px);
      left: 0;
      right: 0;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      box-shadow: 0 16px 30px rgba(15, 23, 42, 0.18);
      padding: 6px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      opacity: 0;
      pointer-events: none;
      transform: translateY(-4px);
      transition: opacity 0.16s ease, transform 0.16s ease;
      z-index: 10;
    }
    #${EMBED_CONTAINER_ID}.asrs-embed--open .asrs-embed__options {
      opacity: 1;
      pointer-events: auto;
      transform: translateY(0);
    }
    #${EMBED_CONTAINER_ID} .asrs-embed__option {
      border: none;
      border-radius: 8px;
      background: transparent;
      padding: 8px 10px;
      text-align: left;
      font-size: 13px;
      color: #1f2937;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      transition: background 0.15s ease, color 0.15s ease;
    }
    #${EMBED_CONTAINER_ID} .asrs-embed__option:hover {
      background: #f3f4f6;
    }
    #${EMBED_CONTAINER_ID} .asrs-embed__option[data-current='true'] {
      background: #e8f1ff;
      color: #0052a3;
      font-weight: 600;
    }
    #${EMBED_CONTAINER_ID} .asrs-embed__option[data-current='true']::after {
      content: '•';
      font-size: 16px;
      margin-left: 8px;
      color: #2563eb;
    }
    #${EMBED_CONTAINER_ID} .asrs-embed__placeholder {
      margin: 8px 0 0;
      font-size: 12px;
      color: #6b7280;
    }
    #${EMBED_CONTAINER_ID}.asrs-embed--empty .asrs-embed__options {
      display: none;
    }
    #${EMBED_CONTAINER_ID}.asrs-embed--empty .asrs-embed__trigger {
      justify-content: flex-start;
      gap: 8px;
    }
  `;
  (document.head ?? document.documentElement).appendChild(style);
}

function createNavigationEmbed(onSelect: (code: string) => void): NavigationEmbedController {
  let container = document.getElementById(EMBED_CONTAINER_ID) as HTMLDivElement | null;
  let trigger: HTMLButtonElement | null = null;
  let prefixSpan: HTMLSpanElement | null = null;
  let valueSpan: HTMLSpanElement | null = null;
  let optionsContainer: HTMLDivElement | null = null;
  let isOpen = false;
  let lastState: { settings: ExtensionSettings; language: LanguageCode; currentRegion: string } | null = null;
  let observer: MutationObserver | null = null;
  let globalListenersBound = false;

  const ensureContainer = (): boolean => {
    if (container && document.contains(container)) {
      return true;
    }

    const host = document.querySelector<HTMLElement>(EMBED_HOST_SELECTOR);
    if (!host || !host.parentElement) {
      return false;
    }

    container = document.createElement('div');
    container.id = EMBED_CONTAINER_ID;
    container.className = 'asrs-embed';

    trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'asrs-embed__trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');

    prefixSpan = document.createElement('span');
    prefixSpan.className = 'asrs-embed__prefix';

    valueSpan = document.createElement('span');
    valueSpan.className = 'asrs-embed__value';

    const iconSpan = document.createElement('span');
    iconSpan.className = 'asrs-embed__icon';
    iconSpan.innerHTML =
      '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path fill="currentColor" d="M2.47 4.47a.75.75 0 0 1 1.06 0L6 6.94l2.47-2.47a.75.75 0 1 1 1.06 1.06L6.53 8.53a.75.75 0 0 1-1.06 0L2.47 5.53a.75.75 0 0 1 0-1.06z" /></svg>';

    trigger.append(prefixSpan, valueSpan, iconSpan);

    optionsContainer = document.createElement('div');
    optionsContainer.className = 'asrs-embed__options';
    optionsContainer.setAttribute('role', 'listbox');

    container.append(trigger, optionsContainer);
    host.insertAdjacentElement('afterend', container);

    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      if (trigger?.disabled) {
        return;
      }
      toggle(!isOpen);
    });

    optionsContainer.addEventListener('click', (event) => {
      const target = (event.target as HTMLElement).closest<HTMLButtonElement>('.asrs-embed__option');
      if (!target) {
        return;
      }
      const region = target.dataset.region;
      if (!region) {
        return;
      }
      onSelect(region);
      toggle(false);
    });

    bindGlobalListeners();

    if (observer) {
      observer.disconnect();
      observer = null;
    }

    if (lastState) {
      render(lastState.settings, lastState.language, lastState.currentRegion);
    }

    return true;
  };

  const toggle = (open: boolean) => {
    if (!container || !trigger) {
      return;
    }
    isOpen = open;
    container.classList.toggle('asrs-embed--open', isOpen);
    trigger.setAttribute('aria-expanded', String(isOpen));
  };

  const bindGlobalListeners = () => {
    if (globalListenersBound) {
      return;
    }
    document.addEventListener('click', (event) => {
      if (!container) {
        return;
      }
      if (!container.contains(event.target as Node)) {
        toggle(false);
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        toggle(false);
      }
    });
    globalListenersBound = true;
  };

  const render = (settings: ExtensionSettings, language: LanguageCode, currentRegion: string) => {
    if (!container || !trigger || !prefixSpan || !valueSpan || !optionsContainer) {
      return;
    }

    const favorites = Array.from(new Set(settings.favorites.map(normalizeRegion)));
    const prefixBase = t(language, 'embedLabel', { region: '' }).trim();

    if (favorites.length === 0) {
      container.classList.add('asrs-embed--empty');
      trigger.disabled = true;
      prefixSpan.textContent = t(language, 'embedEmpty');
      valueSpan.textContent = '';
      optionsContainer.innerHTML = '';
      toggle(false);
      return;
    }

    container.classList.remove('asrs-embed--empty');
    trigger.disabled = false;
    const currentLabel = getRegionLabel(currentRegion, language);
    if (prefixBase) {
      prefixSpan.textContent = prefixBase;
      valueSpan.textContent = currentLabel;
    } else {
      prefixSpan.textContent = t(language, 'embedLabel', { region: currentLabel });
      valueSpan.textContent = '';
    }

    const optionsHtml = favorites
      .map((region) => {
        const label = getRegionLabel(region, language);
        const isCurrent = region === currentRegion;
        return `<button type="button" class="asrs-embed__option" data-region="${region}" data-current="${isCurrent}">${label}</button>`;
      })
      .join('');
    optionsContainer.innerHTML = optionsHtml;
    toggle(false);
  };

  observer = new MutationObserver(() => {
    if (ensureContainer() && lastState) {
      render(lastState.settings, lastState.language, lastState.currentRegion);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  ensureContainer();

  return {
    update(settings, language, currentRegion) {
      lastState = { settings, language, currentRegion };
      if (ensureContainer()) {
        render(settings, language, currentRegion);
      }
    },
  };
}

function updateOverlayTexts(overlay: OverlayElements, language: LanguageCode) {
  overlay.title.textContent = t(language, 'overlayTitle');
}
