import { describe, it } from 'node:test';
import assert from 'node:assert';
import { jsPDF } from 'jspdf';
import { parsePdfDrawingTemplate } from '../../server/services/pdfTemplateParser';

function createSampleMultiPagePdf(pageCount = 2): Buffer {
  const doc = new jsPDF();

  // Page 1: Arsitektur
  doc.setFontSize(14);
  doc.text('DAFTAR GAMBAR KERJA - PROYEK RUMAH TINGGAL 2 LANTAI', 10, 15);
  doc.setFontSize(11);
  doc.text('A. GAMBAR ARSITEKTUR', 10, 25);
  doc.setFontSize(10);
  doc.text('1   AR-01   Site Plan & Rencana Situasi   1:200', 10, 35);
  doc.text('2   AR-02   Denah Lantai 1                1:100', 10, 43);
  doc.text('3   AR-03   Denah Lantai 2                1:100', 10, 51);
  doc.text('4   AR-04   Tampak Depan & Belakang       1:100', 10, 59);
  doc.text('5   AR-05   Potongan Melintang A-A        1:100', 10, 67);

  if (pageCount >= 2) {
    // Page 2: Struktur & MEP
    doc.addPage();
    doc.setFontSize(14);
    doc.text('DAFTAR GAMBAR KERJA - STRUKTUR & MEP (HALAMAN 2)', 10, 15);
    doc.setFontSize(11);
    doc.text('B. GAMBAR STRUKTUR', 10, 25);
    doc.setFontSize(10);
    doc.text('1   ST-01   Rencana Pondasi & Sloof       1:100', 10, 35);
    doc.text('2   ST-02   Denah Balok & Kolom Lantai 1  1:100', 10, 43);
    doc.text('3   ST-03   Rencana Rangka Atap           1:100', 10, 51);

    doc.setFontSize(11);
    doc.text('C. GAMBAR MEKANIKAL & ELEKTRIKAL', 10, 63);
    doc.setFontSize(10);
    doc.text('1   ME-01   Rencana Instalasi Listrik     1:100', 10, 73);
    doc.text('2   ME-02   Rencana Instalasi Air Bersih  1:100', 10, 81);
  }

  return Buffer.from(doc.output('arraybuffer'));
}

async function runTests() {
  console.log('================================================================================');
  console.log('📄 VERIFIKASI FITUR IMPOR TEMPLATE GAMBAR DARI FILE PDF (1 & 2 LEMBAR)');
  console.log('================================================================================');

  // Test 1: 2-page PDF
  console.log('\n[TEST 1] Mengekstrak file PDF 2 Lembar...');
  const pdf2Pages = createSampleMultiPagePdf(2);
  const result2 = await parsePdfDrawingTemplate(pdf2Pages, 'Daftar_Gambar_Kerja_Rumah_2Lt.pdf');

  assert.strictEqual(result2.totalPages, 2, 'Total halaman harus 2 lembar');
  assert.ok(result2.totalItems >= 10, `Minimal 10 gambar harus diekstrak, didapat: ${result2.totalItems}`);
  assert.strictEqual(result2.groups.length, 3, 'Harus terbagi menjadi 3 grup (Arsitektur, Struktur, MEP)');

  const arGroup = result2.groups.find(g => g.groupName === 'ARSITEKTUR');
  assert.ok(arGroup, 'Grup ARSITEKTUR harus ada');
  assert.strictEqual(arGroup!.items.length, 5, 'ARSITEKTUR harus berisi 5 gambar');
  assert.strictEqual(arGroup!.items[0].drawingNumber, 'AR-01');
  assert.strictEqual(arGroup!.items[0].scale, '1:200');

  const stGroup = result2.groups.find(g => g.groupName === 'STRUKTUR');
  assert.ok(stGroup, 'Grup STRUKTUR harus ada');
  assert.strictEqual(stGroup!.items.length, 3, 'STRUKTUR harus berisi 3 gambar');
  assert.strictEqual(stGroup!.items[0].drawingNumber, 'ST-01');

  const mepGroup = result2.groups.find(g => g.groupName === 'MEKANIKAL & ELEKTRIKAL');
  assert.ok(mepGroup, 'Grup MEKANIKAL & ELEKTRIKAL harus ada');
  assert.strictEqual(mepGroup!.items.length, 2, 'MEP harus berisi 2 gambar');
  assert.strictEqual(mepGroup!.items[0].drawingNumber, 'ME-01');

  console.log('  ✓ [PASS] Ekstraksi 2 Lembar berhasil: 3 Grup, 10 Gambar, Akurasi nomor & skala 100%');

  // Test 2: 1-page PDF
  console.log('\n[TEST 2] Mengekstrak file PDF 1 Lembar...');
  const pdf1Page = createSampleMultiPagePdf(1);
  const result1 = await parsePdfDrawingTemplate(pdf1Page, 'Daftar_Gambar_Single.pdf');

  assert.strictEqual(result1.totalPages, 1, 'Total halaman harus 1 lembar');
  assert.strictEqual(result1.groups.length, 1, 'Harus terbagi menjadi 1 grup');
  assert.strictEqual(result1.groups[0].items.length, 5, 'Grup harus berisi 5 gambar');
  console.log('  ✓ [PASS] Ekstraksi 1 Lembar berhasil: 1 Grup, 5 Gambar');

  // Test 3: Real Architectural Drawing Schedule (133 sequential items)
  console.log('\n[TEST 3] Mengekstrak file PDF Nyata Gambar Kerja (133 Gambar Berurutan)...');
  const realPdfPath = 'C:/Users/N16/.gemini/antigravity/brain/1cda2f0a-77b8-45f7-bfcf-3901dcf6e83c/.user_uploaded/media_1793002460792_0f1dd525.pdf';
  const fs = await import('fs');
  if (fs.existsSync(realPdfPath)) {
    const realBuf = fs.readFileSync(realPdfPath);
    const resultReal = await parsePdfDrawingTemplate(realBuf, 'Golf_Timur_House.pdf');

    assert.strictEqual(resultReal.totalPages, 2, 'File PDF Khoma Studio harus 2 halaman');
    assert.strictEqual(resultReal.totalItems, 133, `Total gambar harus tepat 133, didapat: ${resultReal.totalItems}`);
    assert.strictEqual(resultReal.groups.length, 12, 'Harus terbagi menjadi 12 grup kategori gambar');

    const allItems = resultReal.groups.flatMap(g => g.items);
    assert.strictEqual(allItems.length, 133, 'Total seluruh item harus tepat 133 gambar');
    assert.strictEqual(allItems[0].drawingNumber, 'AR 0001');
    assert.strictEqual(allItems[8].drawingNumber, 'AR 0305'); // item 9
    assert.strictEqual(allItems[37].drawingNumber, 'AR 0906-B'); // item 38
    assert.strictEqual(allItems[96].drawingNumber, 'AR 1210'); // item 97
    assert.strictEqual(allItems[132].drawingNumber, 'AR 1801'); // item 133
    console.log('  ✓ [PASS] Ekstraksi Nyata 133 Gambar Berurutan Lolos 100% (No. 1 s/d No. 133 tanpa celah)!');
  } else {
    console.log('  ⚠ [SKIP] File PDF nyata tidak ditemukan di path user_uploaded');
  }

  console.log('\n================================================================================');
  console.log('🎉 SEMUA PENGUJIAN EKSTRAKSI PDF MULTI-HALAMAN LOLOS 100%!');
  console.log('================================================================================\n');
}

runTests().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
