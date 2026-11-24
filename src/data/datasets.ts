// שתי גרסאות של טבלאות האיזון וההקצאה. כל גרסה: מגרשים + החזקות (hashes) + קישורי מקור.
import v1PlotsCsv from '../../public/data/v1/plots.csv?raw';
import v1OwnersCsv from '../../public/data/v1/owners.csv?raw';
import v2PlotsCsv from '../../public/data/v2/plots.csv?raw';
import v2OwnersCsv from '../../public/data/v2/owners.csv?raw';
import { parseLotsCsv, type Lot } from './lots';
import { findHoldings, parseOwnersCsv, type OwnerHolding } from './owners';
import { computeRows, holdingsToRows } from '../lib/rows';

export type VersionId = 'v1' | 'v2';

export interface Dataset {
  id: VersionId;
  /** תווית מלאה לתצוגה */
  label: string;
  /** תווית קצרה (לכותרות עמודות בהשוואה) */
  shortLabel: string;
  lots: Lot[];
  owners: OwnerHolding[];
  getLot(id: string): Lot | undefined;
  getHoldingsByHash(hash: string): OwnerHolding[];
  /** הסבר לעמודת המסחר בגרסה הזו (מה נכלל ב"סה״כ מסחר ותעסוקה") */
  commercialNote: string;
  /** נתיבי קבצי המקור תחת public/ (יחסית ל-BASE_URL) */
  sources: { plotsPdf: string; plotsCsv: string };
}

function makeDataset(
  meta: Omit<Dataset, 'lots' | 'owners' | 'getLot' | 'getHoldingsByHash'>,
  plotsCsv: string,
  ownersCsv: string,
): Dataset {
  const lots = parseLotsCsv(plotsCsv);
  const owners = parseOwnersCsv(ownersCsv);
  const byId = new Map(lots.map((lot) => [lot.id, lot]));
  return {
    ...meta,
    lots,
    owners,
    getLot: (id) => byId.get(id),
    getHoldingsByHash: (hash) => findHoldings(owners, hash),
  };
}

export const DATASETS: Record<VersionId, Dataset> = {
  v1: makeDataset(
    {
      id: 'v1',
      label: 'מופקדת (יוני 2026)',
      shortLabel: 'מופקדת',
      commercialNote: 'מסחר בקומת הקרקע + מסחר בקומה הראשונה שמעל קומת הקרקע.',
      sources: { plotsPdf: 'data/v1/plots.pdf', plotsCsv: 'data/v1/plots.csv' },
    },
    v1PlotsCsv,
    v1OwnersCsv,
  ),
  v2: makeDataset(
    {
      id: 'v2',
      label: 'עדכון לפי סעיף 106(ב) (נובמבר 2026)',
      shortLabel: '106(ב)',
      commercialNote:
        'שטח עיקרי למסחר בקומת הקרקע + שטח ברוטו למשרדים/מסחר בקומות העליונות (כפי שמופיע בטבלת השמאי).',
      sources: { plotsPdf: 'data/v2/plots.pdf', plotsCsv: 'data/v2/plots.csv' },
    },
    v2PlotsCsv,
    v2OwnersCsv,
  ),
};

/** סדר הגרסאות לתצוגה: העדכנית קודם. */
export const VERSION_IDS: VersionId[] = ['v2', 'v1'];

export const DEFAULT_VERSION: VersionId = 'v2';

export type OwnersByVersion = Record<VersionId, OwnerHolding[]>;

const ALL_OWNERS: OwnersByVersion = { v1: DATASETS.v1.owners, v2: DATASETS.v2.owners };

/** הצדדים בשורה (בעלים / חוכר) שמזוהים ע״י אחד ה-hashes של האדם. */
function matchedSides(h: OwnerHolding, person: Set<string>): ('owner' | 'lessee')[] {
  const sides: ('owner' | 'lessee')[] = [];
  if (person.has(h.nameHash) || person.has(h.idHash)) sides.push('owner');
  if (person.has(h.altNameHash) || person.has(h.altIdHash)) sides.push('lessee');
  return sides;
}

/** מספרי הזהות (hash) של הצדדים שתואמים ישירות ל-hash, בכל הגרסאות. */
function matchedIds(all: OwnersByVersion, hash: string): Set<string> {
  const person = new Set([hash]);
  const ids = new Set<string>();
  for (const owners of Object.values(all)) {
    for (const h of owners) {
      for (const side of matchedSides(h, person)) {
        const id = side === 'owner' ? h.idHash : h.altIdHash;
        if (id) ids.add(id);
      }
    }
  }
  return ids;
}

/**
 * האם ה-hash (בדרך כלל של שם) תואם לצדדים עם יותר ממספר זהות אחד — כלומר כמה בעלים
 * שונים באותו שם (או אותו אדם שנרשם עם ת.ז. שונה בין הגרסאות).
 */
export function isAmbiguousIn(all: OwnersByVersion, hash: string): boolean {
  return hash !== '' && matchedIds(all, hash).size > 1;
}

/**
 * כל ה-hashes שמזהים את האדם: ה-hashes שחופשו, ובנוסף — כשה-hash חד-משמעי (תואם ת.ז. אחת
 * לכל היותר) — ה-hash של מספר הזהות של הצד שתאם, בכל הגרסאות. כך שורות שבהן השם נכתב אחרת
 * (באותה גרסה או בגרסה אחרת) מקושרות דרך ת.ז. רק ת.ז. של הצד שתאם נוספת — לא של הצד השני
 * באותה שורה. שם עמום (כמה בעלים באותו שם) אינו מקושר, כדי לא למשוך זכויות של אדם אחר.
 */
function personHashes(all: OwnersByVersion, hashes: string[]): Set<string> {
  const person = new Set(hashes.filter(Boolean));
  for (const hash of [...person]) {
    const ids = matchedIds(all, hash);
    if (ids.size === 1) person.add([...ids][0]);
  }
  return person;
}

/**
 * ההחזקות של כמה בעלים יחד בגרסה נתונה. כל שורה בטבלה מופיעה לכל היותר פעם אחת — גם אם
 * גם הבעלים וגם החוכר שלה נוספו — ושורות כפולות לגיטימיות (רישומים נפרדים) נשמרות.
 */
export function resolveManyIn(
  all: OwnersByVersion,
  version: VersionId,
  hashes: string[],
): OwnerHolding[] {
  const person = personHashes(all, hashes);
  if (person.size === 0) return [];
  return all[version].filter((h) => matchedSides(h, person).length > 0);
}

/**
 * מזהי האדם בכל הגרסאות (ת.ז. של הצד שתאם, או שם אם אין ת.ז.) — למניעת הוספה כפולה של
 * אותו אדם, גם אם נוסף פעם לפי שם ופעם לפי ת.ז. חוכרים שונים של אותו בעלים מקבלים מזהים שונים.
 */
export function identityKeysIn(all: OwnersByVersion, hash: string): string[] {
  const person = personHashes(all, [hash]);
  const keys = new Set<string>();
  for (const owners of Object.values(all)) {
    for (const h of owners) {
      for (const side of matchedSides(h, person)) {
        keys.add(side === 'owner' ? h.idHash || h.nameHash : h.altIdHash || h.altNameHash);
      }
    }
  }
  return [...keys].sort();
}

/** ההחזקות של בעלים יחיד בגרסה נתונה (כולל קישור דרך ת.ז. בין גרסאות). */
export function resolveHoldings(version: VersionId, hash: string): OwnerHolding[] {
  return resolveManyIn(ALL_OWNERS, version, [hash]);
}

/** ההחזקות של כמה בעלים יחד בגרסה נתונה, ללא כפילות שורות. */
export function resolveOwners(version: VersionId, hashes: string[]): OwnerHolding[] {
  return resolveManyIn(ALL_OWNERS, version, hashes);
}

/**
 * האם בעלים חדש (לפי מזהיו) כבר נוסף: רק אם כל המזהים שלו כבר קיימים — כלומר ההוספה לא
 * הייתה מוסיפה אף אדם חדש. כך שם עמום שכולל גם אדם שכבר נוסף עדיין ניתן להוספה.
 */
export function isDuplicateOwner(existing: string[][], keys: string[]): boolean {
  const known = new Set(existing.flat());
  return keys.length > 0 && keys.every((k) => known.has(k));
}

/** האם ה-hash תואם לכמה בעלים שונים (ראו isAmbiguousIn). */
export function isAmbiguous(hash: string): boolean {
  return isAmbiguousIn(ALL_OWNERS, hash);
}

/** שורות החישוב של כמה בעלים יחד בגרסה נתונה — משמש את טבלת התוצאות ואת כרטיס ההשוואה. */
export function ownerRows(version: VersionId, hashes: string[]) {
  return computeRows(DATASETS[version], holdingsToRows(resolveOwners(version, hashes)));
}

/** מזהי האדם בכל הגרסאות (ראו identityKeysIn). */
export function identityKeys(hash: string): string[] {
  return identityKeysIn(ALL_OWNERS, hash);
}
