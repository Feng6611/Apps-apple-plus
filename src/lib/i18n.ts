export type LanguageCode = 'en' | 'zh';

const messages = {
  en: {
    headerTitle: 'AppStoreSwitcher',
    headerLinkLabel: 'apps.apple.com',
    sectionBasic: 'Basic Info',
    sectionSwitch: 'Region Switch',
    currentRegionLabel: 'Current region',
    languageLabel: 'Language',
    languageOptionEnglish: 'English',
    languageOptionChinese: '中文',
    searchPlaceholder: 'Search regions',
    pinnedLabel: 'Pinned',
    allRegionsLabel: 'All Regions',
    moreRegionsButton: 'More regions',
    moreRegionsHint: 'Checked regions will appear above.',
    overlayToggleLabel: 'Show quick switch overlay on page',
    saveButton: 'Save settings',
    statusOpenAppStore: 'Open an apps.apple.com page first.',
    statusSwitching: 'Switching to {region}…',
    statusAlready: 'Already in this region.',
    statusUnsupported: 'Only works on apps.apple.com pages.',
    statusCantLoadTab: 'Unable to get the current tab.',
    statusSaveInProgress: 'Saving…',
    statusSaveSuccess: 'Saved.',
    statusSaveFailed: 'Save failed. Try again.',
    statusLoadSettingsFailed: 'Failed to load settings. Try again.',
    statusSelectFavorites: 'Select at least one region.',
    statusSwitchFailed: 'Failed to switch region. Try again.',
    favoritePlaceholder: 'Select regions in “More regions” to show them here.',
    overlayTitle: 'App Store Region',
    overlayStatusHint: 'Configure favorite regions in the popup.',
    overlayStatusCurrent: 'Current: {region}',
    overlayStatusSelected: 'Selected: {region}',
    overlayStatusUnsupported: 'This page does not support region switching.',
    overlayStatusAlready: 'Already in this region.',
    overlayStatusNoFavorites: 'No regions available. Configure them in the popup.',
    overlayStatusSwitching: 'Switching to {region}…',
  },
  zh: {
    headerTitle: 'AppStoreSwitcher',
    headerLinkLabel: 'apps.apple.com',
    sectionBasic: '基本信息',
    sectionSwitch: '地区切换',
    currentRegionLabel: '当前地区',
    languageLabel: '界面语言',
    languageOptionEnglish: '英文',
    languageOptionChinese: '中文',
    searchPlaceholder: '搜索地区',
    pinnedLabel: '已置顶',
    allRegionsLabel: '所有地区',
    moreRegionsButton: '更多地区',
    moreRegionsHint: '勾选后会显示在上方列表。',
    overlayToggleLabel: '页面左上角显示快速切换控件',
    saveButton: '保存设置',
    statusOpenAppStore: '请先打开 apps.apple.com 页面。',
    statusSwitching: '正在切换到 {region}…',
    statusAlready: '已处于该地区。',
    statusUnsupported: '仅支持 apps.apple.com 页面。',
    statusCantLoadTab: '无法获取当前标签页。',
    statusSaveInProgress: '保存中…',
    statusSaveSuccess: '已保存。',
    statusSaveFailed: '保存失败，请重试。',
    statusLoadSettingsFailed: '设置加载失败，请稍后重试。',
    statusSelectFavorites: '请至少勾选一个地区。',
    statusSwitchFailed: '切换失败，请重试。',
    favoritePlaceholder: '请在右侧“更多地区”勾选要显示的地区。',
    overlayTitle: 'App Store 区域',
    overlayStatusHint: '请在弹窗中配置常用地区。',
    overlayStatusCurrent: '当前：{region}',
    overlayStatusSelected: '已选择：{region}',
    overlayStatusUnsupported: '当前页面不支持切换区域。',
    overlayStatusAlready: '已处于该地区。',
    overlayStatusNoFavorites: '没有可用地区，请在弹窗中配置。',
    overlayStatusSwitching: '正在切换到 {region}…',
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
