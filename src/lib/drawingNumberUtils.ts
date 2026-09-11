/**
 * Utility for intelligent sequential drawing numbering.
 * Supports standard architectural & engineering code conventions:
 * - Group codes: "AR-01", "AR-02", "ST-01", "MEP-01", "A-100", etc.
 * - Suffix patterns: "00", "01", "02" / "0100", "0101", "0102" / "01", "02" / "1", "2"
 */

export function extractGroupCode(groupName?: string | null): string | null {
  if (!groupName) return null;
  const clean = groupName.trim();
  // Match code at start of group name: e.g. "AR-01 SITUASI & DENAH", "A-100 ARCH", "STR-01 PONDASI", "01. ARSITEKTUR"
  const match = clean.match(/^([A-Za-z0-9]+(?:[-_./][A-Za-z0-9]+)*)/);
  if (match && match[1]) {
    return match[1];
  }
  return null;
}

export function generateSequentialDrawingNumbers(
  items: Array<{ drawingNumber?: string; [key: string]: any }>,
  groupName?: string | null
): string[] {
  if (!items || items.length === 0) return [];

  const groupCode = extractGroupCode(groupName);
  const existingNumbers = items.map(i => i.drawingNumber?.trim() || '').filter(Boolean);

  let prefix = '';
  let startNum = 1;
  let padLength = 2;

  if (existingNumbers.length > 0) {
    // Check if numbers align with groupCode
    if (groupCode) {
      // Check if existing numbers start with groupCode (e.g. AR-0100, AR-01-01, AR-01.01)
      const matching = existingNumbers.filter(n => n.toUpperCase().startsWith(groupCode.toUpperCase()));
      if (matching.length > 0) {
        // Extract suffix after groupCode
        const parsed = matching.map(n => {
          const rest = n.slice(groupCode.length);
          const digitMatch = rest.match(/^([-_./]?)(\d+)$/);
          if (digitMatch && digitMatch[2]) {
            return {
              separator: digitMatch[1] || '',
              digits: digitMatch[2],
              num: parseInt(digitMatch[2], 10),
              pad: digitMatch[2].length
            };
          }
          return null;
        }).filter(Boolean);

        if (parsed.length > 0) {
          const separator = parsed[0]?.separator || '';
          prefix = `${groupCode}${separator}`;
          const nums = parsed.map(p => p!.num);
          const pads = parsed.map(p => p!.pad);
          startNum = Math.min(...nums);
          padLength = Math.max(...pads, 2);
          
          return items.map((_, idx) => {
            const currentNum = startNum + idx;
            return `${prefix}${String(currentNum).padStart(padLength, '0')}`;
          });
        }
      }
    }

    // Generic pattern detection: match (prefix)(digits)
    const genericParsed = existingNumbers.map(n => {
      const m = n.match(/^(.*?)(\d+)$/);
      if (m && m[2]) {
        return {
          prefix: m[1] ?? '',
          digits: m[2],
          num: parseInt(m[2], 10),
          pad: m[2].length
        };
      }
      return null;
    }).filter(Boolean);

    if (genericParsed.length > 0) {
      // Find most common prefix
      const prefixCounts: Record<string, number> = {};
      genericParsed.forEach(p => {
        if (p?.prefix !== undefined) {
          prefixCounts[p.prefix] = (prefixCounts[p.prefix] || 0) + 1;
        }
      });
      const keys = Object.keys(prefixCounts);
      const topPrefix = keys.length > 0 
        ? keys.reduce((a, b) => prefixCounts[a] > prefixCounts[b] ? a : b)
        : '';
      
      const relevant = genericParsed.filter(p => p!.prefix === topPrefix);
      const nums = relevant.map(p => p!.num);
      const pads = relevant.map(p => p!.pad);

      prefix = topPrefix;
      startNum = nums.length > 0 ? Math.min(...nums) : 1;
      padLength = pads.length > 0 ? Math.max(...pads, 2) : 2;

      return items.map((_, idx) => {
        const currentNum = startNum + idx;
        return `${prefix}${String(currentNum).padStart(padLength, '0')}`;
      });
    }
  }

  // Fallback when no existing numbers or patterns exist
  if (groupCode) {
    prefix = `${groupCode}`;
    startNum = 0; // standard CAD group index starts at 00 (e.g. AR-0100) or 01
    padLength = 2;
    return items.map((_, idx) => {
      const currentNum = startNum + idx;
      return `${prefix}${String(currentNum).padStart(padLength, '0')}`;
    });
  }

  // Default DWG-01, DWG-02...
  prefix = 'DWG-';
  startNum = 1;
  padLength = 2;
  return items.map((_, idx) => {
    const currentNum = startNum + idx;
    return `${prefix}${String(currentNum).padStart(padLength, '0')}`;
  });
}
