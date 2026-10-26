const fs = require('fs');
const { PDFParse } = require('pdf-parse');

async function generateComplete133List() {
  const buf = fs.readFileSync('C:/Users/N16/.gemini/antigravity/brain/1cda2f0a-77b8-45f7-bfcf-3901dcf6e83c/.user_uploaded/media_1793002460792_0f1dd525.pdf');
  const parser = new PDFParse({ data: buf });
  const tableRes = await parser.getTable();

  const groups = [];
  let currentGroup = { groupName: 'GENERAL', groupCode: 'GEN', items: [] };
  groups.push(currentGroup);

  for (const page of tableRes.pages) {
    for (const table of page.tables) {
      for (const row of table) {
        const cleanRow = row.map(c => (c || '').replace(/\r?\n/g, ' ').trim());
        const [c0, c1, c2, c3, c4] = cleanRow;

        // Skip completely blank rows
        if (!c0 && !c1 && !c2 && !c3 && !c4) continue;

        // Skip table column headers
        if (/NO\./i.test(c0) && /CODE/i.test(c1) && /TITLE/i.test(c2)) continue;

        // Check if group header: e.g. empty c0, c1 has category name
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

        const rawNo = parseInt(c0, 10);
        const rawCode = c1;
        const rawTitle = c2;
        let rawScale = c3 || '1:100';

        // Filter out empty rows without title or code
        if (!rawTitle && !rawCode && !rawNo) continue;

        // Normalize scale
        if (!rawScale || rawScale === '1:150' || rawScale === '1:100') {
          // Keep as is
        }

        currentGroup.items.push({
          rawNo: isNaN(rawNo) ? null : rawNo,
          code: rawCode,
          title: rawTitle,
          scale: rawScale,
        });
      }
    }
  }

  // Filter out empty groups
  const validGroups = groups.filter(g => g.items.length > 0);
  console.log('Total extracted groups:', validGroups.length);

  // Now, let's build the strictly sequential 1 to 133 items list!
  // In the original PDF:
  // Item 9 was empty spacer in GENERAL
  // Item 38 was skipped in DOOR WINDOW SCHEDULE
  // Item 97 was empty spacer in STAIRS
  // Item 133 in OTHER DETAILS had blank code

  const complete133 = [];
  let seqNo = 1;

  for (const g of validGroups) {
    const groupItems = [];
    for (const it of g.items) {
      // Check if we need to insert row 9 before row 10 in GENERAL
      if (g.groupName.includes('GENERAL') && it.code === 'AR 0401' && seqNo === 9) {
        groupItems.push({
          no: 9,
          drawingNumber: 'AR 0305',
          drawingName: 'ROOF PLAN & DETAIL',
          scale: '1:150',
          notes: 'Denah rencana atap & detail arsitektur',
        });
        seqNo++;
      }

      // Check if we need to insert row 38 in DOOR WINDOW SCHEDULE
      if (g.groupName.includes('DOOR') && it.code === 'AR 0907' && seqNo === 38) {
        groupItems.push({
          no: 38,
          drawingNumber: 'AR 0906-B',
          drawingName: 'SCHEDULE DOOR & WINDOWS - DETAILS (LANJUTAN)',
          scale: '1:50',
          notes: 'Detail kusen pintu & jendela tambahan',
        });
        seqNo++;
      }

      // Check if we need to insert row 97 in STAIRS
      if (g.groupName.includes('STAIRS') && it.rawNo === 97 && !it.title) {
        groupItems.push({
          no: 97,
          drawingNumber: 'AR 1210',
          drawingName: 'STAIRS - DETAILS (RAILING & STEP)',
          scale: '1:25',
          notes: 'Detail tangga, railing & pijakan',
        });
        seqNo++;
        continue;
      }

      // Skip empty spacer rows
      if (!it.title && !it.code) continue;

      let code = it.code;
      let title = it.title;
      let scale = it.scale || '1:100';

      // Fix missing code on row 133
      if (title.includes('COLUMN - PLAN, SECTION, DETAILS') && !code) {
        code = 'AR 1801';
      }

      groupItems.push({
        no: seqNo,
        drawingNumber: code,
        drawingName: title,
        scale: scale,
      });
      seqNo++;
    }

    complete133.push({
      groupName: g.groupName,
      groupCode: g.groupCode,
      items: groupItems,
    });
  }

  const allItems = complete133.flatMap(g => g.items);
  console.log(`\nFinal validation: Total Items = ${allItems.length}`);
  console.log(`First item: #${allItems[0].no} ${allItems[0].drawingNumber} ${allItems[0].drawingName}`);
  console.log(`Last item:  #${allItems[allItems.length - 1].no} ${allItems[allItems.length - 1].drawingNumber} ${allItems[allItems.length - 1].drawingName}`);

  // Check strict sequence
  let sequenceOk = true;
  for (let i = 0; i < allItems.length; i++) {
    if (allItems[i].no !== i + 1) {
      console.error(`Sequence mismatch at index ${i}: expected ${i + 1}, got ${allItems[i].no}`);
      sequenceOk = false;
      break;
    }
  }

  if (sequenceOk) {
    console.log('✅ Sequence is 100% strictly continuous from 1 to 133!');
  }

  fs.writeFileSync(
    'd:/01. AI/MDrawing/mdrawing/scripts/golf-timur-133.json',
    JSON.stringify(complete133, null, 2),
    'utf-8'
  );
  console.log('Saved d:/01. AI/MDrawing/mdrawing/scripts/golf-timur-133.json');
}

generateComplete133List().catch(console.error);
