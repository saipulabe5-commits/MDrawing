function hexToRgb(hex: string): [number, number, number] {
  const cleanHex = hex.replace('#', '');
  const bigint = parseInt(cleanHex, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return [r, g, b];
}

function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getContrastRatio(hex1: string, hex2: string): number {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  const lum1 = getLuminance(...rgb1);
  const lum2 = getLuminance(...rgb2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

const lightTokens = {
  bg: '#F0F1F5',
  surface: '#FFFFFF',
  bgSecondary: '#E4E4E7',
  textPrimary: '#18181B',
  textSecondary: '#475569',
  textTertiary: '#52525B',
  accentBlueText: '#0369A1',
  accentGreenText: '#166534',
  accentOrangeText: '#C2410C',
  accentRed: '#B91C1C',
};

const darkTokens = {
  bg: '#000000',
  surface: '#0A0A0A',
  bgSecondary: '#141414',
  textPrimary: '#FFFFFF',
  textSecondary: '#A1A1AA',
  textTertiary: '#9CA3AF',
  accentBlueText: '#7DD3FC',
  accentGreenText: '#4ADE80',
  accentOrangeText: '#FB923C',
  accentRed: '#F87171',
};

console.log('========================================================================================');
console.log('📊 TABEL AUDIT LENGKAP RASIO KONTRAS WCAG 2.1 AA UNTUK SEMUA TOKEN WARNA');
console.log('========================================================================================\n');

console.log('1. TEMA TERANG SOFT (LIGHT MODE SOFT):');
console.log('----------------------------------------------------------------------------------------');
console.log('| Token Teks / Elemen            | Nilai HEX | vs BG (#F4F5F7) | vs Surface (#FFFFFF) | Status WCAG AA |');
console.log('----------------------------------------------------------------------------------------');

for (const [key, hex] of Object.entries(lightTokens)) {
  if (['bg', 'surface', 'bgSecondary'].includes(key)) continue;
  const ratioBg = getContrastRatio(hex, lightTokens.bg);
  const ratioSurface = getContrastRatio(hex, lightTokens.surface);
  const pass = ratioBg >= 4.5 && ratioSurface >= 4.5;
  console.log(`| ${key.padEnd(30)} | ${hex.padEnd(9)} | ${ratioBg.toFixed(2).padStart(6)}:1       | ${ratioSurface.toFixed(2).padStart(11)}:1       | ${pass ? '✅ Lolos (≥4.5:1)' : '❌ Gagal'} |`);
}
console.log('----------------------------------------------------------------------------------------\n');

console.log('2. TEMA GELAP FULL BLACK (DARK MODE FULL BLACK):');
console.log('----------------------------------------------------------------------------------------');
console.log('| Token Teks / Elemen            | Nilai HEX | vs BG (#000000) | vs Surface (#0A0A0A) | Status WCAG AA |');
console.log('----------------------------------------------------------------------------------------');

for (const [key, hex] of Object.entries(darkTokens)) {
  if (['bg', 'surface', 'bgSecondary'].includes(key)) continue;
  const ratioBg = getContrastRatio(hex, darkTokens.bg);
  const ratioSurface = getContrastRatio(hex, darkTokens.surface);
  const pass = ratioBg >= 4.5 && ratioSurface >= 4.5;
  console.log(`| ${key.padEnd(30)} | ${hex.padEnd(9)} | ${ratioBg.toFixed(2).padStart(6)}:1       | ${ratioSurface.toFixed(2).padStart(11)}:1       | ${pass ? '✅ Lolos (≥4.5:1)' : '❌ Gagal'} |`);
}
console.log('----------------------------------------------------------------------------------------');
