// שתי גרסאות של טבלאות האיזון וההקצאה. כל גרסה: מגרשים + החזקות (hashes) + קישורי מקור.
import v1PlotsCsv from '../../public/data/v1/plots.csv?raw';
import v1OwnersCsv from '../../public/data/v1/owners.csv?raw';
import v2PlotsCsv from '../../public/data/v2/plots.csv?raw';
import v2OwnersCsv from '../../public/data/v2/owners.csv?raw';
import { parseLotsCsv, type Lot } from './lots';
import { findHoldings, parseOwnersCsv, type OwnerHolding } from './owners';

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

/**
 * כל ה-hashes שמזהים את האדם: ה-hashes שחופשו, ובנוסף ה-hash של מס׳ הזהות של כל צד
 * שתאם להם — בכל הגרסאות. כך שורות שבהן השם נכתב אחרת (באותה גרסה או בגרסה אחרת)
 * מקושרות דרך ת.ז. רק ת.ז. של הצד שתאם נוספת — לא של הצד השני באותה שורה.
 */
function personHashes(all: OwnersByVersion, hashes: string[]): Set<string> {
  const person = new Set(hashes.filter(Boolean));
  if (person.size === 0) return person;
  const linked: string[] = [];
  for (const owners of Object.values(all)) {
    for (const h of owners) {
      for (const side of matchedSides(h, person)) {
        const id = side === 'owner' ? h.idHash : h.altIdHash;
        if (id) linked.push(id);
      }
    }
  }
  for (const id of linked) person.add(id);
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

/** מזהי האדם בכל הגרסאות (ראו identityKeysIn). */
export function identityKeys(hash: string): string[] {
  return identityKeysIn(ALL_OWNERS, hash);
}
