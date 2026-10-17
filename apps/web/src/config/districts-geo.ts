/**
 * Approximate centre points of Rwanda's 30 districts (district seats), by name, for the public
 * register map. Entries are shown per district only (never an address), so a centre point is
 * all the map needs. [longitude, latitude].
 */
export const DISTRICT_CENTRES: Record<string, [number, number]> = {
  Nyarugenge: [30.03, -1.96],
  Gasabo: [30.13, -1.86],
  Kicukiro: [30.17, -2.03],
  Nyanza: [29.75, -2.35],
  Gisagara: [29.83, -2.6],
  Nyaruguru: [29.53, -2.65],
  Huye: [29.74, -2.6],
  Nyamagabe: [29.48, -2.47],
  Ruhango: [29.78, -2.22],
  Muhanga: [29.75, -2.08],
  Kamonyi: [29.9, -2.01],
  Karongi: [29.36, -2.06],
  Rutsiro: [29.32, -1.92],
  Rubavu: [29.33, -1.7],
  Nyabihu: [29.51, -1.65],
  Ngororero: [29.53, -1.87],
  Rusizi: [29.0, -2.48],
  Nyamasheke: [29.13, -2.33],
  Rulindo: [30.0, -1.73],
  Gakenke: [29.79, -1.69],
  Musanze: [29.63, -1.5],
  Burera: [29.83, -1.47],
  Gicumbi: [30.1, -1.58],
  Rwamagana: [30.43, -1.95],
  Nyagatare: [30.33, -1.3],
  Gatsibo: [30.45, -1.58],
  Kayonza: [30.65, -1.9],
  Kirehe: [30.7, -2.27],
  Ngoma: [30.48, -2.16],
  Bugesera: [30.15, -2.23],
};

/** Rwanda's bounding box, [[west, south], [east, north]]. */
export const RWANDA_BOUNDS: [[number, number], [number, number]] = [
  [28.86, -2.84],
  [30.9, -1.05],
];
