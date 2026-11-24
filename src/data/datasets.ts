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

type Side = 'owner' | 'lessee';

/** אינדקס: hash (שם או ת.ז., של בעלים או חוכר) → השורות והצד שבו הוא מופיע, לכל גרסה. */
interface Entry {
  version: VersionId;
  row: OwnerHolding;
  side: Side;
  /** מזהה יציב של "צד בשורה" (גרסה + מיקום השורה + צד) — אדם = קבוצה של צדדים */
  key: string;
}

const indexCache = new WeakMap<OwnersByVersion, Map<string, Entry[]>>();

function indexOf(all: OwnersByVersion): Map<string, Entry[]> {
  const cached = indexCache.get(all);
  if (cached) return cached;
  const index = new Map<string, Entry[]>();
  const add = (hash: string, entry: Entry) => {
    if (!hash) return;
    const list = index.get(hash);
    if (list) {
      // אותה שורה ואותו צד פעם אחת (למשל אם שם ות.ז. זהים)
      if (!list.some((e) => e.key === entry.key)) list.push(entry);
    } else index.set(hash, [entry]);
  };
  for (const version of Object.keys(all) as VersionId[]) {
    all[version].forEach((row, i) => {
      const owner = { version, row, side: 'owner' as const, key: `${version}:${i}:o` };
      const lessee = { version, row, side: 'lessee' as const, key: `${version}:${i}:l` };
      add(row.nameHash, owner);
      add(row.idHash, owner);
      add(row.altNameHash, lessee);
      add(row.altIdHash, lessee);
    });
  }
  indexCache.set(all, index);
  return index;
}

const sideId = (e: Entry) => (e.side === 'owner' ? e.row.idHash : e.row.altIdHash);

/** מספרי הזהות (hash) של הצדדים שתואמים ישירות ל-hash, בכל הגרסאות. */
function matchedIds(all: OwnersByVersion, hash: string): Set<string> {
  const ids = new Set<string>();
  for (const e of indexOf(all).get(hash) ?? []) {
    const id = sideId(e);
    if (id) ids.add(id);
  }
  return ids;
}

/**
 * האם ה-hash (בדרך כלל של שם) תואם לצדדים עם יותר ממספר זהות אחד — כמה בעלים שונים באותו
 * שם, או אותו אדם שנרשם עם ת.ז. שונה בין הגרסאות.
 */
export function isAmbiguousIn(all: OwnersByVersion, hash: string): boolean {
  return hash !== '' && matchedIds(all, hash).size > 1;
}

/**
 * כל ה-hashes שמזהים את האדם: ה-hashes שחופשו, ובנוסף — כשה-hash תואם מספר זהות אחד בדיוק —
 * ה-hash של מספר הזהות הזה (של הצד שתאם בלבד, לא של הצד השני בשורה). כך חיפוש לפי שם מוצא
 * גם שורות שבהן השם נכתב אחרת אך הת.ז. זהה.
 *
 * החלטה מכוונת: אין קישור מת.ז. לשם. שורות בלי ת.ז. באותו שם עשויות להיות של אדם אחר (למשל
 * הורה ויורש באותו שם), ולכן חיפוש לפי ת.ז. מחזיר רק שורות עם הת.ז. — לעולם לא זכויות של מישהו
 * אחר. המחיר: שם ות.ז. של אותו אדם עשויים להיראות כשני בעלים ברשימה; הסכום נשאר נכון כי כל
 * שורה נספרת פעם אחת. שם עמום (כמה ת.ז.) אינו מקושר כלל.
 */
function personHashes(all: OwnersByVersion, hashes: string[]): Set<string> {
  const person = new Set(hashes.filter(Boolean));
  for (const hash of [...person]) {
    const ids = matchedIds(all, hash);
    if (ids.size === 1) person.add([...ids][0]);
  }
  return person;
}

/** כל הצדדים (שורה + בעלים/חוכר) של האדם, בכל הגרסאות. */
function allEntries(all: OwnersByVersion, hashes: string[]): Map<string, Entry> {
  const index = indexOf(all);
  const out = new Map<string, Entry>();
  for (const hash of personHashes(all, hashes)) {
    for (const e of index.get(hash) ?? []) out.set(e.key, e);
  }
  return out;
}

/** השורות של האדם בגרסה, כקבוצה (ללא כפילות שורות). */
function rowSet(all: OwnersByVersion, version: VersionId, hashes: string[]): Set<OwnerHolding> {
  const rows = new Set<OwnerHolding>();
  for (const e of allEntries(all, hashes).values()) if (e.version === version) rows.add(e.row);
  return rows;
}

/**
 * האם בטבלאות יש שורות בשם של האדם (של צד שתאם) בלי מספר זהות, שלא נכללו בחיפוש — למשל חיפוש
 * לפי ת.ז. כשבגרסה אחרת השם רשום בלי ת.ז. השורות האלה אינן נכללות אוטומטית (ייתכן שהן של אדם
 * אחר באותו שם), ולכן המשתמש מקבל הודעה שיוכל להוסיף אותן בחיפוש לפי השם.
 */
export function hasExcludedNameRowsIn(all: OwnersByVersion, hash: string): boolean {
  const index = indexOf(all);
  const included = allEntries(all, [hash]);
  const names = new Set(
    [...included.values()].map((e) => (e.side === 'owner' ? e.row.nameHash : e.row.altNameHash)),
  );
  for (const name of names) {
    for (const e of index.get(name) ?? []) {
      if (!sideId(e) && !included.has(e.key)) return true;
    }
  }
  return false;
}

/**
 * ההחזקות של כמה בעלים יחד בגרסה נתונה, בסדר הטבלה. כל שורה מופיעה לכל היותר פעם אחת — גם
 * אם גם הבעלים וגם החוכר שלה נוספו — ושורות כפולות לגיטימיות (רישומים נפרדים) נשמרות.
 */
export function resolveManyIn(
  all: OwnersByVersion,
  version: VersionId,
  hashes: string[],
): OwnerHolding[] {
  const rows = rowSet(all, version, hashes);
  if (rows.size === 0) return [];
  return all[version].filter((h) => rows.has(h));
}

/**
 * האם הבעלים כבר נוסף: יש בעלים ברשימה שמתייחס בדיוק לאותם צדדים (שורה + בעלים/חוכר) בכל
 * הגרסאות — למשל אותו hash שוב, או שם ות.ז. של אותו אדם. חוכר באותה שורה של בעלים שנוסף,
 * או בעל שם זהה (ת.ז. אחרת), אינם כפולים; שורות משותפות ממילא נספרות פעם אחת.
 */
export function isDuplicateIn(all: OwnersByVersion, existing: string[], hash: string): boolean {
  const candidate = allEntries(all, [hash]);
  if (candidate.size === 0) return false;
  return existing.some((other) => {
    const known = allEntries(all, [other]);
    return known.size === candidate.size && [...candidate.keys()].every((k) => known.has(k));
  });
}

/** ההחזקות של בעלים יחיד בגרסה נתונה (כולל קישור דרך ת.ז. בין גרסאות). */
export function resolveHoldings(version: VersionId, hash: string): OwnerHolding[] {
  return resolveManyIn(ALL_OWNERS, version, [hash]);
}

/** ההחזקות של כמה בעלים יחד בגרסה נתונה, ללא כפילות שורות. */
export function resolveOwners(version: VersionId, hashes: string[]): OwnerHolding[] {
  return resolveManyIn(ALL_OWNERS, version, hashes);
}

/** ראו isDuplicateIn. */
export function isDuplicate(existing: string[], hash: string): boolean {
  return isDuplicateIn(ALL_OWNERS, existing, hash);
}

/** האם ל-hash יש החזקות באחת הגרסאות לפחות. */
export function isFound(hash: string): boolean {
  return VERSION_IDS.some((v) => resolveHoldings(v, hash).length > 0);
}

/** ראו hasExcludedNameRowsIn. */
export function hasExcludedNameRows(hash: string): boolean {
  return hasExcludedNameRowsIn(ALL_OWNERS, hash);
}

/** האם ה-hash תואם לכמה בעלים שונים (ראו isAmbiguousIn). */
export function isAmbiguous(hash: string): boolean {
  return isAmbiguousIn(ALL_OWNERS, hash);
}

/** שורות החישוב של כמה בעלים יחד בגרסה נתונה — משמש את טבלת התוצאות ואת כרטיס ההשוואה. */
export function ownerRows(version: VersionId, hashes: string[]) {
  return computeRows(DATASETS[version], holdingsToRows(resolveOwners(version, hashes)));
}
