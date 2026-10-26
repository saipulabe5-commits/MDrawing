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

export const GOLF_TIMUR_TEMPLATE: SeedTemplateData = {
  "templateName": "Golf Timur House — Master Drawing List (133 Gambar)",
  "projectType": "Rumah Tinggal Mewah",
  "description": "Daftar gambar kerja lengkap arsitektur Golf Timur House (133 gambar berurutan) bersumber dari dokumen resmi Khoma Studio.",
  "groups": [
    {
      "groupName": "GENERAL",
      "items": [
        {
          "drawingNumber": "AR 0001",
          "drawingName": "DRAWING LIST",
          "scale": "NTS",
          "notes": "No. 1 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 0002",
          "drawingName": "DRAWING LIST",
          "scale": "NTS",
          "notes": "No. 2 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 0100",
          "drawingName": "BLOCK PLAN",
          "scale": "1:250",
          "notes": "No. 3 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 0200",
          "drawingName": "SITE PLAN",
          "scale": "1:250",
          "notes": "No. 4 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 0301",
          "drawingName": "GROUND FLOOR PLAN",
          "scale": "1:150",
          "notes": "No. 5 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 0302",
          "drawingName": "1ST FLOOR PLAN",
          "scale": "1:150",
          "notes": "No. 6 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 0303",
          "drawingName": "2ND FLOOR PLAN",
          "scale": "1:150",
          "notes": "No. 7 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 0304",
          "drawingName": "ROOFTOP PLAN",
          "scale": "1:150",
          "notes": "No. 8 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 0305",
          "drawingName": "ROOF PLAN & DETAIL",
          "scale": "1:150",
          "notes": "Denah rencana atap & detail arsitektur"
        },
        {
          "drawingNumber": "AR 0401",
          "drawingName": "ELEVATION 1",
          "scale": "1:150",
          "notes": "No. 10 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 0402",
          "drawingName": "ELEVATION 2",
          "scale": "1:150",
          "notes": "No. 11 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 0403",
          "drawingName": "ELEVATION 3",
          "scale": "1:150",
          "notes": "No. 12 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 0404",
          "drawingName": "ELEVATION 4",
          "scale": "1:150",
          "notes": "No. 13 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 0501",
          "drawingName": "SECTION A",
          "scale": "1:150",
          "notes": "No. 14 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 0502",
          "drawingName": "SECTION B",
          "scale": "1:150",
          "notes": "No. 15 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 0503",
          "drawingName": "SECTION C",
          "scale": "1:150",
          "notes": "No. 16 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 0504",
          "drawingName": "SECTION D",
          "scale": "1:150",
          "notes": "No. 17 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 0505",
          "drawingName": "SECTION E",
          "scale": "1:150",
          "notes": "No. 18 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 0506",
          "drawingName": "SECTION F",
          "scale": "1:150",
          "notes": "No. 19 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 0507",
          "drawingName": "SECTION G",
          "scale": "1:150",
          "notes": "No. 20 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 0508",
          "drawingName": "SECTION H",
          "scale": "1:150",
          "notes": "No. 21 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 0509",
          "drawingName": "SECTION I",
          "scale": "1:150",
          "notes": "No. 22 dalam daftar gambar kerja"
        }
      ]
    },
    {
      "groupName": "FINISHING PLAN",
      "items": [
        {
          "drawingNumber": "AR 0600",
          "drawingName": "MATERIAL SCHEDULE",
          "scale": "NTS",
          "notes": "No. 23 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 0601",
          "drawingName": "FLOORING PLAN - GROUND FLOOR",
          "scale": "1:150",
          "notes": "No. 24 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 0602",
          "drawingName": "FLOORING PLAN - 1ST FLOOR",
          "scale": "1:150",
          "notes": "No. 25 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 0603",
          "drawingName": "FLOORING PLAN - 2ND FLOOR",
          "scale": "1:150",
          "notes": "No. 26 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 0701",
          "drawingName": "WALL FINISH PLAN - GROUND FLOOR",
          "scale": "1:150",
          "notes": "No. 27 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 0702",
          "drawingName": "WALL FINISH PLAN - 1ST FLOOR",
          "scale": "1:150",
          "notes": "No. 28 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 0703",
          "drawingName": "WALL FINISH PLAN - 2ND FLOOR",
          "scale": "1:150",
          "notes": "No. 29 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 0801",
          "drawingName": "CEILING PLAN - GROUND FLOOR",
          "scale": "1:150",
          "notes": "No. 30 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 0802",
          "drawingName": "CEILING PLAN - 1ST FLOOR",
          "scale": "1:150",
          "notes": "No. 31 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 0803",
          "drawingName": "CEILING PLAN - 2ND FLOOR",
          "scale": "1:150",
          "notes": "No. 32 dalam daftar gambar kerja"
        }
      ]
    },
    {
      "groupName": "DOOR WINDOW SCHEDULE",
      "items": [
        {
          "drawingNumber": "AR 0901",
          "drawingName": "SCHEDULE DOOR & WINDOWS - GROUND FLOOR",
          "scale": "1:150",
          "notes": "No. 33 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 0902",
          "drawingName": "SCHEDULE DOOR & WINDOWS - 1ST FLOOR",
          "scale": "1:150",
          "notes": "No. 34 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 0903",
          "drawingName": "SCHEDULE DOOR & WINDOWS - 2ND FLOOR",
          "scale": "1:150",
          "notes": "No. 35 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 0905",
          "drawingName": "SCHEDULE DOOR & WINDOWS - DETAILS",
          "scale": "1:50",
          "notes": "No. 36 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 0906",
          "drawingName": "SCHEDULE DOOR & WINDOWS - DETAILS",
          "scale": "1:50",
          "notes": "No. 37 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 0906-B",
          "drawingName": "SCHEDULE DOOR & WINDOWS - DETAILS (LANJUTAN)",
          "scale": "1:50",
          "notes": "Detail kusen pintu & jendela tambahan"
        },
        {
          "drawingNumber": "AR 0907",
          "drawingName": "SCHEDULE DOOR & WINDOWS - DETAILS",
          "scale": "1:50",
          "notes": "No. 39 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 0908",
          "drawingName": "SCHEDULE DOOR & WINDOWS - DETAILS",
          "scale": "1:50",
          "notes": "No. 40 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 0909",
          "drawingName": "SCHEDULE DOOR & WINDOWS - DETAILS",
          "scale": "1:50",
          "notes": "No. 41 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 0910",
          "drawingName": "SCHEDULE DOOR & WINDOWS - DETAILS",
          "scale": "1:50",
          "notes": "No. 42 dalam daftar gambar kerja"
        }
      ]
    },
    {
      "groupName": "BATHROOMS, POWDER ROOM, & OUTDOOR SHOWER DETAILS",
      "items": [
        {
          "drawingNumber": "AR 1001",
          "drawingName": "POWDER ROOM - LAYOUT PLAN",
          "scale": "1:25",
          "notes": "No. 43 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1002",
          "drawingName": "POWDER ROOM - FINISHING PLAN",
          "scale": "1:25",
          "notes": "No. 44 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1003",
          "drawingName": "POWDER ROOM - SECTION A",
          "scale": "1:25",
          "notes": "No. 45 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1004",
          "drawingName": "POWDER ROOM - SECTION B",
          "scale": "1:25",
          "notes": "No. 46 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1005",
          "drawingName": "POWDER ROOM - SECTION C&D",
          "scale": "1:25",
          "notes": "No. 47 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1006",
          "drawingName": "GUEST BATHROOM 1 - LAYOUT PLAN",
          "scale": "1:25",
          "notes": "No. 48 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1007",
          "drawingName": "GUEST BATHROOM 1 - FINISHING PLAN",
          "scale": "1:25",
          "notes": "No. 49 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1008",
          "drawingName": "GUEST BATHROOM 1 - SECTION A",
          "scale": "1:25",
          "notes": "No. 50 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1009",
          "drawingName": "GUEST BATHROOM 1 - SECTION B",
          "scale": "1:25",
          "notes": "No. 51 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1010",
          "drawingName": "GUEST BATHROOM 1 - SECTION C & D",
          "scale": "1:25",
          "notes": "No. 52 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1011",
          "drawingName": "JUNIOR BATHROOM - LAYOUT PLAN",
          "scale": "1:25",
          "notes": "No. 53 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1012",
          "drawingName": "JUNIOR BATHROOM - FINISHING PLAN",
          "scale": "1:25",
          "notes": "No. 54 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1013",
          "drawingName": "JUNIOR BATHROOM - SECTION A",
          "scale": "1:25",
          "notes": "No. 55 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1014",
          "drawingName": "JUNIOR BATHROOM - SECTION B",
          "scale": "1:25",
          "notes": "No. 56 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1015",
          "drawingName": "JUNIOR BATHROOM - SECTION C & D",
          "scale": "1:25",
          "notes": "No. 57 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1016",
          "drawingName": "MASTER BATHROOM - LAYOUT PLAN",
          "scale": "1:25",
          "notes": "No. 58 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1017",
          "drawingName": "MASTER BATHROOM - FINISHING PLAN",
          "scale": "1:25",
          "notes": "No. 59 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1018",
          "drawingName": "MASTER BATHROOM - SECTION A",
          "scale": "1:25",
          "notes": "No. 60 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1019",
          "drawingName": "MASTER BATHROOM - SECTION B",
          "scale": "1:25",
          "notes": "No. 61 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1020",
          "drawingName": "MASTER BATHROOM - SECTION C & D",
          "scale": "1:25",
          "notes": "No. 62 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1021",
          "drawingName": "GUEST BATHROOM 2 - LAYOUT PLAN",
          "scale": "1:25",
          "notes": "No. 63 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1022",
          "drawingName": "GUEST BATHROOM 2 - FINISHING PLAN",
          "scale": "1:25",
          "notes": "No. 64 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1023",
          "drawingName": "GUEST BATHROOM 2 - SECTION A",
          "scale": "1:25",
          "notes": "No. 65 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1024",
          "drawingName": "GUEST BATHROOM 2 - SECTION B",
          "scale": "1:25",
          "notes": "No. 66 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1025",
          "drawingName": "GUEST BATHROOM 2 - SECTION C & D",
          "scale": "1:25",
          "notes": "No. 67 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1026",
          "drawingName": "GUEST BATHROOM 3 - LAYOUT PLAN",
          "scale": "1:25",
          "notes": "No. 68 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1027",
          "drawingName": "GUEST BATHROOM 3 - FINISHING PLAN",
          "scale": "1:25",
          "notes": "No. 69 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1028",
          "drawingName": "GUEST BATHROOM 3 - SECTION A",
          "scale": "1:25",
          "notes": "No. 70 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1029",
          "drawingName": "GUEST BATHROOM 3 - SECTION B",
          "scale": "1:25",
          "notes": "No. 71 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1030",
          "drawingName": "GUEST BATHROOM 3 - SECTION C & D",
          "scale": "1:25",
          "notes": "No. 72 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1031",
          "drawingName": "MAID BATHROOM - LAYOUT PLAN",
          "scale": "1:25",
          "notes": "No. 73 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1032",
          "drawingName": "MAID BATHROOM - FINISHING PLAN",
          "scale": "1:25",
          "notes": "No. 74 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1033",
          "drawingName": "MAID BATHROOM - SECTION A",
          "scale": "1:25",
          "notes": "No. 75 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1034",
          "drawingName": "MAID BATHROOM - SECTION B",
          "scale": "1:25",
          "notes": "No. 76 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1035",
          "drawingName": "MAID BATHROOM - SECTION C & D",
          "scale": "1:25",
          "notes": "No. 77 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1036",
          "drawingName": "OUTDOOR SHOWER - PLAN, SECTIONS",
          "scale": "1:25",
          "notes": "No. 78 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1037",
          "drawingName": "BATHROOM DETAILS",
          "scale": "1:10 1:5",
          "notes": "No. 79 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1038",
          "drawingName": "BATHROOM DETAILS",
          "scale": "1:10 1:5",
          "notes": "No. 80 dalam daftar gambar kerja"
        }
      ]
    },
    {
      "groupName": "POOL & POND DETAILS",
      "items": [
        {
          "drawingNumber": "AR 1101",
          "drawingName": "POOL - PLAN",
          "scale": "1:40",
          "notes": "No. 81 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1102",
          "drawingName": "POOL - SECTION A, B, & C",
          "scale": "1:40",
          "notes": "No. 82 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1103",
          "drawingName": "POOL - DETAILS",
          "scale": "1:10",
          "notes": "No. 83 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1104",
          "drawingName": "WATER FEATURE 1 - PLAN",
          "scale": "1:25",
          "notes": "No. 84 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1105",
          "drawingName": "WATER FEATURE 1 - SECTION A , B & C",
          "scale": "1:25",
          "notes": "No. 85 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1106",
          "drawingName": "WATER FEATURE 2 - PLAN",
          "scale": "1:25",
          "notes": "No. 86 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1107",
          "drawingName": "WATER FEATURE 2 - SECTION A & B",
          "scale": "1:25",
          "notes": "No. 87 dalam daftar gambar kerja"
        }
      ]
    },
    {
      "groupName": "STAIRS",
      "items": [
        {
          "drawingNumber": "AR 1201",
          "drawingName": "MAIN STAIR - PLANS",
          "scale": "1:50,1:25",
          "notes": "No. 88 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1202",
          "drawingName": "MAIN STAIR - SECTIONS",
          "scale": "1:25,1:5",
          "notes": "No. 89 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1203",
          "drawingName": "MAIN STAIR - DETAILS",
          "scale": "1:25",
          "notes": "No. 90 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1204",
          "drawingName": "MAIN STAIR - DETAILS",
          "scale": "1:25,1:5",
          "notes": "No. 91 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1205",
          "drawingName": "SERVICE STAIR - PLAN",
          "scale": "1:25",
          "notes": "No. 92 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1206",
          "drawingName": "SERVICE STAIR - ELEVATION",
          "scale": "1:25,1:5",
          "notes": "No. 93 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1207",
          "drawingName": "SERVICE STAIR - SECTION A",
          "scale": "1:25",
          "notes": "No. 94 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1208",
          "drawingName": "SERVICE STAIR - SECTION B & DETAILS 1",
          "scale": "1:25,1:5",
          "notes": "No. 95 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1209",
          "drawingName": "SERVICE STAIR - DETAILS 2 & 3",
          "scale": "1:25",
          "notes": "No. 96 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1210",
          "drawingName": "STAIRS - DETAILS (RAILING & STEP)",
          "scale": "1:25",
          "notes": "Detail tangga, railing & pijakan"
        }
      ]
    },
    {
      "groupName": "TERRACE & HARDSCAPE",
      "items": [
        {
          "drawingNumber": "AR 1301",
          "drawingName": "ENTRANCE - PLAN & ELEVATION 1",
          "scale": "1:100",
          "notes": "No. 98 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1302",
          "drawingName": "ENTRANCE - SECTION A & B, DETAIL",
          "scale": "1:100",
          "notes": "No. 99 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1303",
          "drawingName": "SIDE TERRACE - PLAN",
          "scale": "1:100",
          "notes": "No. 100 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1304",
          "drawingName": "SIDE TERRACE - SECTION A & B, DETAILS",
          "scale": "1:100",
          "notes": "No. 101 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1305",
          "drawingName": "BACKYARD - PLAN",
          "scale": "1:100",
          "notes": "No. 102 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1306",
          "drawingName": "BACKYARD - SECTION A & B, DETAILS",
          "scale": "1:100",
          "notes": "No. 103 dalam daftar gambar kerja"
        }
      ]
    },
    {
      "groupName": "SCREEN",
      "items": [
        {
          "drawingNumber": "AR 1401",
          "drawingName": "JUNIOR BEDROOM SCREEN - PLAN",
          "scale": "1:50",
          "notes": "No. 104 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1402",
          "drawingName": "JUNIOR BEDROOM SCREEN - ELEVATION 1&2",
          "scale": "1:50",
          "notes": "No. 105 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1403",
          "drawingName": "MASTER BEDROOM SCREEN - PLAN",
          "scale": "1:50",
          "notes": "No. 106 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1404",
          "drawingName": "MASTER BEDROOM SCREEN - ELEVATION 1&2",
          "scale": "1:50",
          "notes": "No. 107 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1405",
          "drawingName": "ENTRANCE SCREEN - PLAN, ELEVATION",
          "scale": "1:25, 1:5",
          "notes": "No. 108 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1406",
          "drawingName": "SIDE SCREEN (WATER FEATURE) - PLAN, ELEVATION 1&2",
          "scale": "1:25, 1:5",
          "notes": "No. 109 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1407",
          "drawingName": "ROOFTOP SCREEN - PLAN, ELEVATION",
          "scale": "1:50",
          "notes": "No. 110 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1408",
          "drawingName": "SERVICE SCREEN (LAUNDRY AREA) - PLAN, ELEVATION",
          "scale": "1:50 1:25 1:5",
          "notes": "No. 111 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1409",
          "drawingName": "SCREEN - MODULE DETAILS",
          "scale": "1:100",
          "notes": "No. 112 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1410",
          "drawingName": "GRILL SCREEN 1 - PLAN",
          "scale": "1:100",
          "notes": "No. 113 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1411",
          "drawingName": "GRILL SCREEN 1 - ELEVATION 1&2 , DETAILS",
          "scale": "1:100",
          "notes": "No. 114 dalam daftar gambar kerja"
        }
      ]
    },
    {
      "groupName": "FENCE",
      "items": [
        {
          "drawingNumber": "AR 1501",
          "drawingName": "FENCE - PLAN & ELEVATION",
          "scale": "1:50",
          "notes": "No. 115 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1502",
          "drawingName": "FENCE - ELEVATION (OPENED & CLOSED GATE)",
          "scale": "1:50",
          "notes": "No. 116 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1503",
          "drawingName": "FENCE - SECTION A,B, & C",
          "scale": "1:20",
          "notes": "No. 117 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1504",
          "drawingName": "FENCE - DETAILS",
          "scale": "1:5",
          "notes": "No. 118 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1505",
          "drawingName": "FENCE - GATE PLAN & ELEVATION",
          "scale": "1:20",
          "notes": "No. 119 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1506",
          "drawingName": "FENCE - GRILL PLAN, ELEVATION, & DETAILS",
          "scale": "1:20 1:10 1:5",
          "notes": "No. 120 dalam daftar gambar kerja"
        }
      ]
    },
    {
      "groupName": "RAILING & PLANTER",
      "items": [
        {
          "drawingNumber": "AR 1601",
          "drawingName": "RAILING & PLANTER 1 - PLAN & ELEVATIONS",
          "scale": "1:50",
          "notes": "No. 121 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1602",
          "drawingName": "RAILING & PLANTER 1 - SECTION & DETAILS",
          "scale": "1:25 1:5",
          "notes": "No. 122 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1603",
          "drawingName": "RAILING & PLANTER 2 - PLAN",
          "scale": "1:50",
          "notes": "No. 123 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1604",
          "drawingName": "RAILING & PLANTER 2 - ELEVATIONS, SECTION, & DETAIL",
          "scale": "1:50 1:20",
          "notes": "No. 124 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1605",
          "drawingName": "RAILING & PLANTER 2 - DETAILS",
          "scale": "1:5",
          "notes": "No. 125 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1606",
          "drawingName": "RAILING & PLANTER 3 - PLAN, SECTION & ELEVATION",
          "scale": "1:50",
          "notes": "No. 126 dalam daftar gambar kerja"
        }
      ]
    },
    {
      "groupName": "CANOPY",
      "items": [
        {
          "drawingNumber": "AR 1701",
          "drawingName": "GARAGE CANOPY - PLAN",
          "scale": "1:50",
          "notes": "No. 127 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1702",
          "drawingName": "GARAGE CANOPY - ELEVATION, SECTION, & DETAIL",
          "scale": "1:50",
          "notes": "No. 128 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1703",
          "drawingName": "GARAGE CANOPY - DETAILS",
          "scale": "1:5",
          "notes": "No. 129 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1704",
          "drawingName": "BACKYARD CANOPY - PLAN",
          "scale": "1:50",
          "notes": "No. 130 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1705",
          "drawingName": "BACKYARD CANOPY - ELEVATION, SECTION, & DETAIL",
          "scale": "1:50",
          "notes": "No. 131 dalam daftar gambar kerja"
        },
        {
          "drawingNumber": "AR 1706",
          "drawingName": "BACKYARD CANOPY - DETAILS",
          "scale": "1:5",
          "notes": "No. 132 dalam daftar gambar kerja"
        }
      ]
    },
    {
      "groupName": "OTHER DETAILS",
      "items": [
        {
          "drawingNumber": "AR 1801",
          "drawingName": "COLUMN - PLAN, SECTION, DETAILS",
          "scale": "1:20 1:10 1:5",
          "notes": "No. 133 dalam daftar gambar kerja"
        }
      ]
    }
  ]
};

export const INITIAL_DEFAULT_TEMPLATES: SeedTemplateData[] = [
  GOLF_TIMUR_TEMPLATE,
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

