export type LanguageCode = 'en' | 'zh';

const messages = {
  en: {
    headerTitle: 'Region Switch',
    headerLinkLabel: 'apps.apple.com',
    sectionBasic: 'Basic Info',
    sectionSwitch: 'Region Switch',
    currentRegionLabel: 'Current region',
    languageLabel: 'Language',
    languageOptionEnglish: 'English',
    languageOptionChinese: '中文',
    openSidePanelButton: 'Open side panel',
    openSidePanelUnavailable: 'Side panel is not available in this browser.',
    searchPlaceholder: 'Search regions',
    pinnedLabel: 'Pinned',
    allRegionsLabel: 'All Regions',
    moreRegionsButton: 'More regions',
    moreRegionsHint: 'Checked regions will appear above.',
    statusSwitching: 'Switching to {region}…',
    statusAlready: 'Already in this region.',
    statusUnsupported: 'Only works on apps.apple.com pages.',
    statusCantLoadTab: 'Unable to get the current tab.',
    inactiveMessage: "Switcher can't run on this page. Visit {domain} to use it.",
    statusSaveInProgress: 'Saving…',
    statusSaveSuccess: 'Saved.',
    statusSaveFailed: 'Save failed. Try again.',
    statusLoadSettingsFailed: 'Failed to load settings. Try again.',
    statusSelectFavorites: 'Select at least one region.',
    statusSwitchFailed: 'Failed to switch region. Try again.',
    favoritePlaceholder: 'Select regions in “More regions” to show them here.',
  },
  zh: {
    headerTitle: 'Region Switch',
    headerLinkLabel: 'apps.apple.com',
    sectionBasic: '基本信息',
    sectionSwitch: '地区切换',
    currentRegionLabel: '当前地区',
    languageLabel: '界面语言',
    languageOptionEnglish: '英文',
    languageOptionChinese: '中文',
    openSidePanelButton: '打开侧边栏',
    openSidePanelUnavailable: '此浏览器不支持侧边栏。',
    searchPlaceholder: '搜索地区',
    pinnedLabel: '已置顶',
    allRegionsLabel: '所有地区',
    moreRegionsButton: '更多地区',
    moreRegionsHint: '勾选后会显示在上方列表。',
    statusSwitching: '正在切换到 {region}…',
    statusAlready: '已处于该地区。',
    statusUnsupported: '仅支持 apps.apple.com 页面。',
    statusCantLoadTab: '无法获取当前标签页。',
    inactiveMessage: 'Switcher 无法在此页面运行。请前往 {domain} 使用。',
    statusSaveInProgress: '保存中…',
    statusSaveSuccess: '已保存。',
    statusSaveFailed: '保存失败，请重试。',
    statusLoadSettingsFailed: '设置加载失败，请稍后重试。',
    statusSelectFavorites: '请至少勾选一个地区。',
    statusSwitchFailed: '切换失败，请重试。',
    favoritePlaceholder: '请在右侧“更多地区”勾选要显示的地区。',
  },
} as const;

export type MessageKey = keyof typeof messages.en;

export function t(language: LanguageCode, key: MessageKey, params?: Record<string, string>): string {
  const available = messages[language][key] ?? messages.en[key];
  if (!params) {
    return available;
  }
  return available.replace(/\{(\w+)\}/g, (_, token: string) => params[token] ?? '');
}

export const LANGUAGE_OPTIONS: Array<{ code: LanguageCode; label: string }> = [
  { code: 'en', label: messages.en.languageOptionEnglish },
  { code: 'zh', label: messages.zh.languageOptionChinese },
];
