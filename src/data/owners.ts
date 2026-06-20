// מקור האמת לנתוני הבעלים הוא קובץ owners.csv (חילוץ אנונימי של named_tables.pdf).
// לפרטיות, הקובץ מכיל רק hashes (SHA-256) של שם הבעלים ומספר הזהות — אין PII גלוי.
// הקובץ נטען כאן בזמן build ומפוענח ל-OWNERS.
import ownersCsv from '../../public/owners.csv?raw';

/** החזקה בודדת: hash של שם + hash של ת.ז., מס׳ מגרש, ושבר הזכות. */
export interface OwnerHolding {
  nameHash: string;
  idHash: string;
  plotId: number;
  fraction: string;
}

/** מפענח את תוכן owners.csv לרשימת החזקות. עמודות: nameHash, idHash, plotId, fraction. */
export function parseOwnersCsv(csv: string): OwnerHolding[] {
  const lines = csv
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  // דילוג על שורת הכותרת
  return lines.slice(1).map((line) => {
    const cols = line.split(',');
    return {
      nameHash: cols[0].trim(),
      idHash: cols[1].trim(),
      plotId: Number(cols[2].trim()),
      fraction: cols[3].trim(),
    };
  });
}

export const OWNERS: OwnerHolding[] = parseOwnersCsv(ownersCsv);

/** כל ההחזקות התואמות ל-hash נתון (של שם או של ת.ז.). */
export function getHoldingsByHash(hash: string): OwnerHolding[] {
  if (!hash) return [];
  return OWNERS.filter((o) => o.nameHash === hash || o.idHash === hash);
}
