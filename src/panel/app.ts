import './style.css';
import type { ExtensionSettings, PanelWindowMode } from '@/src/lib/storage';
import { DEFAULT_SETTINGS, getSettings, saveSettings, subscribeToSettings } from '@/src/lib/storage';
import { buildRegionUrl, extractRegionFromUrl, isAppleAppStoreUrl } from '@/src/lib/url';
import { getRegionLabel, getRegionOptions, normalizeRegion } from '@/src/lib/regions';
import type { LanguageCode, MessageKey } from '@/src/lib/i18n';
import { t } from '@/src/lib/i18n';

export type PanelContext = 'popup' | 'sidepanel';

type StatusState = { key: MessageKey | null; params?: Record<string, string> };

type PanelState = {
  tab: chrome.tabs.Tab | null;
  settings: ExtensionSettings;
  pinnedRegions: Set<string>;
  dirty: boolean;
  saving: boolean;
  currentRegion: string;
  language: LanguageCode;
  windowMode: PanelWindowMode;
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
  currentRegionValue: HTMLSpanElement;
  switchStatus: HTMLParagraphElement;
  overlayToggle: HTMLInputElement;
  saveButton: HTMLButtonElement;
  saveStatus: HTMLParagraphElement;
  languageSelect: HTMLSelectElement;
  searchInput: HTMLInputElement;
  regionsList: HTMLDivElement;
  notice: HTMLParagraphElement;
  windowModeInputs: HTMLInputElement[];
};

export default function initPanel(context: PanelContext): void {
  const rootElement = document.querySelector<HTMLDivElement>('#app');
  if (!(rootElement instanceof HTMLDivElement)) {
    throw new Error('Panel container not found');
  }

  document.body.dataset.panelContext = context;

  rootElement.innerHTML = `
    <div class="panel" data-context="${context}">
      <header class="panel__header">
        <h1 data-i18n="headerTitle"></h1>
        <a
          href="https://apps.apple.com"
          target="_blank"
          rel="noreferrer"
          data-i18n="headerLinkLabel"
        ></a>
      </header>
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
          <p class="status" id="switch-status"></p>
          <div class="settings-group">
            <div class="settings-row">
              <label class="toggle">
                <input type="checkbox" id="overlay-toggle" />
                <span data-i18n="overlayToggleLabel"></span>
              </label>
              <button id="save-button" type="button" disabled data-i18n="saveButton"></button>
            </div>
            <div class="window-mode" id="window-mode">
              <span class="window-mode__label" data-i18n="windowModeLabel"></span>
              <div class="window-mode__options">
                <label class="window-mode__option">
                  <input type="radio" name="window-mode" value="popup" />
                  <span data-i18n="windowModePopup"></span>
                </label>
                <label class="window-mode__option">
                  <input type="radio" name="window-mode" value="sidepanel" />
                  <span data-i18n="windowModeSidepanel"></span>
                </label>
              </div>
            </div>
          </div>
          <p class="status" id="save-status"></p>
        </div>
      </div>
    </div>
  `;

  const panel = rootElement.querySelector<HTMLDivElement>('.panel');
  if (!panel) {
    throw new Error('Panel root missing');
  }

  const elements: PanelElements = {
    root: rootElement,
    panel,
    currentRegionValue: panel.querySelector<HTMLSpanElement>('#current-region-value')!,
    switchStatus: panel.querySelector<HTMLParagraphElement>('#switch-status')!,
    overlayToggle: panel.querySelector<HTMLInputElement>('#overlay-toggle')!,
    saveButton: panel.querySelector<HTMLButtonElement>('#save-button')!,
    saveStatus: panel.querySelector<HTMLParagraphElement>('#save-status')!,
    languageSelect: panel.querySelector<HTMLSelectElement>('#language-select')!,
    searchInput: panel.querySelector<HTMLInputElement>('#search-input')!,
    regionsList: panel.querySelector<HTMLDivElement>('#regions-list')!,
    notice: panel.querySelector<HTMLParagraphElement>('#panel-notice')!,
    windowModeInputs: Array.from(panel.querySelectorAll<HTMLInputElement>('input[name="window-mode"]')),
  };

  const state: PanelState = {
    tab: null,
    settings: DEFAULT_SETTINGS,
    pinnedRegions: new Set(DEFAULT_SETTINGS.favorites.map(normalizeRegion)),
    dirty: false,
    saving: false,
    currentRegion: 'us',
    language: DEFAULT_SETTINGS.language,
    windowMode: DEFAULT_SETTINGS.windowMode,
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
  updateSaveButtonState();
  syncWindowModeSelection();

  let unsubscribe: (() => void) | undefined;

  getSettings()
    .then((settings) => {
      applySettings(settings);
      unsubscribe = subscribeToSettings((incoming) => {
        if (!state.dirty) {
          applySettings(incoming);
        }
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
      if (state.pinnedRegions.has(code)) {
        state.pinnedRegions.delete(code);
      } else {
        state.pinnedRegions.add(code);
      }
      renderRegionsList();
      updateDirtyState();
      return;
    }

    if (target.closest('.radio-option')) {
      handleRegionSwitch(code);
    }
  });

  elements.overlayToggle.addEventListener('change', () => updateDirtyState());

  elements.windowModeInputs.forEach((input) => {
    input.addEventListener('change', () => {
      if (input.checked) {
        state.windowMode = input.value as PanelWindowMode;
        updateDirtyState();
      }
    });
  });

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
    updateDirtyState();

    saveSettings({ language: selected })
      .then((saved) => {
        state.settings.language = saved.language;
      })
      .catch((error) => {
        console.error('Failed to persist language preference', error);
      });
  });

  elements.saveButton.addEventListener('click', async () => {
    if (!state.dirty || state.saving) {
      return;
    }

    const favorites = Array.from(state.pinnedRegions.values());
    if (favorites.length === 0) {
      setSaveStatus('statusSelectFavorites');
      return;
    }

    state.saving = true;
    updateSaveButtonState();
    setSaveStatus('statusSaveInProgress');

    try {
      const next = await saveSettings({
        favorites,
        overlayEnabled: elements.overlayToggle.checked,
        language: state.language,
        windowMode: state.windowMode,
      });
      applySettings(next);
      setSaveStatus('statusSaveSuccess');
      setTimeout(() => {
        if (!state.dirty) {
          setSaveStatus(null);
        }
      }, 1500);
    } catch (error) {
      console.error('Failed to save settings', error);
      setSaveStatus('statusSaveFailed');
    } finally {
      state.saving = false;
      updateSaveButtonState();
    }
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
      const finalUrl = await requestRegionSwitch(state.tab.id, code, nextUrl);
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
    state.windowMode = settings.windowMode;

    elements.overlayToggle.checked = settings.overlayEnabled;
    state.currentRegion = normalizeRegion(state.currentRegion);

    applyLanguageTexts();
    renderRegionsList();
    updateCurrentRegionLabel();
    refreshStatuses();
    syncWindowModeSelection();
    updateDirtyState();
    updateSwitchState();
  }

  async function loadActiveTab() {
    try {
      state.tab = await queryActiveTab();
      updateSwitchState();
    } catch (error) {
      console.error('Failed to read active tab', error);
      setSwitchStatus('statusCantLoadTab');
      setPanelNotice('inactiveMessage', { domain: 'apps.apple.com' });
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
      setPanelNotice('inactiveMessage', { domain: 'apps.apple.com' });
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

  function syncWindowModeSelection() {
    for (const input of elements.windowModeInputs) {
      input.checked = input.value === state.windowMode;
    }
  }

  function setPanelNotice(key: MessageKey | null, params?: Record<string, string>) {
    state.status.notice = { key, params };
    if (!key) {
      elements.notice.hidden = true;
      elements.notice.textContent = '';
      return;
    }
    elements.notice.hidden = false;
    elements.notice.textContent = t(state.language, key, params);
  }

  function setFavoritesDisabled(disabled: boolean) {
    elements.regionsList.classList.toggle('regions-list--disabled', disabled);
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

    const buildListHtml = (list: typeof allOptions, titleKey: MessageKey | null) => {
      if (list.length === 0) {
        return '';
      }
      const title = titleKey ? `<h3 class=\"regions-list__title\" data-i18n=\"${titleKey}\"></h3>` : '';
      const items = list.map((item) => renderItem(item.code, item.label)).join('');
      return `${title}<div class="regions-group">${items}</div>`;
    };

    const pinnedHtml = buildListHtml(pinned, 'pinnedLabel');
    const othersHtml = buildListHtml(others, 'allRegionsLabel');

    elements.regionsList.innerHTML = pinnedHtml + othersHtml;
    applyLanguageTexts();
  }

  function updateCurrentRegionLabel() {
    elements.currentRegionValue.textContent = getRegionLabel(state.currentRegion, state.language);
  }

  function updateDirtyState() {
    const overlayChanged = elements.overlayToggle.checked !== state.settings.overlayEnabled;
    const favoritesChanged = !areSetsEqual(
      state.pinnedRegions,
      new Set(state.settings.favorites.map(normalizeRegion)),
    );
    const languageChanged = state.language !== state.settings.language;
    const windowModeChanged = state.windowMode !== state.settings.windowMode;

    state.dirty = overlayChanged || favoritesChanged || languageChanged || windowModeChanged;
    updateSaveButtonState();
  }

  function updateSaveButtonState() {
    elements.saveButton.disabled = !state.dirty || state.saving;
  }

  function setSwitchStatus(key: MessageKey | null, params?: Record<string, string>) {
    state.status.switch = { key, params };
    elements.switchStatus.textContent = key ? t(state.language, key, params) : '';
  }

  function setSaveStatus(key: MessageKey | null, params?: Record<string, string>) {
    state.status.save = { key, params };
    elements.saveStatus.textContent = key ? t(state.language, key, params) : '';
  }

  function refreshStatuses() {
    const { switch: switchStatus, save: saveStatus, notice } = state.status;
    elements.switchStatus.textContent = switchStatus.key
      ? t(state.language, switchStatus.key, switchStatus.params)
      : '';
    elements.saveStatus.textContent = saveStatus.key
      ? t(state.language, saveStatus.key, saveStatus.params)
      : '';
    if (notice.key) {
      elements.notice.hidden = false;
      elements.notice.textContent = t(state.language, notice.key, notice.params);
    } else {
      elements.notice.hidden = true;
      elements.notice.textContent = '';
    }
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
  }
}

function areSetsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const item of a) {
    if (!b.has(item)) return false;
  }
  return true;
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

function requestRegionSwitch(tabId: number, region: string, fallbackUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, { type: 'switch-region', region }, (response) => {
      const messageError = chrome.runtime?.lastError;
      if (messageError || !response?.success) {
        chrome.tabs.update(tabId, { url: fallbackUrl }, () => {
          const updateError = chrome.runtime?.lastError;
          if (updateError) {
            reject(updateError);
          } else {
            resolve(fallbackUrl);
          }
        });
        return;
      }

      const url = typeof response.url === 'string' ? response.url : fallbackUrl;
      resolve(url);
    });
  });
}
