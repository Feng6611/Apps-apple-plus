import { ensureDefaultSettings } from '@/src/lib/storage';

export default defineBackground(() => {
  const primeSettings = () => ensureDefaultSettings().catch((error) => {
    console.error('Failed to initialize default settings', error);
  });

  primeSettings();

  chrome.runtime.onInstalled.addListener(() => {
    primeSettings();
  });
});
