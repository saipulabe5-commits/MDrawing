/**
 * Utility for formatting and standardizing drawing scales (Standar AutoCAD T8 & Dokumen Konstruksi).
 */

export const STANDARD_CAD_SCALES = [
  'NTS',
  '1 : 100',
  '1 : 50',
  '1 : 20',
  '1 : 10',
  '1 : 5',
  '1 : 200',
  '1 : 500',
  '1 : 1'
] as const;

/**
 * Formats scale string cleanly:
 * - "1:100" -> "1 : 100"
 * - "1 :100" -> "1 : 100"
 * - "1: 100" -> "1 : 100"
 * - "nts" / "NTS" -> "NTS"
 * - "1:10, 1:100" -> "1 : 10, 1 : 100"
 * - empty/null -> "NTS"
 */
export function formatScale(scale?: string | null): string {
  if (!scale || !scale.trim()) return 'NTS';
  const trimmed = scale.trim();
  if (/^nts$/i.test(trimmed)) return 'NTS';
  
  // Standardize ratio patterns like 1:100 -> 1 : 100
  return trimmed.replace(/(\d+)\s*:\s*(\d+)/g, '$1 : $2');
}
