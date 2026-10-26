const fs = require('fs');
const { PDFParse } = require('pdf-parse');

async function run() {
  const buf = fs.readFileSync('C:/Users/N16/.gemini/antigravity/brain/1cda2f0a-77b8-45f7-bfcf-3901dcf6e83c/.user_uploaded/media_1793002460792_0f1dd525.pdf');
  const parser = new PDFParse({ data: buf });
  await parser.load();

  for (let p = 1; p <= 2; p++) {
    const page = await parser.doc.getPage(p);
    const content = await page.getTextContent();
    console.log(`\n=================== PAGE ${p} ===================`);
    
    // In rotated 90 deg:
    // visual_x = y
    // visual_y = x
    const items = content.items
      .map(it => ({
        str: it.str.trim(),
        vx: Math.round(it.transform[5] * 10) / 10, // visual X
        vy: Math.round(it.transform[4] * 10) / 10, // visual Y
      }))
      .filter(it => it.str.length > 0);

    // Let's find distinct columns by looking at headers: "NO." or "CODE"
    const headers = items.filter(it => it.str === 'CODE' || it.str === 'NO.');
    console.log(`Page ${p} headers found:`, headers);

    // Let's see the range of vx (columns)
    const xs = items.map(it => it.vx);
    console.log(`Page ${p} vx min: ${Math.min(...xs)}, max: ${Math.max(...xs)}`);
    const ys = items.map(it => it.vy);
    console.log(`Page ${p} vy min: ${Math.min(...ys)}, max: ${Math.max(...ys)}`);
  }
}

run().catch(console.error);
