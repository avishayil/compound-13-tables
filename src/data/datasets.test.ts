import { describe, it, expect } from 'vitest';
import {
  DATASETS,
  isAmbiguousIn,
  isDuplicateIn,
  ownerRows,
  resolveHoldings,
  resolveManyIn,
  type OwnersByVersion,
} from './datasets';
import type { OwnerHolding } from './owners';

const h = (
  nameHash: string,
  idHash: string,
  plotId: string,
  fraction: string,
  altNameHash = '',
  altIdHash = '',
): OwnerHolding => ({ nameHash, idHash, altNameHash, altIdHash, plotId, fraction });

describe('resolveManyIn — אוסף ההחזקות של כמה בעלים', () => {
  it('שורה שבה אחד הבעלים והשני חוכר נספרת פעם אחת בלבד', () => {
    const row = h('owner', 'oid', '40A', '1/2', 'lessee', 'lid');
    const all: OwnersByVersion = { v1: [], v2: [row, h('x', 'xid', '41', '1/1')] };
    expect(resolveManyIn(all, 'v2', ['owner', 'lessee'])).toEqual([row]);
  });

  it('שומר שורות כפולות לגיטימיות של אותו בעלים', () => {
    const a = h('n', 'i', '150', '1/10');
    const b = h('n', 'i', '150', '1/10');
    const all: OwnersByVersion = { v1: [], v2: [a, b] };
    expect(resolveManyIn(all, 'v2', ['n'])).toHaveLength(2);
  });

  it('ממזג התאמה ישירה עם שורות שמקושרות דרך ת.ז. (כתיב שם שונה באותה גרסה)', () => {
    const all: OwnersByVersion = {
      v1: [h('N', 'ID', '44', '1/250')],
      v2: [h('N', 'ID', '41', '1/10'), h('N-variant', 'ID', '107', '1/10')],
    };
    expect(resolveManyIn(all, 'v2', ['N']).map((x) => x.plotId)).toEqual(['41', '107']);
  });

  it('מקשר דרך ת.ז. מהגרסה האחרת כשהשם לא קיים בגרסה המבוקשת', () => {
    const all: OwnersByVersion = {
      v1: [h('N', 'ID', '44', '1/250')],
      v2: [h('N2', 'ID', '41', '1/10')],
    };
    expect(resolveManyIn(all, 'v2', ['N']).map((x) => x.plotId)).toEqual(['41']);
  });

  it('לא מקשר דרך ת.ז. של הצד השני בשורה (בעלים מול חוכר)', () => {
    // מחפשים את החוכר: אסור לקשר דרך ת.ז. הבעלים ולמשוך שורות של חוכרים אחרים שלו
    const all: OwnersByVersion = {
      v1: [],
      v2: [
        h('owner', 'oid', '111', '1/2', 'lesseeA', 'aid'),
        h('owner', 'oid', '111', '1/2', 'lesseeB', 'bid'),
      ],
    };
    expect(resolveManyIn(all, 'v2', ['lesseeA']).map((x) => x.altNameHash)).toEqual(['lesseeA']);
  });

  it('hash ריק או לא קיים לא מחזיר דבר', () => {
    const all: OwnersByVersion = { v1: [h('n', '', '1', '1/1')], v2: [] };
    expect(resolveManyIn(all, 'v1', [''])).toEqual([]);
    expect(resolveManyIn(all, 'v1', ['missing'])).toEqual([]);
  });
});

describe('שמות זהים לבעלים שונים (הומונימים)', () => {
  // N הוא ID1 במופקדת; ב-106(ב) N הוא אדם אחר (ID2), ו-ID1 מופיע תחת כתיב אחר
  const all: OwnersByVersion = {
    v1: [h('N', 'ID1', '44', '1/250')],
    v2: [h('N', 'ID2', '41', '1/10'), h('N-variant', 'ID1', '107', '1/10')],
  };

  it('שם שתואם לכמה ת.ז. מסומן כעמום', () => {
    expect(isAmbiguousIn(all, 'N')).toBe(true);
    expect(isAmbiguousIn(all, 'ID1')).toBe(false);
    expect(isAmbiguousIn(all, 'N-variant')).toBe(false);
  });

  it('לשם עמום אין קישור דרך ת.ז. — רק התאמות ישירות', () => {
    expect(resolveManyIn(all, 'v2', ['N']).map((x) => x.plotId)).toEqual(['41']);
    expect(resolveManyIn(all, 'v1', ['N']).map((x) => x.plotId)).toEqual(['44']);
  });

  it('אחרי הוספת שם עמום אפשר להוסיף לפי ת.ז. את אחד מבעלי השם (שורות נוספות שלו)', () => {
    expect(isDuplicateIn(all, ['N'], 'ID1')).toBe(false);
  });

  it('אחרי הוספה לפי ת.ז. אפשר להוסיף שם עמום (כולל בעלים נוסף)', () => {
    expect(isDuplicateIn(all, ['ID1'], 'N')).toBe(false);
  });
});

describe('isDuplicateIn — לפי הזכויות שהבעלים מוסיף בפועל', () => {
  it('אותו אדם לפי שם ואז לפי ת.ז. — כפול', () => {
    const all: OwnersByVersion = { v1: [], v2: [h('N', 'ID', '41', '1/10')] };
    expect(isDuplicateIn(all, ['N'], 'ID')).toBe(true);
    expect(isDuplicateIn(all, ['ID'], 'N')).toBe(true);
  });

  it('ת.ז. אינה מושכת שורות של אותו שם בלי ת.ז. (ייתכן שהן של אדם אחר)', () => {
    const all: OwnersByVersion = {
      v1: [h('X', '', '44', '1/250')],
      v2: [h('X', 'IDX', '41', '1/10')],
    };
    expect(resolveManyIn(all, 'v1', ['IDX'])).toEqual([]);
    // השם מוסיף שורה שהת.ז. לא כללה — ולכן אינו כפול
    expect(isDuplicateIn(all, ['IDX'], 'X')).toBe(false);
  });

  it('שני חוכרים של אותו בעלים ללא ת.ז. אינם כפולים זה לזה', () => {
    const all: OwnersByVersion = {
      v1: [],
      v2: [
        h('owner', '', '111', '1/2', 'lesseeA', 'aid'),
        h('owner', '', '112', '1/2', 'lesseeB', ''),
      ],
    };
    expect(isDuplicateIn(all, ['lesseeA'], 'lesseeB')).toBe(false);
    expect(isDuplicateIn(all, ['lesseeA'], 'owner')).toBe(false);
    // החוכר הוא אדם אחר מהבעלים — אפשר להוסיף אותו (השורה לא תיספר פעמיים)
    expect(isDuplicateIn(all, ['owner'], 'lesseeA')).toBe(false);
  });

  it('הוספה חוזרת של אותו hash — כפולה', () => {
    const all: OwnersByVersion = { v1: [], v2: [h('N', 'ID', '41', '1/10')] };
    expect(isDuplicateIn(all, ['N'], 'N')).toBe(true);
  });

  it('רשימה ריקה — לא כפול', () => {
    const all: OwnersByVersion = { v1: [], v2: [h('N', 'ID', '41', '1/10')] };
    expect(isDuplicateIn(all, [], 'N')).toBe(false);
  });
});

describe('נתונים אמיתיים — חוכרים ב-v2', () => {
  // בעלים ללא ת.ז. שלקרקע שלו לפחות שני חוכרים שונים
  const lesseeRows = DATASETS.v2.owners.filter((o) => o.altNameHash && !o.idHash);
  const byOwner = new Map<string, OwnerHolding[]>();
  for (const o of lesseeRows) byOwner.set(o.nameHash, [...(byOwner.get(o.nameHash) ?? []), o]);
  const [owner, rows] =
    [...byOwner].find(([, list]) => new Set(list.map((o) => o.altNameHash)).size >= 2) ?? [];
  const rowA = rows?.[0];
  const rowB = rows?.find((o) => o.altNameHash !== rowA?.altNameHash);
  const all: OwnersByVersion = { v1: DATASETS.v1.owners, v2: DATASETS.v2.owners };

  it('קיים בנתונים בעלים ללא ת.ז. עם שני חוכרים לפחות (fixture)', () => {
    expect(owner).toBeDefined();
    expect(rowB).toBeDefined();
  });

  it('שני חוכרים שונים של אותו בעלים אינם נחשבים כפולים', () => {
    expect(isDuplicateIn(all, [rowA!.altNameHash], rowB!.altNameHash)).toBe(false);
  });

  it('הוספת הבעלים והחוכר של אותה שורה לא מכפילה את הזכויות בחישוב', () => {
    const lesseeOnly = ownerRows('v2', [rowA!.altNameHash]).computed;
    const both = ownerRows('v2', [owner!, rowA!.altNameHash]).computed;
    const rowOf = (list: typeof both) =>
      list.find((r) => r.lot.id === rowA!.plotId && r.shareInput === rowA!.fraction);
    expect(rowOf(lesseeOnly)?.quantity).toBe(
      DATASETS.v2.owners.filter(
        (o) =>
          o.altNameHash === rowA!.altNameHash &&
          o.plotId === rowA!.plotId &&
          o.fraction === rowA!.fraction,
      ).length,
    );
    // השורה של החוכר נספרת פעם אחת גם כשגם הבעלים נוסף
    const ownerAndLesseeRows = DATASETS.v2.owners.filter(
      (o) =>
        (o.nameHash === owner || o.altNameHash === rowA!.altNameHash) &&
        o.plotId === rowA!.plotId &&
        o.fraction === rowA!.fraction,
    ).length;
    expect(rowOf(both)?.quantity).toBe(ownerAndLesseeRows);
  });

  it('resolveHoldings לחוכר מחזיר בדיוק את השורות שבהן הוא החוכר', () => {
    const expected = DATASETS.v2.owners.filter(
      (o) =>
        o.altNameHash === rowA!.altNameHash ||
        (rowA!.altIdHash !== '' && o.altIdHash === rowA!.altIdHash),
    );
    expect(resolveHoldings('v2', rowA!.altNameHash)).toEqual(expected);
  });
});
