import { jsPDF } from 'jspdf';
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
  for (const line of allLines.slice(0, 15)) {
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
    rawTextPreview: fullText.slice(0, 1000),
  };
}

// Test runner
function generateSampleArchitecturalPdf(): Buffer {
  const doc = new jsPDF();
  
  // PAGE 1: ARSITEKTUR
  doc.setFontSize(16);
  doc.text('DAFTAR GAMBAR KERJA ARSITEKTUR & STRUKTUR', 14, 15);
  doc.setFontSize(10);
  doc.text('Proyek: Pembangunan Villa Tropis 2 Lantai', 14, 22);
  doc.text('Lokasi: Sanur, Denpasar, Bali Lembar: 1 dari 2', 14, 27);

  doc.setFontSize(12);
  doc.text('A. GAMBAR ARSITEKTUR', 14, 38);
  doc.setFontSize(10);
  doc.text('NO    NO. GAMBAR    NAMA GAMBAR                                     SKALA', 14, 45);

  const arItems = [
    ['1', 'AR-01', 'Site Plan & Rencana Lansekap', '1:200'],
    ['2', 'AR-02', 'Lay Out Plan Lantai 1', '1:100'],
    ['3', 'AR-03', 'Lay Out Plan Lantai 2', '1:100'],
    ['4', 'AR-04', 'Tampak Depan & Tampak Samping Kanan', '1:100'],
    ['5', 'AR-05', 'Tampak Belakang & Tampak Samping Kiri', '1:100'],
    ['6', 'AR-06', 'Potongan Melintang A-A & B-B', '1:100'],
    ['7', 'AR-07', 'Rencana Pola Lantai Lantai 1 & 2', '1:100'],
    ['8', 'AR-08', 'Rencana Plafond Lantai 1 & 2', '1:100'],
    ['9', 'AR-09', 'Rencana Kusen Pintu & Jendela', '1:50'],
    ['10', 'AR-10', 'Detail Toilet & Sanitasi', '1:20'],
  ];

  let y = 54;
  for (const item of arItems) {
    doc.text(`${item[0]}     ${item[1]}        ${item[2]}`, 14, y);
    doc.text(item[3], 170, y);
    y += 8;
  }

  // PAGE 2: STRUKTUR & MEP
  doc.addPage();
  doc.setFontSize(14);
  doc.text('DAFTAR GAMBAR KERJA - STRUKTUR & MEP', 14, 15);
  doc.setFontSize(10);
  doc.text('Proyek: Pembangunan Villa Tropis 2 Lantai Lembar: 2 dari 2', 14, 22);

  // Group 2: STRUKTUR
  doc.setFontSize(12);
  doc.text('B. GAMBAR STRUKTUR', 14, 33);
  doc.setFontSize(10);
  doc.text('NO    NO. GAMBAR    NAMA GAMBAR                                     SKALA', 14, 40);

  const stItems = [
    ['1', 'ST-01', 'Rencana Pondasi Footplat & Sloof', '1:100'],
    ['2', 'ST-02', 'Rencana Kolom & Balok Lantai 1', '1:100'],
    ['3', 'ST-03', 'Rencana Plat Lantai & Balok Lantai 2', '1:100'],
    ['4', 'ST-04', 'Rencana Rangka Atap Baja Ringan', '1:100'],
    ['5', 'ST-05', 'Detail Penulangan Balok, Kolom, Pondasi', '1:20'],
  ];

  y = 49;
  for (const item of stItems) {
    doc.text(`${item[0]}     ${item[1]}        ${item[2]}`, 14, y);
    doc.text(item[3], 170, y);
    y += 8;
  }

  // Group 3: MEP
  y += 6;
  doc.setFontSize(12);
  doc.text('C. GAMBAR MEKANIKAL, ELEKTRIKAL & PLUMBING', 14, y);
  y += 7;
  doc.setFontSize(10);
  doc.text('NO    NO. GAMBAR    NAMA GAMBAR                                     SKALA', 14, y);
  y += 9;

  const mepItems = [
    ['1', 'ME-01', 'Rencana Titik Lampu, Stop Kontak & Saklar', '1:100'],
    ['2', 'ME-02', 'Rencana Instalasi Air Bersih & Air Kotor', '1:100'],
    ['3', 'ME-03', 'Detail Septictank & Resapan Air Hujan', '1:50'],
  ];

  for (const item of mepItems) {
    doc.text(`${item[0]}     ${item[1]}        ${item[2]}`, 14, y);
    doc.text(item[3], 170, y);
    y += 8;
  }

  return Buffer.from(doc.output('arraybuffer'));
}

async function test() {
  const pdfBuf = generateSampleArchitecturalPdf();
  const parser = new PDFParse({ data: pdfBuf });
  const textResult = await parser.getText();
  const pagesText = textResult.pages.map((p: any) => p.text);

  console.log('Testing Parser Engine on 2-page PDF...');
  const parsed = parseDrawingListText(pagesText, 'Daftar_Gambar_Villa_Sanur.pdf');

  console.log('\n================ PARSER RESULT ================');
  console.log('Template Name :', parsed.templateName);
  console.log('Project Type  :', parsed.projectType);
  console.log('Total Pages   :', parsed.totalPages);
  console.log('Total Groups  :', parsed.groups.length);
  console.log('Total Items   :', parsed.totalItems);
  console.log('===============================================\n');

  parsed.groups.forEach((g, gIdx) => {
    console.log(`[Group ${gIdx + 1}] ${g.groupName} (${g.items.length} Gambar)`);
    g.items.forEach(it => {
      console.log(`   - ${it.drawingNumber.padEnd(8)} | ${it.drawingName.padEnd(45)} | ${it.scale}`);
    });
  });
}

test().catch(console.error);
