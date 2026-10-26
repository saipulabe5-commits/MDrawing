const fs = require('fs');
const { PDFParse } = require('pdf-parse');

async function run() {
  const buf = fs.readFileSync('C:/Users/N16/.gemini/antigravity/brain/1cda2f0a-77b8-45f7-bfcf-3901dcf6e83c/.user_uploaded/media_1793002460792_0f1dd525.pdf');
  const parser = new PDFParse({ data: buf });
  const tableRes = await parser.getTable();

  tableRes.pages.forEach((page) => {
    console.log(`\n================== PAGE ${page.num} (Tables: ${page.tables.length}) ==================`);
    page.tables.forEach((tbl, tIdx) => {
      console.log(`\n--- Table ${tIdx + 1} (${tbl.length} rows) ---`);
      tbl.forEach((row, rIdx) => {
        const joined = row.map(c => (c || '').replace(/\r?\n/g, ' ').trim()).join(' | ');
        console.log(`[R${String(rIdx).padStart(2, '0')}] ${joined}`);
      });
    });
  });
}

run().catch(console.error);
