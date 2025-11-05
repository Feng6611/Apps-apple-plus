import type { ExtensionSettings, PanelWindowMode } from '@/src/lib/storage';
import { DEFAULT_SETTINGS, ensureDefaultSettings, getSettings, subscribeToSettings } from '@/src/lib/storage';

export default defineBackground(() => {
  let currentWindowMode: PanelWindowMode = DEFAULT_SETTINGS.windowMode;
  let popupWindowId: number | null = null;

  const sidePanelAvailable = Boolean(chrome.sidePanel?.setOptions);

  const initialize = async () => {
    try {
      await ensureDefaultSettings();
    } catch (error) {
      console.error('Failed to initialize default settings', error);
    }

    if (sidePanelAvailable) {
      chrome.sidePanel!.setOptions({ path: 'sidepanel/index.html', enabled: true }, () => {
        const err = chrome.runtime?.lastError;
        if (err) {
          console.warn('Failed to configure side panel', err);
        }
      });
    }

    try {
      const settings = await getSettings();
      applySettings(settings);
    } catch (error) {
      console.error('Failed to load settings in background', error);
    }
  };

  const applySettings = (settings: ExtensionSettings) => {
    currentWindowMode = settings.windowMode;
  };

  initialize();

  chrome.runtime.onInstalled.addListener(() => {
    initialize();
  });

  subscribeToSettings((settings) => {
    applySettings(settings);
  });

  chrome.action.onClicked.addListener((tab) => {
    if (currentWindowMode === 'sidepanel' && sidePanelAvailable && chrome.sidePanel?.open) {
      const windowId = tab?.windowId ?? chrome.windows.WINDOW_ID_CURRENT;
      chrome.sidePanel.open({ windowId }, () => {
        const err = chrome.runtime?.lastError;
        if (err) {
          console.warn('Failed to open side panel, falling back to popup', err);
          openPopupWindow();
        }
      });
      return;
    }

    openPopupWindow();
  });

  chrome.windows.onRemoved.addListener((windowId) => {
    if (popupWindowId !== null && windowId === popupWindowId) {
      popupWindowId = null;
    }
  });

  function openPopupWindow() {
    if (popupWindowId !== null) {
      chrome.windows.get(popupWindowId, (existing) => {
        const err = chrome.runtime?.lastError;
        if (!err && existing) {
          chrome.windows.update(popupWindowId!, { focused: true });
          return;
        }
        popupWindowId = null;
        createPopupWindow();
      });
      return;
    }

    createPopupWindow();
  }

  function createPopupWindow() {
    chrome.windows.create(
      {
        url: chrome.runtime.getURL('popup/index.html'),
        type: 'popup',
        width: 420,
        height: 560,
        focused: true,
      },
      (created) => {
        const err = chrome.runtime?.lastError;
        if (err) {
          console.error('Failed to open popup window', err);
          return;
        }
        popupWindowId = created?.id ?? null;
      },
    );
  }
});
