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
  bg: '#F8FAFC',
  surface: '#FFFFFF',
  bgSecondary: '#F1F5F9',
  textPrimary: '#0F172A',
  textSecondary: '#334155',
  textTertiary: '#475569',
  accentBlueText: '#0369A1',
  accentGreen: '#16A34A',
  accentOrange: '#EA580C',
  accentRed: '#DC2626',
};

const darkTokens = {
  bg: '#0F172A',
  surface: '#1E293B',
  bgSecondary: '#334155',
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  textTertiary: '#8C9BB1',
  accentBlueText: '#7DD3FC',
  accentGreen: '#4ADE80',
  accentOrange: '#FB923C',
  accentRed: '#F87171',
};

console.log('========================================================================================');
console.log('📊 TABEL AUDIT LENGKAP RASIO KONTRAS WCAG 2.1 AA UNTUK SEMUA TOKEN WARNA');
console.log('========================================================================================\n');

console.log('1. TEMA TERANG (LIGHT MODE):');
console.log('----------------------------------------------------------------------------------------');
console.log('| Token Teks / Elemen            | Nilai HEX | vs BG (#F8FAFC) | vs Surface (#FFFFFF) | Status WCAG AA |');
console.log('----------------------------------------------------------------------------------------');

for (const [key, hex] of Object.entries(lightTokens)) {
  if (['bg', 'surface', 'bgSecondary'].includes(key)) continue;
  const ratioBg = getContrastRatio(hex, lightTokens.bg);
  const ratioSurface = getContrastRatio(hex, lightTokens.surface);
  const pass = ratioBg >= 4.5 && ratioSurface >= 4.5;
  console.log(`| ${key.padEnd(30)} | ${hex.padEnd(9)} | ${ratioBg.toFixed(2).padStart(6)}:1       | ${ratioSurface.toFixed(2).padStart(11)}:1       | ${pass ? '✅ Lolos (≥4.5:1)' : '❌ Gagal'} |`);
}
console.log('----------------------------------------------------------------------------------------\n');

console.log('2. TEMA GELAP (DARK MODE):');
console.log('----------------------------------------------------------------------------------------');
console.log('| Token Teks / Elemen            | Nilai HEX | vs BG (#0F172A) | vs Surface (#1E293B) | Status WCAG AA |');
console.log('----------------------------------------------------------------------------------------');

for (const [key, hex] of Object.entries(darkTokens)) {
  if (['bg', 'surface', 'bgSecondary'].includes(key)) continue;
  const ratioBg = getContrastRatio(hex, darkTokens.bg);
  const ratioSurface = getContrastRatio(hex, darkTokens.surface);
  const pass = ratioBg >= 4.5 && ratioSurface >= 4.5;
  console.log(`| ${key.padEnd(30)} | ${hex.padEnd(9)} | ${ratioBg.toFixed(2).padStart(6)}:1       | ${ratioSurface.toFixed(2).padStart(11)}:1       | ${pass ? '✅ Lolos (≥4.5:1)' : '❌ Gagal'} |`);
}
console.log('----------------------------------------------------------------------------------------');
