import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'App Store Region Switcher',
    description: 'Quickly switch App Store regions from the page overlay or popup.',
    version: '0.1.0',
    permissions: ['storage', 'tabs', 'sidePanel', 'windows'],
    host_permissions: ['https://apps.apple.com/*'],
    action: {
      default_title: 'App Store 区域切换',
    },
    side_panel: {
      default_path: 'sidepanel/index.html',
    },
    icons: {
      16: 'icon/16.png',
      32: 'icon/32.png',
      48: 'icon/48.png',
      96: 'icon/96.png',
      128: 'icon/128.png',
    },
  },
});
