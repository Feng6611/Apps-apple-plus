import { createRequire } from 'node:module';
import { defineConfig } from 'wxt';

const require = createRequire(import.meta.url);
const { version } = require('./package.json');

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
  manifest: ({ browser }) => {
    // Safari (MV2) 不支持 side panel，需要移除相关配置
    const isSafari = browser === 'safari';

    const baseManifest: any = {
      name: 'App Store Plus',
      description: 'Quickly switch App Store regions from the popup or side panel.',
      version,
      permissions: ['storage', 'tabs', 'windows'],
      action: {
        default_title: 'App Store 区域切换',
        default_popup: 'popup.html',
      },
      icons: {
        16: 'icon/16.png',
        32: 'icon/32.png',
        48: 'icon/48.png',
        96: 'icon/96.png',
        128: 'icon/128.png',
      },
    };

    // Chrome 和 Firefox 支持 side panel
    if (!isSafari) {
      baseManifest.permissions.push('sidePanel');
      baseManifest.side_panel = {
        default_path: 'sidepanel.html',
      };
    }

    // Firefox 特定配置
    if (browser === 'firefox') {
      baseManifest.applications = {
        gecko: {
          id: 'app-store-plus@yourdomain.com',
          strict_min_version: '109.0',
        },
      };
    }

    return baseManifest;
  },
});
