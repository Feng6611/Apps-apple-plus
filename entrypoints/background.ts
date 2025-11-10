import { ensureDefaultSettings } from '@/src/lib/storage';

const SIDEPANEL_PAGE = 'sidepanel.html';

export default defineBackground(() => {
  const sidePanelAvailable = Boolean(chrome.sidePanel?.setOptions);

  const configureSidePanel = () => {
    if (!sidePanelAvailable) {
      console.warn('Side panel API is not available in this browser.');
      return;
    }
    chrome.sidePanel!.setOptions({ path: SIDEPANEL_PAGE, enabled: true }, () => {
      const err = chrome.runtime?.lastError;
      if (err) {
        console.warn('Failed to configure side panel', err);
      }
    });
    chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: true });
  };

  const initialize = async () => {
    try {
      await ensureDefaultSettings();
    } catch (error) {
      console.error('Failed to initialize default settings', error);
    }

    chrome.action.setPopup({ popup: '' });
    configureSidePanel();
  };

  initialize();
  chrome.runtime.onInstalled.addListener(initialize);

  chrome.action.onClicked.addListener((tab) => {
    if (!sidePanelAvailable || !chrome.sidePanel?.open) {
      console.warn('Side panel API unavailable; cannot open switcher.');
      return;
    }

    const windowId = tab?.windowId ?? chrome.windows.WINDOW_ID_CURRENT;
    chrome.sidePanel.open({ windowId }, () => {
      const err = chrome.runtime?.lastError;
      if (err) {
        console.error('Failed to open side panel', err);
      }
    });
  });
});
