/**
 * Administrative divisions (FR-B-009, Plan §4 input P5). Pilot subset: all provinces and
 * districts, every sector of the three Kigali districts, and cells/villages for sample sectors.
 * The full Province → Village dataset is loaded with `pnpm tsx prisma/import-divisions.ts <csv>`.
 *
 * Codes: province 1 digit, district 2, sector 4, cell 6, village 8 (each extends its parent).
 */
export interface Division {
  code: string;
  level: 1 | 2 | 3 | 4 | 5;
  name: string;
  parentCode: string | null;
}

const PROVINCES: Array<[string, string]> = [
  ["1", "Kigali City"],
  ["2", "Southern Province"],
  ["3", "Western Province"],
  ["4", "Northern Province"],
  ["5", "Eastern Province"],
];

const DISTRICTS: Record<string, string[]> = {
  "1": ["Nyarugenge", "Gasabo", "Kicukiro"],
  "2": ["Nyanza", "Gisagara", "Nyaruguru", "Huye", "Nyamagabe", "Ruhango", "Muhanga", "Kamonyi"],
  "3": ["Karongi", "Rutsiro", "Rubavu", "Nyabihu", "Ngororero", "Rusizi", "Nyamasheke"],
  "4": ["Rulindo", "Gakenke", "Musanze", "Burera", "Gicumbi"],
  "5": ["Rwamagana", "Nyagatare", "Gatsibo", "Kayonza", "Kirehe", "Ngoma", "Bugesera"],
};

const SECTORS: Record<string, string[]> = {
  Nyarugenge: [
    "Gitega",
    "Kanyinya",
    "Kigali",
    "Kimisagara",
    "Mageragere",
    "Muhima",
    "Nyakabanda",
    "Nyamirambo",
    "Nyarugenge",
    "Rwezamenyo",
  ],
  Gasabo: [
    "Bumbogo",
    "Gatsata",
    "Gikomero",
    "Gisozi",
    "Jabana",
    "Jali",
    "Kacyiru",
    "Kimihurura",
    "Kimironko",
    "Kinyinya",
    "Ndera",
    "Nduba",
    "Remera",
    "Rusororo",
    "Rutunga",
  ],
  Kicukiro: [
    "Gahanga",
    "Gatenga",
    "Gikondo",
    "Kagarama",
    "Kanombe",
    "Kicukiro",
    "Kigarama",
    "Masaka",
    "Niboye",
    "Nyarugunga",
  ],
  Musanze: ["Cyuve", "Gacaca", "Kimonyi", "Muhoza", "Musanze", "Nyange"],
  Huye: ["Huye", "Mukura", "Ngoma", "Tumba"],
  Rubavu: ["Gisenyi", "Nyamyumba", "Rubavu", "Rugerero"],
};

const CELLS: Record<string, string[]> = {
  Kimihurura: ["Kamukina", "Kimihurura", "Rugando"],
  Remera: ["Nyabisindu", "Nyarutarama", "Rukiri I", "Rukiri II"],
  Kacyiru: ["Kamatamu", "Kamutwa", "Kibaza"],
  Nyarugenge: ["Agatare", "Biryogo", "Kiyovu", "Rwampara"],
  Kicukiro: ["Gasharu", "Kagina", "Kicukiro", "Ngoma"],
};

const VILLAGES = ["Amahoro", "Ubumwe", "Urugwiro", "Ituze"];

export function divisions(): Division[] {
  const result: Division[] = [];
  for (const [code, name] of PROVINCES) result.push({ code, level: 1, name, parentCode: null });
  for (const [province, names] of Object.entries(DISTRICTS)) {
    names.forEach((district, i) => {
      const districtCode = `${province}${i + 1}`;
      result.push({ code: districtCode, level: 2, name: district, parentCode: province });
      (SECTORS[district] ?? []).forEach((sector, j) => {
        const sectorCode = `${districtCode}${String(j + 1).padStart(2, "0")}`;
        result.push({ code: sectorCode, level: 3, name: sector, parentCode: districtCode });
        (CELLS[sector] ?? []).forEach((cell, k) => {
          const cellCode = `${sectorCode}${String(k + 1).padStart(2, "0")}`;
          result.push({ code: cellCode, level: 4, name: cell, parentCode: sectorCode });
          VILLAGES.forEach((village, v) =>
            result.push({
              code: `${cellCode}${String(v + 1).padStart(2, "0")}`,
              level: 5,
              name: village,
              parentCode: cellCode,
            }),
          );
        });
      });
    });
  }
  return result;
}

/** District code by name, for seed data. */
export function districtCode(name: string): string {
  const found = divisions().find((d) => d.level === 2 && d.name === name);
  if (!found) throw new Error(`Unknown district ${name}`);
  return found.code;
}
