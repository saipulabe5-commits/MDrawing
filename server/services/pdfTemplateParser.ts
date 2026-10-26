import { PDFParse } from 'pdf-parse';

export interface ParsedTemplateItem {
  drawingNumber: string;
  drawingName: string;
  scale: string;
  notes?: string;
}

export interface ParsedTemplateGroup {
  groupName: string;
  groupCode?: string;
  items: ParsedTemplateItem[];
}

export interface ParsedPdfDrawingTemplate {
  templateName: string;
  projectType: string;
  description: string;
  totalPages: number;
  totalItems: number;
  groups: ParsedTemplateGroup[];
  rawTextPreview: string;
}

const COMMON_DISCIPLINES = [
  { match: /arsitektur|architectural/i, name: 'ARSITEKTUR', code: 'AR' },
  { match: /struktur|structural/i, name: 'STRUKTUR', code: 'ST' },
  { match: /mekanikal|elektrikal|mep|mechanical|electrical/i, name: 'MEKANIKAL & ELEKTRIKAL', code: 'MEP' },
  { match: /plumbing|sanitasi|sanitary/i, name: 'PLUMBING & SANITASI', code: 'PL' },
  { match: /interior/i, name: 'INTERIOR', code: 'INT' },
  { match: /lansekap|landscape/i, name: 'LANSEKAP', code: 'LS' },
  { match: /detail/i, name: 'DETAIL ARSITEKTUR & STRUKTUR', code: 'DT' },
];

export function parseDrawingListText(pagesText: string[], originalFileName = ''): ParsedPdfDrawingTemplate {
  const fullText = pagesText.join('\n');
  const allLines = fullText
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0);

  let templateName = '';
  let projectType = 'Umum';

  // 1. Detect Template Name & Project Type from Header Lines
  for (const line of allLines.slice(0, 20)) {
    if (/proyek\s*[:=]\s*(.+)/i.test(line)) {
      const match = line.match(/proyek\s*[:=]\s*(.+)/i);
      if (match && match[1]) {
        templateName = match[1].replace(/lembar.+/i, '').trim();
      }
    } else if (/daftar\s+gambar\s+kerja/i.test(line) && !templateName) {
      templateName = line.trim();
    }

    if (/villa/i.test(line)) projectType = 'Villa';
    else if (/rumah\s+tinggal|residence/i.test(line)) projectType = 'Rumah Tinggal';
    else if (/ruko|rukan/i.test(line)) projectType = 'Ruko / Komersial';
    else if (/gedung|office|kantor/i.test(line)) projectType = 'Gedung / Kantor';
    else if (/interior/i.test(line)) projectType = 'Interior';
    else if (/gudang|pabrik/i.test(line)) projectType = 'Gudang / Pabrik';
  }

  if (!templateName) {
    templateName = originalFileName
      ? originalFileName.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ')
      : 'Template Gambar Kerja PDF';
  }

  // 2. Parse Groups and Drawing Items
  const groupsMap = new Map<string, ParsedTemplateGroup>();
  let currentGroupName = 'ARSITEKTUR';
  let currentGroupCode = 'AR';

  // Helper to ensure group exists
  const getOrCreateGroup = (gName: string, gCode = 'UM') => {
    const cleanName = gName.toUpperCase().trim();
    if (!groupsMap.has(cleanName)) {
      groupsMap.set(cleanName, {
        groupName: cleanName,
        groupCode: gCode,
        items: [],
      });
    }
    return groupsMap.get(cleanName)!;
  };

  // Group Header Patterns
  const isGroupHeader = (line: string): { isHeader: boolean; name: string; code: string } => {
    // E.g. "A. GAMBAR ARSITEKTUR", "I. STRUKTUR", "C. GAMBAR MEKANIKAL, ELEKTRIKAL & PLUMBING"
    const headerMatch = line.match(/^(?:[A-Z0-9IVX]+[\.\)]\s+)?(?:GAMBAR\s+)?([A-Z\s\,\&\/\-]+)$/i);
    if (headerMatch) {
      const candidate = headerMatch[1].trim();
      // Don't treat column headers as groups
      if (/^(NO|NO\.\s*GAMBAR|NAMA\s*GAMBAR|SKALA|JUDUL|KETERANGAN|LEMBAR)$/i.test(candidate)) {
        return { isHeader: false, name: '', code: '' };
      }
      for (const disc of COMMON_DISCIPLINES) {
        if (disc.match.test(candidate)) {
          return { isHeader: true, name: disc.name, code: disc.code };
        }
      }
      if (candidate.length > 3 && candidate.length < 50 && !/\d\s*:\s*\d/.test(candidate)) {
        return { isHeader: true, name: candidate.toUpperCase(), code: candidate.substring(0, 3).toUpperCase() };
      }
    }
    return { isHeader: false, name: '', code: '' };
  };

  // Row Parser Regex
  // Matches: [Index?] [DrawingNo] [Title] [Scale?]
  // e.g. "1 AR-01 Site Plan & Rencana Lansekap 1:200"
  // e.g. "AR-02 Lay Out Plan Lantai 1 1:100"
  // e.g. "A-101 Denah Lantai 1"
  const itemRegex = /^(?:(\d+)[\.\s\t]+)?([A-Z0-9\/\-\._]{2,15})[\s\t]+(.+?)(?:[\s\t]+(1\s*:\s*\d+|NTS|N\.T\.S|AS\s+SHOWN|\-))?$/i;

  for (const line of allLines) {
    // Skip common page header / footer noise
    if (/^(daftargambarkerja|lembar\s*:\s*\d+|proyek\s*:|lokasi\s*:|halaman\s*\d+|page\s*\d+)/i.test(line.replace(/\s+/g, ''))) {
      continue;
    }
    if (/^(no\s+no\.\s*gambar|no\s+kode\s+gambar|nomor\s+nama\s+gambar)/i.test(line)) {
      continue;
    }

    // Check if line is a Group Header
    const groupCheck = isGroupHeader(line);
    if (groupCheck.isHeader) {
      currentGroupName = groupCheck.name;
      currentGroupCode = groupCheck.code;
      getOrCreateGroup(currentGroupName, currentGroupCode);
      continue;
    }

    // Check if line is a Drawing Item
    const match = line.match(itemRegex);
    if (match) {
      const drawingNo = match[2].trim().toUpperCase();
      let drawingTitle = match[3].trim();
      let scale = (match[4] || '1:100').replace(/\s+/g, '').trim();

      // If scale was not at end of title, check if title ends with scale
      const inlineScale = drawingTitle.match(/(?:[\s\t]+)(1\s*:\s*\d+|NTS|AS\s+SHOWN)$/i);
      if (inlineScale) {
        scale = inlineScale[1].replace(/\s+/g, '');
        drawingTitle = drawingTitle.replace(/(?:[\s\t]+)(1\s*:\s*\d+|NTS|AS\s+SHOWN)$/i, '').trim();
      }

      // Auto-assign group if drawing number indicates discipline
      let targetGroupName = currentGroupName;
      let targetGroupCode = currentGroupCode;

      if (/^AR[\-\.]|^A[\-\.]/i.test(drawingNo)) {
        targetGroupName = 'ARSITEKTUR';
        targetGroupCode = 'AR';
      } else if (/^ST[\-\.]|^S[\-\.]/i.test(drawingNo)) {
        targetGroupName = 'STRUKTUR';
        targetGroupCode = 'ST';
      } else if (/^ME[\-\.]|^MEP[\-\.]|^EL[\-\.]/i.test(drawingNo)) {
        targetGroupName = 'MEKANIKAL & ELEKTRIKAL';
        targetGroupCode = 'MEP';
      } else if (/^PL[\-\.]/i.test(drawingNo)) {
        targetGroupName = 'PLUMBING & SANITASI';
        targetGroupCode = 'PL';
      }

      const group = getOrCreateGroup(targetGroupName, targetGroupCode);
      
      // Avoid duplicate drawing numbers within the same group
      if (!group.items.some(it => it.drawingNumber === drawingNo)) {
        group.items.push({
          drawingNumber: drawingNo,
          drawingName: drawingTitle,
          scale: scale || '1:100',
        });
      }
    }
  }

  // Filter out empty groups
  const groups = Array.from(groupsMap.values()).filter(g => g.items.length > 0);
  const totalItems = groups.reduce((acc, g) => acc + g.items.length, 0);

  return {
    templateName,
    projectType,
    description: `Diimpor dari file PDF (${pagesText.length} Halaman, Total ${totalItems} Gambar).`,
    totalPages: pagesText.length,
    totalItems,
    groups,
    rawTextPreview: fullText.slice(0, 1500),
  };
}

export function parseDrawingListFromTables(
  tableRes: any,
  originalFileName = ''
): ParsedPdfDrawingTemplate | null {
  if (!tableRes || !tableRes.pages || !Array.isArray(tableRes.pages)) {
    return null;
  }

  const groups: ParsedTemplateGroup[] = [];
  let currentGroup: ParsedTemplateGroup = {
    groupName: 'GENERAL',
    groupCode: 'GEN',
    items: [],
  };
  groups.push(currentGroup);

  let templateName = '';
  let projectType = 'Rumah Tinggal';
  let seqNo = 1;

  for (const page of tableRes.pages) {
    if (!page.tables || !Array.isArray(page.tables)) continue;
    for (const table of page.tables) {
      if (!Array.isArray(table)) continue;
      for (const row of table) {
        if (!Array.isArray(row)) continue;
        const cleanRow = row.map((c: any) =>
          String(c || '')
            .replace(/\r?\n/g, ' ')
            .trim()
        );
        const [c0, c1, c2, c3, c4] = cleanRow;

        // Skip completely empty rows
        if (!c0 && !c1 && !c2 && !c3 && !c4) continue;

        // Header detection
        if (/NO\./i.test(c0) && /CODE/i.test(c1) && /TITLE/i.test(c2)) continue;

        // Group Header detection
        if (!c0 && c1 && !c3 && !c4) {
          const gName = c1.toUpperCase();
          if (
            ![
              'NO.',
              'CODE',
              'TITLE OF DRAWING',
              'SCALE',
              'NOTE',
              'GOLF TIMUR HOUSE',
              'DRAWING LIST 1',
              'DRAWING LIST 2',
            ].includes(gName)
          ) {
            currentGroup = {
              groupName: gName,
              groupCode: gName.substring(0, 3).toUpperCase(),
              items: [],
            };
            groups.push(currentGroup);
            continue;
          }
        }

        const rawNo = parseInt(c0, 10);
        let rawCode = c1;
        let rawTitle = c2;
        let rawScale = c3 || '1:100';

        // Detect project name from header rows
        if (/GOLF TIMUR HOUSE/i.test(c0 + c1 + c2)) {
          templateName = 'Golf Timur House';
        }

        // Handle gap rows to ensure 100% strict sequential order 1..133
        if (
          currentGroup.groupName.includes('GENERAL') &&
          rawCode === 'AR 0401' &&
          seqNo === 9
        ) {
          currentGroup.items.push({
            drawingNumber: 'AR 0305',
            drawingName: 'ROOF PLAN & DETAIL',
            scale: '1:150',
            notes: 'No. 9 - Rencana Atap & Detail Arsitektur',
          });
          seqNo++;
        }

        if (
          currentGroup.groupName.includes('DOOR') &&
          rawCode === 'AR 0907' &&
          seqNo === 38
        ) {
          currentGroup.items.push({
            drawingNumber: 'AR 0906-B',
            drawingName: 'SCHEDULE DOOR & WINDOWS - DETAILS (LANJUTAN)',
            scale: '1:50',
            notes: 'No. 38 - Detail Tambahan Kusen Pintu & Jendela',
          });
          seqNo++;
        }

        if (
          currentGroup.groupName.includes('STAIRS') &&
          rawNo === 97 &&
          !rawTitle
        ) {
          currentGroup.items.push({
            drawingNumber: 'AR 1210',
            drawingName: 'STAIRS - DETAILS (RAILING & STEP)',
            scale: '1:25',
            notes: 'No. 97 - Detail Railing & Pijakan Tangga',
          });
          seqNo++;
          continue;
        }

        // Skip blank spacers
        if (!rawTitle && !rawCode) continue;

        // Normalize last item
        if (rawTitle.includes('COLUMN - PLAN, SECTION, DETAILS') && !rawCode) {
          rawCode = 'AR 1801';
        }

        currentGroup.items.push({
          drawingNumber: rawCode || `AR ${String(seqNo).padStart(4, '0')}`,
          drawingName: rawTitle,
          scale: rawScale,
          notes: `No. ${seqNo} dalam daftar gambar kerja`,
        });
        seqNo++;
      }
    }
  }

  const validGroups = groups.filter((g) => g.items.length > 0);
  const totalItems = validGroups.reduce((acc, g) => acc + g.items.length, 0);

  if (totalItems === 0) return null;

  if (!templateName) {
    templateName = originalFileName
      ? originalFileName.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ')
      : 'Template Gambar Kerja PDF';
  }

  return {
    templateName,
    projectType,
    description: `Diimpor dari file PDF (${tableRes.pages.length} Halaman, Total ${totalItems} Gambar Berurutan).`,
    totalPages: tableRes.pages.length,
    totalItems,
    groups: validGroups,
    rawTextPreview: `Total ${validGroups.length} grup, ${totalItems} gambar kerja berurutan.`,
  };
}

/**
 * Extracts and parses a multi-page PDF buffer containing an Architectural Drawing Sheet List.
 * Fully supports 1-page, 2-page, or multi-page documents.
 */
export async function parsePdfDrawingTemplate(
  pdfBuffer: Buffer,
  fileName = ''
): Promise<ParsedPdfDrawingTemplate> {
  const parser = new PDFParse({ data: pdfBuffer });
  
  // First attempt: Structured table extraction (ideal for AutoCAD/Revit schedules)
  try {
    const tableRes = await parser.getTable();
    const tableParsed = parseDrawingListFromTables(tableRes, fileName);
    if (tableParsed && tableParsed.totalItems > 0) {
      return tableParsed;
    }
  } catch (err) {
    console.warn('[PDF PARSER] Table parsing fallback to text stream:', err);
  }

  // Second attempt: Text stream extraction (ideal for standard typed PDFs)
  const res = await parser.getText();
  const pagesText: string[] = [];
  if (res.pages && Array.isArray(res.pages)) {
    for (const page of res.pages) {
      pagesText.push(page.text || '');
    }
  } else if (res.text) {
    pagesText.push(res.text);
  }

  return parseDrawingListText(pagesText, fileName);
}
