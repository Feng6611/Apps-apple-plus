import { defineConfig } from 'wxt';

export default defineConfig({
  hooks: {
    'vite:devServer:extendConfig': (config) => {
      config.server ??= {};
      config.server.host = 'localhost';
      const currentHmr = config.server.hmr;
      if (currentHmr && typeof currentHmr === 'object') {
        config.server.hmr = { ...currentHmr, host: 'localhost' };
      } else {
        config.server.hmr = { host: 'localhost' };
      }
    },
  },
  manifest: {
    name: 'App Store Region Switcher',
    description: 'Quickly switch App Store regions from the popup or side panel.',
    version: '0.1.0',
    permissions: ['storage', 'tabs', 'sidePanel', 'windows'],
    action: {
      default_title: 'App Store 区域切换',
      default_popup: 'popup.html',
    },
    side_panel: {
      default_path: 'sidepanel.html',
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
