// מקור האמת לנתוני המגרשים הוא קובץ plots.csv (חילוץ של plots.pdf).
// הקובץ נטען כאן בזמן build ומפוענח ל-LOTS — אין להזין נתונים ידנית כאן.
import plotsCsv from '../../public/plots.csv?raw';

export interface Lot {
  /** מס׳ מגרש */
  id: number;
  /** שטח המגרש (מ״ר) */
  lotArea: number;
  /** ייעוד */
  zoning: string;
  /** שטח פלדלת למגורים (מ״ר) */
  residentialPaldelletArea: number;
  /** כמות יח״ד */
  housingUnits: number;
  /** שטח למסחר/תעסוקה בקומת קרקע (מ״ר) */
  commercialGroundFloorArea: number;
  /** שטח למסחר/תעסוקה בקומה ראשונה מעל קומת קרקע (מ״ר) */
  commercialFirstFloorArea: number;
}

function num(value: string): number {
  return Number(value.replace(/,/g, '').trim());
}

/** מפענח את תוכן plots.csv לרשימת מגרשים. עמודות לפי סדר הכותרת בקובץ. */
export function parseLotsCsv(csv: string): Lot[] {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  // דילוג על שורת הכותרת
  return lines.slice(1).map((line) => {
    const cols = line.split(',');
    return {
      id: num(cols[0]),
      lotArea: num(cols[1]),
      zoning: cols[2].trim(),
      residentialPaldelletArea: num(cols[3]),
      housingUnits: num(cols[4]),
      commercialGroundFloorArea: num(cols[5]),
      commercialFirstFloorArea: num(cols[6]),
    };
  });
}

export const LOTS: Lot[] = parseLotsCsv(plotsCsv);

export function getLotById(id: number): Lot | undefined {
  return LOTS.find((lot) => lot.id === id);
}
