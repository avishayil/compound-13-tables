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

const sideName = (e: Entry) => (e.side === 'owner' ? e.row.nameHash : e.row.altNameHash);

/**
 * האדם שה-hashes מזהים: ה-hashes עצמם, ובנוסף קישורים בין שם לת.ז. של הצד שתאם (בכל
 * הגרסאות), כך שחיפוש לפי שם ולפי ת.ז. של אותו אדם מגיע לאותן שורות:
 *  * hash שתואם מספר זהות אחד בדיוק → מוסיפים את הת.ז. (שורות שבהן השם נכתב אחרת).
 *  * השמות של הצדדים עם הת.ז., כל עוד השם חד-משמעי (ת.ז. אחת בלבד) → מוסיפים את השם
 *    (שורות שבהן השם מופיע בלי ת.ז.; מסומן כהשלמה, ראו hasInferredRowsIn).
 * שם עמום (כמה ת.ז.) אינו מקושר כלל, ורק הצד שתאם (בעלים/חוכר) מקושר — לא הצד השני בשורה.
 */
function resolvePerson(
  all: OwnersByVersion,
  hashes: string[],
): { hashes: Set<string>; linkedNames: Set<string> } {
  const person = new Set(hashes.filter(Boolean));
  const linkedNames = new Set<string>();
  const index = indexOf(all);
  for (const hash of [...person]) {
    const ids = matchedIds(all, hash);
    if (ids.size !== 1) continue;
    const [id] = ids;
    person.add(id);
    for (const e of index.get(id) ?? []) {
      const name = sideName(e);
      if (name && !person.has(name) && matchedIds(all, name).size === 1) {
        person.add(name);
        linkedNames.add(name);
      }
    }
  }
  return { hashes: person, linkedNames };
}

/** הצדדים (שורה + צד) של האדם בגרסה. */
function entriesOf(all: OwnersByVersion, version: VersionId, hashes: string[]): Map<string, Entry> {
  const index = indexOf(all);
  const out = new Map<string, Entry>();
  for (const hash of resolvePerson(all, hashes).hashes) {
    for (const e of index.get(hash) ?? []) {
      if (e.version === version) out.set(e.key, e);
    }
  }
  return out;
}

/** השורות של האדם בגרסה, כקבוצה (ללא כפילות שורות). */
function rowSet(all: OwnersByVersion, version: VersionId, hashes: string[]): Set<OwnerHolding> {
  return new Set([...entriesOf(all, version, hashes).values()].map((e) => e.row));
}

/**
 * האם החיפוש כולל שורות שקושרו רק לפי שם, בלי מספר זהות (למשל חיפוש לפי ת.ז. שמצא גם
 * שורות של אותו שם שבהן הת.ז. חסרה). מוצג למשתמש כדי שיוכל לבדוק שהן אכן שלו.
 */
export function hasInferredRowsIn(all: OwnersByVersion, hash: string): boolean {
  const index = indexOf(all);
  for (const name of resolvePerson(all, [hash]).linkedNames) {
    if ((index.get(name) ?? []).some((e) => !sideId(e))) return true;
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
 * האם הבעלים כבר נוסף: כל הצדדים (שורה + בעלים/חוכר) שלו, בכל הגרסאות, כבר שייכים לבעלים
 * אחד שברשימה — למשל אותו אדם שנוסף פעם לפי שם ופעם לפי ת.ז. חוכר באותה שורה של בעלים
 * שנוסף הוא צד אחר ולכן אינו כפול (השורה עדיין נספרת פעם אחת).
 */
export function isDuplicateIn(all: OwnersByVersion, existing: string[], hash: string): boolean {
  const versions = Object.keys(all) as VersionId[];
  const keysOf = (hashes: string[]) =>
    new Set(versions.flatMap((v) => [...entriesOf(all, v, hashes).keys()]));
  const candidate = keysOf([hash]);
  if (candidate.size === 0) return false;
  return existing.some((other) => {
    const known = keysOf([other]);
    return [...candidate].every((k) => known.has(k));
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

/** ראו hasInferredRowsIn. */
export function hasInferredRows(hash: string): boolean {
  return hasInferredRowsIn(ALL_OWNERS, hash);
}

/** האם ה-hash תואם לכמה בעלים שונים (ראו isAmbiguousIn). */
export function isAmbiguous(hash: string): boolean {
  return isAmbiguousIn(ALL_OWNERS, hash);
}

/** שורות החישוב של כמה בעלים יחד בגרסה נתונה — משמש את טבלת התוצאות ואת כרטיס ההשוואה. */
export function ownerRows(version: VersionId, hashes: string[]) {
  return computeRows(DATASETS[version], holdingsToRows(resolveOwners(version, hashes)));
}
