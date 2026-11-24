// נתוני הבעלים של כל גרסה נמצאים ב-public/data/<version>/owners.csv (חילוץ אנונימי של named_tables.pdf).
// לפרטיות, הקובץ מכיל רק hashes (SHA-256) של שם הבעלים ומספר הזהות — אין PII גלוי.
import { parseCsv } from '../lib/csvParse';

/**
 * החזקה בודדת: hashes של שם ות.ז. הבעלים, hashes של שם ות.ז. החוכר (אם יש; אחרת ''),
 * מס׳ מגרש ושבר הזכות.
 */
export interface OwnerHolding {
  nameHash: string;
  idHash: string;
  altNameHash: string;
  altIdHash: string;
  plotId: string;
  fraction: string;
}

/**
 * מפענח את תוכן owners.csv לרשימת החזקות. שני פורמטים נתמכים:
 * v1 — nameHash, idHash, plotId, fraction
 * v2 — nameHash, idHash, altNameHash, altIdHash, plotId, fraction
 */
export function parseOwnersCsv(csv: string): OwnerHolding[] {
  const [header, ...rows] = parseCsv(csv);
  const withAlt = header.length >= 6;
  return rows.map((cols) => {
    const c = cols.map((v) => v.trim());
    return withAlt
      ? {
          nameHash: c[0],
          idHash: c[1],
          altNameHash: c[2],
          altIdHash: c[3],
          plotId: c[4],
          fraction: c[5],
        }
      : {
          nameHash: c[0],
          idHash: c[1],
          altNameHash: '',
          altIdHash: '',
          plotId: c[2],
          fraction: c[3],
        };
  });
}

/** האם ההחזקה שייכת ל-hash נתון (שם/ת.ז. של הבעלים או של החוכר). */
export function holdingMatches(o: OwnerHolding, hash: string): boolean {
  return o.nameHash === hash || o.idHash === hash || o.altNameHash === hash || o.altIdHash === hash;
}

/** כל ההחזקות התואמות ל-hash נתון. hash ריק אינו מתאים לשום דבר. */
export function findHoldings(owners: OwnerHolding[], hash: string): OwnerHolding[] {
  if (!hash) return [];
  return owners.filter((o) => holdingMatches(o, hash));
}
