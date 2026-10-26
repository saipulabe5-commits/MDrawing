const fs = require('fs');
const { PDFParse } = require('pdf-parse');

async function run() {
  const buf = fs.readFileSync('C:/Users/N16/.gemini/antigravity/brain/1cda2f0a-77b8-45f7-bfcf-3901dcf6e83c/.user_uploaded/media_1793002460792_0f1dd525.pdf');
  const parser = new PDFParse({ data: buf });
  await parser.load();

  const results = [];

  for (let p = 1; p <= 2; p++) {
    const page = await parser.doc.getPage(p);
    const content = await page.getTextContent();
    
    // Convert to visual coordinates:
    // Page is rotated 90 deg:
    // vx = it.transform[5] (horizontal position)
    // vy = it.transform[4] (vertical position, top-to-bottom)
    const items = content.items
      .map(it => ({
        str: it.str.trim(),
        vx: it.transform[5],
        vy: it.transform[4],
      }))
      .filter(it => it.str.length > 0);

    const numCols = (p === 1) ? 3 : 1;
    const colRanges = (p === 1) 
      ? [
          { col: 1, minX: 70, maxX: 400 },
          { col: 2, minX: 400, maxX: 750 },
          { col: 3, minX: 750, maxX: 1100 }
        ]
      : [
          { col: 1, minX: 70, maxX: 450 }
        ];

    for (const cr of colRanges) {
      console.log(`\n================ PAGE ${p} - COLUMN ${cr.col} ================`);
      const colItems = items.filter(it => it.vx >= cr.minX && it.vx < cr.maxX && it.vy >= 95 && it.vy <= 760);
      
      // Cluster items into rows by vy (tolerance ~5-6 points)
      colItems.sort((a, b) => a.vy - b.vy);

      const rows = [];
      for (const item of colItems) {
        let matchedRow = rows.find(r => Math.abs(r.vy - item.vy) < 4.5);
        if (!matchedRow) {
          matchedRow = { vy: item.vy, items: [] };
          rows.push(matchedRow);
        }
        matchedRow.items.push(item);
      }

      rows.sort((a, b) => a.vy - b.vy);

      for (const r of rows) {
        // Sort items inside row by vx (left to right)
        r.items.sort((a, b) => a.vx - b.vx);
        const text = r.items.map(it => `${it.str} (x:${Math.round(it.vx)})`).join(' | ');
        console.log(`[vy: ${Math.round(r.vy)}] ${text}`);
      }
    }
  }
}

run().catch(console.error);
