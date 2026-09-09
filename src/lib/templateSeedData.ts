import { collection, doc, writeBatch, getDocs, query, where } from "firebase/firestore";
import { db } from "./firebase";
import { DrawingTemplate, DrawingTemplateGroup, DrawingTemplateItem } from "../types";
import { v4 as uuidv4 } from "uuid";

export interface SeedTemplateData {
  templateName: string;
  projectType: string;
  description: string;
  groups: {
    groupName: string;
    items: {
      drawingNumber: string;
      drawingName: string;
      scale: string;
      notes?: string;
    }[];
  }[];
}

export const INITIAL_DEFAULT_TEMPLATES: SeedTemplateData[] = [
  {
    templateName: "Standar AutoCAD T8 (8x12.5) — Arsitektur & MEP",
    projectType: "Residensial / Komersial",
    description: "Format resmi standar AutoCAD sesuai gambar kerja proyek T8 8x12.5 dengan 41 gambar lengkap: Arsitektur, Plafond, Pola Lantai, dan MEP terpadu.",
    groups: [
      {
        groupName: "INFORMASI",
        items: [
          { drawingNumber: "A-0000", drawingName: "COVER", scale: "NTS" },
          { drawingNumber: "A-0101", drawingName: "DAFTAR GAMBAR #1", scale: "NTS" },
          { drawingNumber: "A-0102", drawingName: "DAFTAR GAMBAR #2", scale: "NTS" },
        ],
      },
      {
        groupName: "DENAH LANTAI",
        items: [
          { drawingNumber: "A-0201", drawingName: "DENAH LANTAI 1 DAN 2", scale: "1 : 100" },
          { drawingNumber: "A-0202", drawingName: "DENAH LANTAI ATAP DAN DENAH ATAP", scale: "1 : 100" },
        ],
      },
      {
        groupName: "TAMPAK",
        items: [
          { drawingNumber: "A-0301", drawingName: "TAMPAK DEPAN DAN TAMPAK BELAKANG", scale: "1 : 100" },
          { drawingNumber: "A-0302", drawingName: "TAMPAK SAMPING KANAN", scale: "1 : 100" },
          { drawingNumber: "A-0303", drawingName: "TAMPAK SAMPING KIRI", scale: "1 : 100" },
        ],
      },
      {
        groupName: "POTONGAN",
        items: [
          { drawingNumber: "A-0401", drawingName: "POTONGAN A & B", scale: "1 : 100" },
          { drawingNumber: "A-0402", drawingName: "POTONGAN C & D", scale: "1 : 100" },
          { drawingNumber: "A-0403", drawingName: "POTONGAN E", scale: "1 : 100" },
          { drawingNumber: "A-0404", drawingName: "POTONGAN F", scale: "1 : 100" },
          { drawingNumber: "A-0405", drawingName: "POTONGAN G", scale: "1 : 100" },
          { drawingNumber: "A-0406", drawingName: "POTONGAN H", scale: "1 : 100" },
        ],
      },
      {
        groupName: "DENAH RENCANA PLAFOND",
        items: [
          { drawingNumber: "A-0501", drawingName: "DENAH RENCANA PLAFOND LANTAI 1 & 2", scale: "1 : 100" },
          { drawingNumber: "A-0502", drawingName: "DENAH RENCANA PLAFOND ATAP & DETAIL MANHOLE", scale: "1 : 10 / 1 : 100" },
          { drawingNumber: "A-0503", drawingName: "DETAIL PLAFOND", scale: "1 : 5" },
        ],
      },
      {
        groupName: "DENAH POLA LANTAI",
        items: [
          { drawingNumber: "A-0601", drawingName: "DENAH RENCANA POLA LANTAI, LANTAI 1 & 2", scale: "1 : 100" },
          { drawingNumber: "A-0602", drawingName: "DETAIL POTONGAN LANTAI", scale: "1 : 10" },
        ],
      },
      {
        groupName: "MEKANIKAL ELEKTRIKAL PLUMBING",
        items: [
          { drawingNumber: "A-0701", drawingName: "RENCANA INSTALASI AIR KOTOR, BEKAS DAN HUJAN DENAH LANTAI 1 DAN 2", scale: "1 : 100" },
          { drawingNumber: "A-0702", drawingName: "RENCANA INSTALASI AIR KOTOR, BEKAS DAN HUJAN DENAH ATAP", scale: "1 : 100" },
          { drawingNumber: "A-0703", drawingName: "RENCANA INSTALASI AIR KOTOR DENAH TOILET LT. 1", scale: "1 : 20" },
          { drawingNumber: "A-0704", drawingName: "RENCANA INSTALASI AIR KOTOR DENAH TOILET LT. 2", scale: "1 : 20" },
          { drawingNumber: "A-0705", drawingName: "ISOMETRI INSTALASI AIR KOTOR", scale: "NTS" },
          { drawingNumber: "A-0706", drawingName: "RENCANA INSTALASI AIR BERSIH DAN PANAS DENAH LANTAI 1 DAN 2", scale: "1 : 100" },
          { drawingNumber: "A-0707", drawingName: "RENCANA INSTALASI AIR BERSIH DAN PANAS DENAH ATAP", scale: "1 : 100" },
          { drawingNumber: "A-0708", drawingName: "RENCANA INSTALASI AIR BERSIH DAN PANAS DENAH TOILET LT. 1", scale: "1 : 20" },
          { drawingNumber: "A-0709", drawingName: "RENCANA INSTALASI AIR BERSIH DAN PANAS DENAH TOILET LT. 2", scale: "1 : 20" },
          { drawingNumber: "A-0710", drawingName: "ISOMETRI INSTALASI AIR BERSIH DAN PANAS", scale: "NTS" },
          { drawingNumber: "A-0711", drawingName: "DAFTAR PERALATAN TATA UDARA", scale: "NTS" },
          { drawingNumber: "A-0712", drawingName: "INSTALASI TATA UDARA DENAH LANTAI 1 DAN 2", scale: "1 : 100" },
          { drawingNumber: "A-0713", drawingName: "INSTALASI TATA UDARA DENAH ATAP", scale: "1 : 100" },
          { drawingNumber: "A-0714", drawingName: "INSTALASI VENTILASI DENAH LANTAI 1 DAN 2", scale: "1 : 100" },
          { drawingNumber: "A-0715", drawingName: "DETAIL STANDARD PERALATAN TATA UDARA", scale: "NTS" },
          { drawingNumber: "A-0716", drawingName: "DETAIL SEPTIC TANK DAN BAK KONTROL", scale: "1 : 10" },
          { drawingNumber: "A-0717", drawingName: "DETAIL GROUND TANK", scale: "1 : 10" },
          { drawingNumber: "A-0718", drawingName: "DETAIL PERALATAN PLUMBING & DETAIL PRINSIP PEMASANGAN PIPA", scale: "NTS" },
          { drawingNumber: "A-0720", drawingName: "DIAGRAM SKEMATIK SISTEM ELEKTRIKAL", scale: "NTS" },
          { drawingNumber: "A-0721", drawingName: "DIAGRAM WIRING", scale: "NTS" },
          { drawingNumber: "A-0722", drawingName: "RENCANA TITIK LAMPU & SAKLAR LANTAI 1 DAN 2", scale: "1 : 100" },
          { drawingNumber: "A-0723", drawingName: "OUTLET DATA, TV & STOP KONTAK DENAH LANTAI 1 & 2", scale: "1 : 100" },
          { drawingNumber: "A-0724", drawingName: "DETAIL STANDARD PERALATAN ELEKTRIKAL", scale: "1 : 25" },
        ],
      },
    ],
  },
  {
    templateName: "Rumah Tinggal 1 Lantai (Standar IMB / PBG)",
    projectType: "Residensial",
    description: "Template gambar kerja terstruktur arsitektur rumah tinggal 1 lantai lengkap dengan MEP dasar.",
    groups: [
      {
        groupName: "AR-00 INFORMASI & SITEPLAN",
        items: [
          { drawingNumber: "AR-0000", drawingName: "Cover Proyek & Lembar Pengesahan", scale: "NTS" },
          { drawingNumber: "AR-0001", drawingName: "Daftar Gambar Kerja", scale: "NTS" },
          { drawingNumber: "AR-0002", drawingName: "Siteplan & Rencana Situasi", scale: "1 : 200" },
        ],
      },
      {
        groupName: "AR-01 DENAH & POLA LANTAI",
        items: [
          { drawingNumber: "AR-0101", drawingName: "Denah Rencana Tata Ruang Lantai 1", scale: "1 : 100" },
          { drawingNumber: "AR-0102", drawingName: "Denah Rencana Pola Penutup Lantai", scale: "1 : 100" },
          { drawingNumber: "AR-0103", drawingName: "Denah Rencana Rangka Atap & Talang", scale: "1 : 100" },
        ],
      },
      {
        groupName: "AR-02 TAMPAK BANGUNAN",
        items: [
          { drawingNumber: "AR-0201", drawingName: "Tampak Depan & Belakang", scale: "1 : 100" },
          { drawingNumber: "AR-0202", drawingName: "Tampak Samping Kanan & Kiri", scale: "1 : 100" },
        ],
      },
      {
        groupName: "AR-03 POTONGAN BANGUNAN",
        items: [
          { drawingNumber: "AR-0301", drawingName: "Potongan Melintang A-A", scale: "1 : 100" },
          { drawingNumber: "AR-0302", drawingName: "Potongan Memanjang B-B", scale: "1 : 100" },
        ],
      },
      {
        groupName: "AR-04 DETAIL ARSITEKTUR",
        items: [
          { drawingNumber: "AR-0401", drawingName: "Detail Kusen Pintu & Jendela", scale: "1 : 20" },
          { drawingNumber: "AR-0402", drawingName: "Detail Kamar Mandi & Sanitair", scale: "1 : 20" },
          { drawingNumber: "AR-0403", drawingName: "Detail Fasade & Profil Dinding", scale: "1 : 25" },
        ],
      },
      {
        groupName: "ME-01 MEKANIKAL & ELEKTRIKAL",
        items: [
          { drawingNumber: "ME-0101", drawingName: "Rencana Titik Lampu, Stop Kontak & Saklar", scale: "1 : 100" },
          { drawingNumber: "ME-0102", drawingName: "Rencana Instalasi Air Bersih & Air Panas", scale: "1 : 100" },
          { drawingNumber: "ME-0103", drawingName: "Rencana Air Kotor, Buangan & Resapan", scale: "1 : 100" },
        ],
      },
    ],
  },
  {
    templateName: "Rumah Tinggal 2 Lantai Standar & Struktur",
    projectType: "Residensial",
    description: "Paket lengkap arsitektur 2 lantai beserta gambar rencana struktural pondasi, sloof, balok, dan plat lantai.",
    groups: [
      {
        groupName: "AR-00 INFORMASI UMUM",
        items: [
          { drawingNumber: "AR-0000", drawingName: "Cover Proyek & Data Umum", scale: "NTS" },
          { drawingNumber: "AR-0001", drawingName: "Lembar Daftar Gambar", scale: "NTS" },
          { drawingNumber: "AR-0002", drawingName: "Rencana Tapak & Situasi Lingkungan", scale: "1 : 200" },
        ],
      },
      {
        groupName: "AR-01 DENAH ARSITEKTUR",
        items: [
          { drawingNumber: "AR-0101", drawingName: "Denah Tata Ruang Lantai 1", scale: "1 : 100" },
          { drawingNumber: "AR-0102", drawingName: "Denah Tata Ruang Lantai 2", scale: "1 : 100" },
          { drawingNumber: "AR-0103", drawingName: "Denah Rencana Plafond Lt. 1 & 2", scale: "1 : 100" },
          { drawingNumber: "AR-0104", drawingName: "Denah Pola Lantai Lt. 1 & 2", scale: "1 : 100" },
          { drawingNumber: "AR-0105", drawingName: "Denah Rencana Atap & Talang Air", scale: "1 : 100" },
        ],
      },
      {
        groupName: "AR-02 TAMPAK & POTONGAN",
        items: [
          { drawingNumber: "AR-0201", drawingName: "Tampak Depan & Belakang", scale: "1 : 100" },
          { drawingNumber: "AR-0202", drawingName: "Tampak Samping Kanan & Kiri", scale: "1 : 100" },
          { drawingNumber: "AR-0203", drawingName: "Potongan Melintang A-A", scale: "1 : 100" },
          { drawingNumber: "AR-0204", drawingName: "Potongan Memanjang B-B", scale: "1 : 100" },
        ],
      },
      {
        groupName: "ST-01 STRUKTUR BANGUNAN",
        items: [
          { drawingNumber: "ST-0101", drawingName: "Rencana Pondasi Batu Kali & Footplate", scale: "1 : 100" },
          { drawingNumber: "ST-0102", drawingName: "Detail Pondasi & Sloof Beton", scale: "1 : 20" },
          { drawingNumber: "ST-0103", drawingName: "Rencana Kolom & Balok Lantai 1", scale: "1 : 100" },
          { drawingNumber: "ST-0104", drawingName: "Rencana Balok & Plat Lantai 2", scale: "1 : 100" },
          { drawingNumber: "ST-0105", drawingName: "Rencana Ringbalk & Rangka Atap Baja Ringan", scale: "1 : 100" },
          { drawingNumber: "ST-0106", drawingName: "Detail Tangga Beton & Railing", scale: "1 : 25" },
        ],
      },
      {
        groupName: "ME-01 MEKANIKAL & ELEKTRIKAL",
        items: [
          { drawingNumber: "ME-0101", drawingName: "Rencana Titik Lampu & Saklar Lt. 1 & 2", scale: "1 : 100" },
          { drawingNumber: "ME-0102", drawingName: "Rencana Stop Kontak & Rangkaian Daya", scale: "1 : 100" },
          { drawingNumber: "ME-0103", drawingName: "Rencana Instalasi Air Bersih & Pompa", scale: "1 : 100" },
          { drawingNumber: "ME-0104", drawingName: "Rencana Instalasi Air Kotor & Septic Tank", scale: "1 : 100" },
        ],
      },
    ],
  },
  {
    templateName: "Rumah Tinggal Mewah 3 Lantai / Townhouse",
    projectType: "Residensial",
    description: "Template komprehensif gambar kerja bangunan 3 lantai, rooftop, detail arsitektur mewah, dan sistem MEP lengkap.",
    groups: [
      {
        groupName: "AR-00 INFORMASI & SITEPLAN",
        items: [
          { drawingNumber: "AR-0000", drawingName: "Cover Proyek & Lembar Pengesahan", scale: "NTS" },
          { drawingNumber: "AR-0001", drawingName: "Daftar Gambar Kerja", scale: "NTS" },
          { drawingNumber: "AR-0002", drawingName: "Rencana Tapak & Sirkulasi Garasi", scale: "1 : 200" },
        ],
      },
      {
        groupName: "AR-01 DENAH MULTI-LEVEL",
        items: [
          { drawingNumber: "AR-0101", drawingName: "Denah Lantai 1 (Semi-Public & Service)", scale: "1 : 100" },
          { drawingNumber: "AR-0102", drawingName: "Denah Lantai 2 (Living & Master Bedroom)", scale: "1 : 100" },
          { drawingNumber: "AR-0103", drawingName: "Denah Lantai 3 (Bedrooms & Private Lounge)", scale: "1 : 100" },
          { drawingNumber: "AR-0104", drawingName: "Denah Rooftop, Gazebo & Kolam", scale: "1 : 100" },
          { drawingNumber: "AR-0105", drawingName: "Denah Rencana Atap & Talang", scale: "1 : 100" },
        ],
      },
      {
        groupName: "AR-02 TAMPAK & POTONGAN",
        items: [
          { drawingNumber: "AR-0201", drawingName: "Tampak Depan Utama", scale: "1 : 100" },
          { drawingNumber: "AR-0202", drawingName: "Tampak Belakang & Void", scale: "1 : 100" },
          { drawingNumber: "AR-0203", drawingName: "Tampak Samping Kanan & Kiri", scale: "1 : 100" },
          { drawingNumber: "AR-0204", drawingName: "Potongan Melintang Bangunan A-A", scale: "1 : 100" },
          { drawingNumber: "AR-0205", drawingName: "Potongan Memanjang Bangunan B-B", scale: "1 : 100" },
        ],
      },
      {
        groupName: "AR-03 DETAIL ARSITEKTUR MEWAH",
        items: [
          { drawingNumber: "AR-0301", drawingName: "Detail Fasad Utama, Kisi-Kisi & Kanopi", scale: "1 : 25" },
          { drawingNumber: "AR-0302", drawingName: "Detail Tangga Utama Lt. 1 ke Lt. 2", scale: "1 : 20" },
          { drawingNumber: "AR-0303", drawingName: "Detail Tangga Spiral Lt. 2 ke Lt. 3", scale: "1 : 20" },
          { drawingNumber: "AR-0304", drawingName: "Detail Kamar Mandi Utama & Jacuzzi", scale: "1 : 20" },
          { drawingNumber: "AR-0305", drawingName: "Detail Kusen Pintu Pivot & Sliding Kaca", scale: "1 : 20" },
          { drawingNumber: "AR-0306", drawingName: "Detail Kolam Renang / Water Feature", scale: "1 : 25" },
        ],
      },
      {
        groupName: "ME-01 MEKANIKAL, ELEKTRIKAL & SMART HOME",
        items: [
          { drawingNumber: "ME-0101", drawingName: "Rencana Kelistrikan & Penerangan 3 Lantai", scale: "1 : 100" },
          { drawingNumber: "ME-0102", drawingName: "Rencana Jalur Smart Home & CCTV", scale: "1 : 100" },
          { drawingNumber: "ME-0103", drawingName: "Rencana Plumbing Air Bersih & Water Heater", scale: "1 : 100" },
          { drawingNumber: "ME-0104", drawingName: "Rencana Tata Udara (AC Inverter) & Exhaust", scale: "1 : 100" },
        ],
      },
    ],
  },
  {
    templateName: "Gedung Bertingkat / Komersial / Perkantoran",
    projectType: "Komersial / Kantor",
    description: "Template standar dokumen gambar kerja untuk bangunan gedung bertingkat, ruko modern, dan perkantoran.",
    groups: [
      {
        groupName: "AR-00 DOKUMEN UMUM & MASTERPLAN",
        items: [
          { drawingNumber: "AR-0000", drawingName: "Cover Proyek & Lembar Pengesahan", scale: "NTS" },
          { drawingNumber: "AR-0001", drawingName: "Lembar Daftar Gambar Kerja", scale: "NTS" },
          { drawingNumber: "AR-0002", drawingName: "Masterplan & Sirkulasi Kendaraan", scale: "1 : 500" },
        ],
      },
      {
        groupName: "AR-01 DENAH TINGKAT & BASEMENT",
        items: [
          { drawingNumber: "AR-0101", drawingName: "Denah Basement & Parkir Kendaraan", scale: "1 : 200" },
          { drawingNumber: "AR-0102", drawingName: "Denah Ground Floor & Lobby Utama", scale: "1 : 100" },
          { drawingNumber: "AR-0103", drawingName: "Denah Lantai Tipikal (Lt. 2 - 5)", scale: "1 : 100" },
          { drawingNumber: "AR-0104", drawingName: "Denah Lantai Top Level & Ruang Mesin", scale: "1 : 100" },
          { drawingNumber: "AR-0105", drawingName: "Denah Rencana Atap & Jalur Gondola", scale: "1 : 200" },
        ],
      },
      {
        groupName: "AR-02 ELEVASI & POTONGAN",
        items: [
          { drawingNumber: "AR-0201", drawingName: "Tampak Utara & Selatan", scale: "1 : 150" },
          { drawingNumber: "AR-0202", drawingName: "Tampak Timur & Barat", scale: "1 : 150" },
          { drawingNumber: "AR-0203", drawingName: "Potongan Melintang Bangunan Utama", scale: "1 : 100" },
          { drawingNumber: "AR-0204", drawingName: "Potongan Memanjang Bangunan Utama", scale: "1 : 100" },
        ],
      },
      {
        groupName: "AR-03 DETAIL KHUSUS & FASAD",
        items: [
          { drawingNumber: "AR-0301", drawingName: "Detail Curtain Wall & Fasad Kaca Spandrel", scale: "1 : 25" },
          { drawingNumber: "AR-0302", drawingName: "Detail Core, Lift & Tangga Darurat Kebakaran", scale: "1 : 25" },
          { drawingNumber: "AR-0303", drawingName: "Detail Toilet Komersil & Difabel", scale: "1 : 20" },
          { drawingNumber: "AR-0304", drawingName: "Detail Drop-off & Kanopi Utama", scale: "1 : 25" },
        ],
      },
      {
        groupName: "ME-01 SISTEM UTILITAS GEDUNG",
        items: [
          { drawingNumber: "ME-0101", drawingName: "Skema Riser Diagram Listrik & Genset Cadangan", scale: "NTS" },
          { drawingNumber: "ME-0102", drawingName: "Sistem Proteksi Kebakaran (Hydrant & Sprinkler)", scale: "1 : 200" },
          { drawingNumber: "ME-0103", drawingName: "Sistem HVAC / Tata Udara Gedung Chiller", scale: "1 : 200" },
          { drawingNumber: "ME-0104", drawingName: "Sistem Plumbing & Sewage Treatment Plant (STP)", scale: "1 : 200" },
        ],
      },
    ],
  },
  {
    templateName: "Paket Renovasi & Interior Fit-Out",
    projectType: "Interior & Renovasi",
    description: "Template standar gambar kerja arsitektur interior, rencana pembongkaran, furniture layout, dan detail joinery custom.",
    groups: [
      {
        groupName: "IN-00 INFORMASI & SITE DATA",
        items: [
          { drawingNumber: "IN-0000", drawingName: "Cover Proyek & Moodboard Material", scale: "NTS" },
          { drawingNumber: "IN-0001", drawingName: "Daftar Gambar Interior Fit-Out", scale: "NTS" },
          { drawingNumber: "IN-0002", drawingName: "Denah Eksisting & Rencana Pembongkaran", scale: "1 : 50" },
        ],
      },
      {
        groupName: "IN-01 LAYOUT FURNITUR & FINISHES",
        items: [
          { drawingNumber: "IN-0101", drawingName: "Denah Rencana Tata Letak Furnitur (Layout Plan)", scale: "1 : 50" },
          { drawingNumber: "IN-0102", drawingName: "Denah Rencana Pola Penutup Lantai & Karpet", scale: "1 : 50" },
          { drawingNumber: "IN-0103", drawingName: "Denah Rencana Dinding, Partisi & Wallpanel", scale: "1 : 50" },
          { drawingNumber: "IN-0104", drawingName: "Reflected Ceiling Plan (RCP) & Drop Ceiling", scale: "1 : 50" },
        ],
      },
      {
        groupName: "IN-02 ELEVASI INTERIOR",
        items: [
          { drawingNumber: "IN-0201", drawingName: "Elevasi Dinding Ruang Tamu / Reception", scale: "1 : 25" },
          { drawingNumber: "IN-0202", drawingName: "Elevasi Dinding Ruang Kerja / Kamar Utama", scale: "1 : 25" },
          { drawingNumber: "IN-0203", drawingName: "Elevasi Pantry / Kitchen Cabinet", scale: "1 : 25" },
        ],
      },
      {
        groupName: "IN-03 DETAIL CUSTOM JOINERY",
        items: [
          { drawingNumber: "IN-0301", drawingName: "Detail Backdrop TV & Credenza Custom", scale: "1 : 20" },
          { drawingNumber: "IN-0302", drawingName: "Detail Lemari Pakaian (Wardrobe) & Vanity", scale: "1 : 20" },
          { drawingNumber: "IN-0303", drawingName: "Detail Meja Kerja & Kabinet Atas", scale: "1 : 20" },
          { drawingNumber: "IN-0304", drawingName: "Detail Sambungan Partisi Kaca & Akustik", scale: "1 : 10" },
        ],
      },
      {
        groupName: "IN-04 MEKANIKAL & ELEKTRIKAL INTERIOR",
        items: [
          { drawingNumber: "IN-0401", drawingName: "Rencana Titik Lampu Dekoratif & Saklar", scale: "1 : 50" },
          { drawingNumber: "IN-0402", drawingName: "Rencana Stop Kontak Meja & Floor Box Data", scale: "1 : 50" },
          { drawingNumber: "IN-0403", drawingName: "Rencana Jalur Pipa Sink & Pembuangan Kitchen", scale: "1 : 50" },
        ],
      },
    ],
  },
];

/**
 * Seeds or syncs the redesigned templates into Firestore.
 * If replaceExisting is true, it removes old default templates and recreates fresh.
 */
export async function seedDefaultTemplates(
  userId: string, 
  userName: string,
  replaceExisting: boolean = false
): Promise<number> {
  const now = new Date().toISOString();
  let totalCount = 0;

  if (replaceExisting) {
    // Clean up existing default templates
    try {
      const snap = await getDocs(collection(db, "drawingTemplates"));
      for (const d of snap.docs) {
        const tpl = d.data() as DrawingTemplate;
        // If it's a seed or matching template name, delete its groups and items
        const isDefaultSeed = INITIAL_DEFAULT_TEMPLATES.some(
          (t) => t.templateName === tpl.templateName || tpl.templateName.includes("Rumah Tinggal") || tpl.templateName.includes("Gedung") || tpl.templateName.includes("AutoCAD")
        );
        if (isDefaultSeed) {
          const batch = writeBatch(db);
          const grps = await getDocs(query(collection(db, "drawingTemplateGroups"), where("templateId", "==", tpl.id)));
          grps.docs.forEach((g) => batch.delete(g.ref));
          const itms = await getDocs(query(collection(db, "drawingTemplateItems"), where("templateId", "==", tpl.id)));
          itms.docs.forEach((i) => batch.delete(i.ref));
          batch.delete(d.ref);
          await batch.commit();
        }
      }
    } catch (e) {
      console.warn("Could not clean old templates:", e);
    }
  }

  for (const tplData of INITIAL_DEFAULT_TEMPLATES) {
    const templateId = uuidv4();
    const batch = writeBatch(db);

    let totalItems = 0;
    const totalGroups = tplData.groups.length;

    // 1. Template doc
    const templateDoc: DrawingTemplate = {
      id: templateId,
      templateName: tplData.templateName,
      projectType: tplData.projectType,
      description: tplData.description,
      groupCount: totalGroups,
      itemCount: 0,
      createdBy: userId,
      createdByName: userName,
      createdAt: now,
      updatedAt: now,
    };

    // 2. Groups & items
    let groupIndex = 1;
    for (const grp of tplData.groups) {
      const groupId = uuidv4();
      const groupDoc: DrawingTemplateGroup = {
        id: groupId,
        templateId,
        groupName: grp.groupName,
        sortOrder: groupIndex++,
        createdAt: now,
        updatedAt: now,
      };
      batch.set(doc(db, "drawingTemplateGroups", groupId), groupDoc);

      let itemIndex = 1;
      for (const itm of grp.items) {
        totalItems++;
        const itemId = uuidv4();
        const itemDoc: DrawingTemplateItem = {
          id: itemId,
          templateId,
          groupId,
          drawingNumber: itm.drawingNumber,
          drawingName: itm.drawingName,
          scale: itm.scale,
          notes: itm.notes || "",
          sortOrder: itemIndex++,
          createdAt: now,
          updatedAt: now,
        };
        batch.set(doc(db, "drawingTemplateItems", itemId), itemDoc);
      }
    }

    templateDoc.itemCount = totalItems;
    batch.set(doc(db, "drawingTemplates", templateId), templateDoc);

    await batch.commit();
    totalCount++;
  }

  return totalCount;
}

