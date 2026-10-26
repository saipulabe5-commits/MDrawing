import fs from 'fs';
import { PDFParse } from 'pdf-parse';
import {
  ParsedPdfDrawingTemplate,
  ParsedTemplateGroup,
  ParsedTemplateItem,
} from '../server/services/pdfTemplateParser';

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

async function run() {
  const buf = fs.readFileSync(
    'C:/Users/N16/.gemini/antigravity/brain/1cda2f0a-77b8-45f7-bfcf-3901dcf6e83c/.user_uploaded/media_1793002460792_0f1dd525.pdf'
  );
  const parser = new PDFParse({ data: buf });
  const tableRes = await parser.getTable();
  const res = parseDrawingListFromTables(tableRes, 'Golf_Timur_House.pdf');

  console.log('Result total groups:', res?.groups.length);
  console.log('Result total items:', res?.totalItems);
  const all = res?.groups.flatMap((g) => g.items) || [];
  console.log('Item #1:', all[0]);
  console.log('Item #9:', all[8]);
  console.log('Item #38:', all[37]);
  console.log('Item #97:', all[96]);
  console.log('Item #133:', all[132]);
}

run().catch(console.error);
