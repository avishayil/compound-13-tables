// נתוני המגרשים של כל גרסה נמצאים ב-public/data/<version>/plots.csv (חילוץ של plots.pdf).
// הקבצים נטענים ב-datasets.ts — אין להזין נתונים ידנית כאן.
import { parseCsv } from '../lib/csvParse';

export interface Lot {
  /** מס׳ מגרש (מחרוזת — בגרסת 106(ב) יש מגרשים מפוצלים כמו 40A/40B) */
  id: string;
  /** שטח המגרש (מ״ר) */
  lotArea: number;
  /** ייעוד */
  zoning: string;
  /** שטח פלדלת למגורים (מ״ר) */
  residentialPaldelletArea: number;
  /** כמות יח״ד */
  housingUnits: number;
  /** שטח למסחר בקומת קרקע (מ״ר; בגרסת 106(ב) — שטח עיקרי) */
  commercialGroundFloorArea: number;
  /**
   * שטח למסחר/תעסוקה בקומות שמעל קומת הקרקע (מ״ר).
   * מופקדת: מסחר בקומה ראשונה. 106(ב): שטח ברוטו למשרדים/מסחר בקומות עליונות.
   */
  commercialUpperArea: number;
  /** מבני ציבור בבנייה ורטיקלית (מ״ר) — נבנים ע״י בעל הקרקע ונרשמים על שם הרשות; לא מיוחסים לבעלים */
  publicBuildingArea: number;
  /** סה״כ שווי המגרש (₪) לפי טבלת השמאי */
  lotValue: number;
}

function num(value: string): number {
  return Number(value.replace(/,/g, '').trim());
}

/** מפענח את תוכן plots.csv לרשימת מגרשים. עמודות לפי סדר הכותרת בקובץ. */
export function parseLotsCsv(csv: string): Lot[] {
  // דילוג על שורת הכותרת
  return parseCsv(csv)
    .slice(1)
    .map((cols) => ({
      id: cols[0].trim(),
      lotArea: num(cols[1]),
      zoning: cols[2].trim(),
      residentialPaldelletArea: num(cols[3]),
      housingUnits: num(cols[4]),
      commercialGroundFloorArea: num(cols[5]),
      commercialUpperArea: num(cols[6]),
      publicBuildingArea: num(cols[7]),
      lotValue: num(cols[8]),
    }));
}

/** מיון טבעי של מזהי מגרשים: לפי המספר, ואז לפי האות (40A < 40B < 41 < 100). */
export function compareLotIds(a: string, b: string): number {
  return a.localeCompare(b, 'en', { numeric: true });
}
