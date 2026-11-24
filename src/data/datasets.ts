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

/** השמות (hash) של הצדדים שתואמים ישירות ל-hash, בכל הגרסאות. */
function matchedNames(all: OwnersByVersion, hash: string): Set<string> {
  const person = new Set([hash]);
  const names = new Set<string>();
  for (const owners of Object.values(all)) {
    for (const h of owners) {
      for (const side of matchedSides(h, person)) {
        const name = side === 'owner' ? h.nameHash : h.altNameHash;
        if (name) names.add(name);
      }
    }
  }
  return names;
}

/**
 * כל ה-hashes שמזהים את האדם: ה-hashes שחופשו, ובנוסף קישורים בין שם לת.ז. של הצד שתאם
 * (בכל הגרסאות) — כך שורות שבהן השם נכתב אחרת, או שבהן חסרה ת.ז., מקושרות לאותו אדם:
 *  * חיפוש שתואם ת.ז. אחת בדיוק → מוסיפים את הת.ז.
 *  * שם של צד שתאם, שתואם לכל היותר ת.ז. אחת → מוסיפים את השם.
 * שם עמום (כמה ת.ז.) אינו מקושר לשום כיוון, כדי לא למשוך זכויות של אדם אחר באותו שם.
 * רק הצד שתאם (בעלים או חוכר) מקושר — לא הצד השני באותה שורה.
 */
function personHashes(all: OwnersByVersion, hashes: string[]): Set<string> {
  const person = new Set(hashes.filter(Boolean));
  for (const hash of [...person]) {
    const ids = matchedIds(all, hash);
    if (ids.size !== 1) continue;
    const [id] = ids;
    person.add(id);
    for (const name of matchedNames(all, id)) {
      if (matchedIds(all, name).size === 1) person.add(name);
    }
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
 * האם הוספת בעלים (לפי ה-hash שחופש) לא תוסיף אף זכות חדשה — כלומר בכל גרסה, כל השורות
 * שלו כבר כלולות בבעלים שנוספו. כך נמנעת הוספה כפולה של אותו אדם (לפי שם ואז לפי ת.ז.),
 * ועדיין אפשר להוסיף אדם אחר באותו שם, או חוכר נוסף של אותו בעלים.
 */
export function isDuplicateIn(all: OwnersByVersion, existing: string[], hash: string): boolean {
  if (existing.length === 0) return false;
  let any = false;
  for (const version of Object.keys(all) as VersionId[]) {
    const added = new Set(resolveManyIn(all, version, existing));
    for (const row of resolveManyIn(all, version, [hash])) {
      any = true;
      if (!added.has(row)) return false;
    }
  }
  return any;
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

/** האם ה-hash תואם לכמה בעלים שונים (ראו isAmbiguousIn). */
export function isAmbiguous(hash: string): boolean {
  return isAmbiguousIn(ALL_OWNERS, hash);
}

/** שורות החישוב של כמה בעלים יחד בגרסה נתונה — משמש את טבלת התוצאות ואת כרטיס ההשוואה. */
export function ownerRows(version: VersionId, hashes: string[]) {
  return computeRows(DATASETS[version], holdingsToRows(resolveOwners(version, hashes)));
}
