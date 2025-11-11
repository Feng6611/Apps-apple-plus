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
  };

  const initialize = async () => {
    try {
      await ensureDefaultSettings();
    } catch (error) {
      console.error('Failed to initialize default settings', error);
    }

    configureSidePanel();
  };

  initialize();
  chrome.runtime.onInstalled.addListener(initialize);
});
