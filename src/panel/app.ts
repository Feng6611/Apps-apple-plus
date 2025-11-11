import './style.css';
import type { ExtensionSettings } from '@/src/lib/storage';
import { DEFAULT_SETTINGS, getSettings, saveSettings, subscribeToSettings } from '@/src/lib/storage';
import { buildRegionUrl, extractRegionFromUrl, isAppleAppStoreUrl } from '@/src/lib/url';
import { getRegionLabel, getRegionOptions, normalizeRegion } from '@/src/lib/regions';
import type { LanguageCode, MessageKey } from '@/src/lib/i18n';
import { t } from '@/src/lib/i18n';

const APP_STORE_DOMAIN = 'apps.apple.com';
const APP_STORE_URL = `https://${APP_STORE_DOMAIN}`;

export type PanelContext = 'sidepanel' | 'window' | 'popup';

type StatusState = { key: MessageKey | null; params?: Record<string, string> };

type PanelState = {
  tab: chrome.tabs.Tab | null;
  settings: ExtensionSettings;
  pinnedRegions: Set<string>;
  favoritesSaving: boolean;
  currentRegion: string;
  language: LanguageCode;
  searchQuery: string;
  status: {
    switch: StatusState;
    save: StatusState;
    notice: StatusState;
  };
};

type PanelElements = {
  root: HTMLDivElement;
  panel: HTMLDivElement;
  openSidePanelButton: HTMLButtonElement | null;
  currentRegionValue: HTMLSpanElement;
  languageSelect: HTMLSelectElement;
  searchInput: HTMLInputElement;
  regionsList: HTMLDivElement;
  notice: HTMLParagraphElement;
};

export default function initPanel(context: PanelContext): void {
  const rootElement = document.querySelector<HTMLDivElement>('#app');
  if (!(rootElement instanceof HTMLDivElement)) {
    throw new Error('Panel container not found');
  }

  document.body.dataset.panelContext = context;

  rootElement.innerHTML = `
    <div class="panel" data-context="${context}">
      <div class="panel__header">
        <span class="panel__title" data-i18n="headerTitle"></span>
        <button type="button" class="panel__open-sidepanel" id="open-sidepanel">
          <span data-i18n="openSidePanelButton"></span>
        </button>
      </div>
      <p class="panel__notice" id="panel-notice" hidden></p>
      <div class="panel__body">
        <div class="basic-info" data-section="basic">
          <span class="current-region" id="current-region-value">—</span>
          <select id="language-select" class="language-select">
            <option value="en" data-i18n-option="languageOptionEnglish"></option>
            <option value="zh" data-i18n-option="languageOptionChinese"></option>
          </select>
        </div>
        <div class="regions-section" data-section="regions">
          <input type="search" id="search-input" class="search-input" />
          <div class="regions-list" id="regions-list"></div>
        </div>
      </div>
    </div>
  `;

  const panelElement = rootElement.querySelector<HTMLDivElement>('.panel');
  if (!(panelElement instanceof HTMLDivElement)) {
    throw new Error('Panel root missing');
  }
  const panel = panelElement;

  const elements: PanelElements = {
    root: rootElement,
    panel,
    openSidePanelButton: panel.querySelector<HTMLButtonElement>('#open-sidepanel'),
    currentRegionValue: panel.querySelector<HTMLSpanElement>('#current-region-value')!,
    languageSelect: panel.querySelector<HTMLSelectElement>('#language-select')!,
    searchInput: panel.querySelector<HTMLInputElement>('#search-input')!,
    regionsList: panel.querySelector<HTMLDivElement>('#regions-list')!,
    notice: panel.querySelector<HTMLParagraphElement>('#panel-notice')!,
  };

  const state: PanelState = {
    tab: null,
    settings: DEFAULT_SETTINGS,
    pinnedRegions: new Set(DEFAULT_SETTINGS.favorites.map(normalizeRegion)),
    favoritesSaving: false,
    currentRegion: 'us',
    language: DEFAULT_SETTINGS.language,
    searchQuery: '',
    status: {
      switch: { key: null },
      save: { key: null },
      notice: { key: null },
    },
  };

  applyLanguageTexts();
  renderRegionsList();
  updateCurrentRegionLabel();

  let unsubscribe: (() => void) | undefined;
  let pendingFavoritesSnapshot: string[] | null = null;

  getSettings()
    .then((settings) => {
      applySettings(settings);
      unsubscribe = subscribeToSettings((incoming) => {
        applySettings(incoming);
      });
    })
    .catch((error) => {
      console.error('Failed to load settings', error);
      setSaveStatus('statusLoadSettingsFailed');
    });

  loadActiveTab();
  window.addEventListener('unload', () => unsubscribe?.());

  elements.searchInput.addEventListener('input', () => {
    state.searchQuery = elements.searchInput.value;
    renderRegionsList();
  });

  elements.regionsList.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const regionItem = target.closest<HTMLDivElement>('.region-item');
    if (!regionItem) {
      return;
    }

    const code = regionItem.dataset.code;
    if (!code) {
      return;
    }

    if (target.closest('.pin-button')) {
      togglePinnedRegion(code);
      return;
    }

    if (target.closest('.radio-option')) {
      handleRegionSwitch(code);
    }
  });

  elements.regionsList.addEventListener('change', (event) => {
    const target = event.target as HTMLInputElement;
    if (target?.name !== 'region' || !target.checked) {
      return;
    }

    const regionItem = target.closest<HTMLDivElement>('.region-item');
    const code = regionItem?.dataset.code;
    if (code) {
      handleRegionSwitch(code);
    }
  });

  if (elements.openSidePanelButton) {
    elements.openSidePanelButton.hidden = context !== 'popup';
    elements.openSidePanelButton.addEventListener('click', () => {
      if (elements.openSidePanelButton?.disabled) {
        return;
      }
      openSidePanel();
    });
  }

  elements.languageSelect.addEventListener('change', () => {
    const selected = (elements.languageSelect.value as LanguageCode) || 'en';
    if (selected === state.language && selected === state.settings.language) {
      return;
    }

    state.language = selected;
    state.settings.language = selected;

    applyLanguageTexts();
    renderRegionsList();
    updateCurrentRegionLabel();
    refreshStatuses();

    saveSettings({ language: selected })
      .then((saved) => {
        state.settings.language = saved.language;
      })
      .catch((error) => {
        console.error('Failed to persist language preference', error);
      });
  });

  async function handleRegionSwitch(code: string) {
    if (!state.tab?.id || !state.tab.url) {
      setSwitchStatus('statusCantLoadTab');
      return;
    }

    const nextUrl = buildRegionUrl(state.tab.url, code);
    if (!nextUrl) {
      setSwitchStatus('statusUnsupported');
      return;
    }

    if (nextUrl === state.tab.url) {
      setSwitchStatus('statusAlready');
      return;
    }

    try {
      setSwitchStatus('statusSwitching', { region: getRegionLabel(code, state.language) });
      const finalUrl = await requestRegionSwitch(state.tab.id, nextUrl);
      if (state.tab) {
        state.tab.url = finalUrl;
      }
      state.currentRegion = normalizeRegion(code);
      updateCurrentRegionLabel();
      renderRegionsList();
    } catch (error) {
      console.error('Failed to switch region', error);
      if (error instanceof Error && error.message === 'unsupported') {
        setSwitchStatus('statusUnsupported');
      } else {
        setSwitchStatus('statusSwitchFailed');
      }
    }
  }

  function applySettings(settings: ExtensionSettings) {
    state.settings = settings;
    state.pinnedRegions = new Set(settings.favorites.map(normalizeRegion));
    state.language = settings.language;
    state.favoritesSaving = false;
    pendingFavoritesSnapshot = null;

    state.currentRegion = normalizeRegion(state.currentRegion);

    applyLanguageTexts();
    renderRegionsList();
    updateCurrentRegionLabel();
    refreshStatuses();
    updateSwitchState();
  }

  async function loadActiveTab() {
    try {
      state.tab = await queryActiveTab();
      updateSwitchState();
    } catch (error) {
      console.error('Failed to read active tab', error);
      setSwitchStatus('statusCantLoadTab');
      setPanelNotice('inactiveMessage', { domain: APP_STORE_DOMAIN });
      setPanelAvailability(false);
    }
  }

  function updateSwitchState() {
    const tabUrl = state.tab?.url;

    if (!tabUrl || !isAppleAppStoreUrl(tabUrl)) {
      state.currentRegion = 'us';
      updateCurrentRegionLabel();
      setFavoritesDisabled(true);
      setSwitchStatus(null);
      setPanelNotice('inactiveMessage', { domain: APP_STORE_DOMAIN });
      setPanelAvailability(false);
      return;
    }

    const region = extractRegionFromUrl(tabUrl) ?? 'us';
    state.currentRegion = normalizeRegion(region);
    updateCurrentRegionLabel();
    setFavoritesDisabled(false);
    renderRegionsList();
    setSwitchStatus(null);
    setPanelNotice(null);
    setPanelAvailability(true);
  }

  function setPanelAvailability(enabled: boolean) {
    elements.panel.classList.toggle('panel--inactive', !enabled);
  }

  function openSidePanel() {
    if (!chrome.sidePanel?.open) {
      console.warn('Side panel API unavailable; cannot open switcher.');
      return;
    }
    const windowId = state.tab?.windowId ?? chrome.windows.WINDOW_ID_CURRENT;
    chrome.sidePanel.open({ windowId }, () => {
      const err = chrome.runtime?.lastError;
      if (err) {
        console.error('Failed to open side panel', err);
      }
    });
  }

  function setPanelNotice(key: MessageKey | null, params?: Record<string, string>) {
    state.status.notice = { key, params };
    renderNotice(key, params);
  }

  function renderNotice(key: MessageKey | null, params?: Record<string, string>) {
    if (!key) {
      elements.notice.hidden = true;
      elements.notice.textContent = '';
      return;
    }
    elements.notice.hidden = false;
    const message = t(state.language, key, params);
    elements.notice.textContent = '';
    const domain = params?.domain;
    if (key === 'inactiveMessage' && domain) {
      const domainIndex = message.indexOf(domain);
      if (domainIndex !== -1) {
        const before = message.slice(0, domainIndex);
        const after = message.slice(domainIndex + domain.length);
        if (before) {
          elements.notice.append(document.createTextNode(before));
        }
        const link = document.createElement('a');
        link.href = domain.startsWith('http') ? domain : `https://${domain}`;
        link.target = '_blank';
        link.rel = 'noreferrer noopener';
        link.textContent = domain;
        link.className = 'panel__notice-link';
        elements.notice.append(link);
        if (after) {
          elements.notice.append(document.createTextNode(after));
        }
        return;
      }
    }
    elements.notice.textContent = message;
  }

  function setFavoritesDisabled(disabled: boolean) {
    elements.regionsList.classList.toggle('regions-list--disabled', disabled);
  }

  function togglePinnedRegion(code: string) {
    const normalized = normalizeRegion(code);
    const isPinned = state.pinnedRegions.has(normalized);

    if (isPinned && state.pinnedRegions.size === 1) {
      setSaveStatus('statusSelectFavorites');
      scheduleSaveStatusClear(2000, true);
      return;
    }

    if (isPinned) {
      state.pinnedRegions.delete(normalized);
    } else {
      state.pinnedRegions.add(normalized);
    }

    renderRegionsList();
    queueFavoritesSave();
  }

  function renderRegionsList() {
    const allOptions = getRegionOptions(state.language);
    const query = state.searchQuery.trim().toLowerCase();

    const filteredOptions =
      query.length > 0
        ? allOptions.filter(
          (opt) => opt.label.toLowerCase().includes(query) || opt.code.toLowerCase().includes(query),
        )
        : allOptions;

    const pinned: typeof allOptions = [];
    const others: typeof allOptions = [];

    for (const option of filteredOptions) {
      if (state.pinnedRegions.has(option.code)) {
        pinned.push(option);
      } else {
        others.push(option);
      }
    }

    const renderItem = (code: string, label: string) => {
      const isPinned = state.pinnedRegions.has(code);
      const isCurrent = state.currentRegion === code;
      return `
        <div class="region-item" data-code="${code}" data-pinned="${isPinned}" data-current="${isCurrent}">
          <label class="radio-option">
            <input type="radio" name="region" value="${code}" ${isCurrent ? 'checked' : ''} />
            <span class="radio-indicator"></span>
            <span class="radio-label">${label}</span>
          </label>
          <button class="pin-button" type="button" aria-label="Pin region">
            <svg class="pin-icon" data-pinned="${isPinned}" viewBox="0 0 16 16">
              <path d="M9.5 1.115c-.26.132-.56.326-.885.582a4.42 4.42 0 00-.733.823l-.06.082c-.22.29-.408.572-.58.828-.172.256-.32.493-.458.703a4.12 4.12 0 00-.282.684l-.042.113-.02.06c-.052.147-.09.303-.114.47l-.014.113c-.02.138-.03.28-.033.428a.5.5 0 00.144.385.5.5 0 00.385.144c.148 0 .29-.013.428-.033l.113-.014c.167-.024.323-.062.47-.114l.06-.02.113-.042c.23-.09.45-.2.684-.282.21-.138.447-.286.703-.458.256-.172.538-.36.828-.58l.082-.06c.25-.26.49-.524.823-.733.256-.172.45-.425.582-.885a.5.5 0 00-.582-.582zM6.5 6.5a.5.5 0 000 1h3a.5.5 0 000-1h-3zM8 2a2 2 0 00-1.886 1.338l-.06.134a4.42 4.42 0 00-.428.98l-.04.098c-.12.288-.23.568-.33.838-.1.27-.188.528-.266.768a4.12 4.12 0 00-.11.458l-.018.1c-.024.13-.04.254-.05.372a.5.5 0 00.013.29.5.5 0 00.2.2l.09.025c.118.01.242.02.372.05l.1.018c.188.03.38.078.58.11.2.032.408.05.618.06l.1.002h.002l.1-.002c.21-.01.418-.028.618-.06.2-.032.392-.06.58-.11l.1-.018.09-.025a.5.5 0 00.2-.2.5.5 0 00.013-.29c-.01-.118-.026-.242-.05-.372l-.018-.1a4.12 4.12 0 00-.11-.458c-.078-.24-.166-.5-.266-.768-.1-.27-.21-.55-.33-.838l-.04-.098a4.42 4.42 0 00-.428-.98l-.06-.134A2 2 0 008 2zM3.115 9.5c-.132.26-.326.56-.582.885a4.42 4.42 0 00-.823.733l-.082.06c-.29.22-.572.408-.828.58-.256.172-.493.32-.703.458a4.12 4.12 0 00-.684.282l-.113.042-.06.02c-.147.052-.303.09-.47.114l-.113.014a.5.5 0 00-.428.963c.148 0 .29-.013.428-.033l.113-.014c.167-.024.323-.062.47-.114l.06-.02.113-.042c.23-.09.45-.2.684-.282.21-.138.447-.286.703-.458.256-.172.538-.36.828-.58l.082-.06c.25-.26.49-.524.823-.733.256-.172.45-.425.582-.885a.5.5 0 00-.582-.582z"></path>
            </svg>
          </button>
        </div>
      `;
    };

    const buildListHtml = (list: typeof allOptions, titleKey: MessageKey | null, context: PanelContext) => {
      if (list.length === 0) {
        return '';
      }
      const showTitle = titleKey && context !== 'sidepanel';
      const title = showTitle ? `<h3 class=\"regions-list__title\" data-i18n=\"${titleKey}\"></h3>` : '';
      const items = list.map((item) => renderItem(item.code, item.label)).join('');
      return `${title}<div class="regions-group">${items}</div>`;
    };

    const pinnedHtml = buildListHtml(pinned, 'pinnedLabel', context);
    const othersHtml = buildListHtml(others, 'allRegionsLabel', context);

    elements.regionsList.innerHTML = pinnedHtml + othersHtml;
    applyLanguageTexts();
  }

  function queueFavoritesSave() {
    pendingFavoritesSnapshot = Array.from(state.pinnedRegions.values());
    if (!state.favoritesSaving) {
      void persistFavoriteRegions();
    }
  }

  async function persistFavoriteRegions() {
    if (!pendingFavoritesSnapshot) {
      return;
    }

    state.favoritesSaving = true;
    const favoritesToSave = pendingFavoritesSnapshot;
    pendingFavoritesSnapshot = null;
    setSaveStatus('statusSaveInProgress');

    try {
      const next = await saveSettings({ favorites: favoritesToSave });
      state.settings.favorites = next.favorites;
      setSaveStatus('statusSaveSuccess');
      scheduleSaveStatusClear();
    } catch (error) {
      console.error('Failed to update favorite regions', error);
      state.pinnedRegions = new Set(state.settings.favorites.map(normalizeRegion));
      renderRegionsList();
      setSaveStatus('statusSaveFailed');
    } finally {
      state.favoritesSaving = false;
      if (pendingFavoritesSnapshot) {
        void persistFavoriteRegions();
      }
    }
  }

  function updateCurrentRegionLabel() {
    elements.currentRegionValue.textContent = getRegionLabel(state.currentRegion, state.language);
  }

  function setSwitchStatus(key: MessageKey | null, params?: Record<string, string>) {
    state.status.switch = { key, params };
    // Status messages removed from UI
  }

  function setSaveStatus(key: MessageKey | null, params?: Record<string, string>) {
    state.status.save = { key, params };
    // Status messages removed from UI
  }

  function scheduleSaveStatusClear(delay = 1500, clearRegardless = false) {
    // Status messages removed from UI
  }

  function refreshStatuses() {
    const { notice } = state.status;
    renderNotice(notice.key, notice.params);
  }

  function applyLanguageTexts() {
    panel.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
      const key = el.dataset.i18n as MessageKey;
      el.textContent = t(state.language, key);
    });
    panel.querySelectorAll<HTMLOptionElement>('[data-i18n-option]').forEach((option) => {
      const key = option.dataset.i18nOption as MessageKey;
      option.textContent = t(state.language, key);
    });
    elements.languageSelect.value = state.language;
    elements.searchInput.placeholder = t(state.language, 'searchPlaceholder');
    updateSidePanelButtonState();
  }

  function updateSidePanelButtonState() {
    const button = elements.openSidePanelButton;
    if (!button) {
      return;
    }
    if (context !== 'popup') {
      button.hidden = true;
      return;
    }
    button.hidden = false;
    const supported = Boolean(chrome.sidePanel?.open);
    button.disabled = !supported;
    const titleKey: MessageKey = supported ? 'openSidePanelButton' : 'openSidePanelUnavailable';
    const label = t(state.language, titleKey);
    button.title = label;
    button.setAttribute('aria-label', label);
  }
}

function queryActiveTab(): Promise<chrome.tabs.Tab | null> {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const error = chrome.runtime?.lastError;
      if (error) {
        reject(error);
        return;
      }
      resolve(tabs[0] ?? null);
    });
  });
}

function requestRegionSwitch(tabId: number, targetUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.tabs.update(tabId, { url: targetUrl }, () => {
      const updateError = chrome.runtime?.lastError;
      if (updateError) {
        reject(updateError);
        return;
      }
      resolve(targetUrl);
    });
  });
}
