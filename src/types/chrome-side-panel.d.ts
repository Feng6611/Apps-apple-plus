type ChromeSidePanelConfig = {
  default_path: string;
};

declare global {
  interface WebExtensionManifest {
    side_panel?: ChromeSidePanelConfig;
  }
}

declare namespace chrome.runtime {
  interface ManifestV3 {
    side_panel?: ChromeSidePanelConfig;
  }
}

declare module 'webextension-polyfill' {
  namespace Manifest {
    interface WebExtensionManifest {
      side_panel?: ChromeSidePanelConfig;
    }
  }
}

export {};
