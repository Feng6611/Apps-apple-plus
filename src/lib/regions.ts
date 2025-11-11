import type { LanguageCode } from './i18n';
import type { RegionInfo } from '../data/regions';
import { REGION_DATA, getRegionInfo } from '../data/regions';

export type RegionCode = string;

export const DEFAULT_FAVORITE_REGIONS: RegionCode[] = ['us', 'cn', 'jp', 'gb', 'de', 'in'];

const regionIndex = new Map<string, RegionInfo>(
  REGION_DATA.map((region) => [region.code, region]),
);

export function normalizeRegion(code: string): RegionCode {
  return code.trim().toLowerCase();
}

export function isValidRegion(code: string): boolean {
  return regionIndex.has(normalizeRegion(code));
}

export function filterValidRegions(regions: RegionCode[]): RegionCode[] {
  const unique = new Set<RegionCode>();
  for (const region of regions) {
    const normalized = normalizeRegion(region);
    if (isValidRegion(normalized)) {
      unique.add(normalized);
    }
  }
  return Array.from(unique);
}

function formatLabel(info: RegionInfo, language: LanguageCode): string {
  const code = info.code.toUpperCase();
  const base = language === 'zh' ? info.chinese : info.english;
  return `${base} (${code})`;
}

export function getRegionLabel(code: string, language: LanguageCode): string {
  const info = getRegionInfo(code);
  if (!info) {
    const fallbackCode = code.trim().toUpperCase();
    return fallbackCode;
  }
  return formatLabel(info, language);
}

export function getAllRegionCodes(): RegionCode[] {
  return REGION_DATA.map((region) => region.code);
}

export function getRegionOptions(language: LanguageCode): Array<{ code: RegionCode; label: string }> {
  const allOptions = REGION_DATA.map((info) => ({
    code: info.code,
    label: formatLabel(info, language),
  }));

  // 创建默认收藏国家的索引映射，用于排序
  const defaultOrder = new Map<RegionCode, number>();
  DEFAULT_FAVORITE_REGIONS.forEach((code, index) => {
    defaultOrder.set(code, index);
  });

  // 分离默认收藏国家和其他国家
  const defaultRegions: Array<{ code: RegionCode; label: string }> = [];
  const otherRegions: Array<{ code: RegionCode; label: string }> = [];

  for (const option of allOptions) {
    if (defaultOrder.has(option.code)) {
      defaultRegions.push(option);
    } else {
      otherRegions.push(option);
    }
  }

  // 默认收藏国家按指定顺序排序
  defaultRegions.sort((a, b) => {
    const orderA = defaultOrder.get(a.code) ?? Infinity;
    const orderB = defaultOrder.get(b.code) ?? Infinity;
    return orderA - orderB;
  });

  // 其他国家按首字母排序
  otherRegions.sort((a, b) => a.label.localeCompare(b.label, language === 'zh' ? 'zh-CN' : 'en'));

  // 合并：默认收藏国家在前，其他国家在后
  return [...defaultRegions, ...otherRegions];
}
