const fs = require('fs');
const { PDFParse } = require('pdf-parse');

async function run() {
  const buf = fs.readFileSync('C:/Users/N16/.gemini/antigravity/brain/1cda2f0a-77b8-45f7-bfcf-3901dcf6e83c/.user_uploaded/media_1793002460792_0f1dd525.pdf');
  const parser = new PDFParse({ data: buf });
  await parser.load();

  for (let p = 1; p <= 2; p++) {
    const page = await parser.doc.getPage(p);
    const content = await page.getTextContent();
    console.log(`\n=================== ALL RAW TEXT ITEMS PAGE ${p} ===================`);
    content.items.forEach((it, i) => {
      const s = it.str.trim();
      if (s) {
        // vx = it.transform[5], vy = it.transform[4]
        console.log(`[P${p}#${String(i).padStart(3, '0')}] vy:${Math.round(it.transform[4])} vx:${Math.round(it.transform[5])} | "${s}"`);
      }
    });
  }
}

run().catch(console.error);
