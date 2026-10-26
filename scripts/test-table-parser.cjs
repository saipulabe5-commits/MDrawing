const fs = require('fs');
const { PDFParse } = require('pdf-parse');

async function testTableParser() {
  const buf = fs.readFileSync('C:/Users/N16/.gemini/antigravity/brain/1cda2f0a-77b8-45f7-bfcf-3901dcf6e83c/.user_uploaded/media_1793002460792_0f1dd525.pdf');
  const parser = new PDFParse({ data: buf });
  const tableRes = await parser.getTable();

  const groups = [];
  let currentGroup = { groupName: 'GENERAL', groupCode: 'GEN', items: [] };
  groups.push(currentGroup);

  let itemCounter = 0;

  for (const page of tableRes.pages) {
    for (const table of page.tables) {
      for (const row of table) {
        const cleanRow = row.map(c => (c || '').replace(/\r?\n/g, ' ').trim());
        const [c0, c1, c2, c3, c4] = cleanRow;

        // Check if row is empty
        if (!c0 && !c1 && !c2 && !c3 && !c4) continue;

        // Check if header row
        if (/NO\./i.test(c0) && /CODE/i.test(c1) && /TITLE/i.test(c2)) continue;

        // Check if group header: e.g. empty c0, c1 has text, empty c2..c4
        if (!c0 && c1 && !c3 && !c4) {
          const gName = c1.toUpperCase();
          if (!['NO.', 'CODE', 'TITLE OF DRAWING', 'SCALE', 'NOTE'].includes(gName)) {
            currentGroup = {
              groupName: gName,
              groupCode: gName.substring(0, 3).toUpperCase(),
              items: [],
            };
            groups.push(currentGroup);
            continue;
          }
        }

        // Check if drawing item row
        // In the table, c0 is NO., c1 is CODE, c2 is TITLE, c3 is SCALE
        const rawNo = c0;
        const rawCode = c1;
        const rawTitle = c2;
        const rawScale = c3 || '1:100';

        if (rawTitle || rawCode) {
          itemCounter++;
          currentGroup.items.push({
            noInPdf: rawNo,
            sequentialNo: itemCounter,
            drawingNumber: rawCode || `AR ${String(itemCounter).padStart(4, '0')}`,
            drawingName: rawTitle || 'GAMBAR KERJA',
            scale: rawScale,
          });
        }
      }
    }
  }

  const validGroups = groups.filter(g => g.items.length > 0);
  const total = validGroups.reduce((acc, g) => acc + g.items.length, 0);

  console.log(`Parsed ${validGroups.length} groups with ${total} items total.`);
  validGroups.forEach((g, idx) => {
    console.log(`Group ${idx + 1}: ${g.groupName} (${g.items.length} items)`);
    g.items.forEach(it => {
      console.log(`  #${String(it.sequentialNo).padStart(3, ' ')} | PDF NO: ${String(it.noInPdf).padEnd(5)} | ${it.drawingNumber.padEnd(8)} | ${it.drawingName.padEnd(45)} | ${it.scale}`);
    });
  });
}

testTableParser().catch(console.error);
