import { describe, it, expect } from 'vitest';
import {
  DATASETS,
  identityKeysIn,
  isAmbiguousIn,
  isDuplicateOwner,
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

  it('אפשר להוסיף לפי שם אדם בעל שם זהה למי שכבר נוסף לפי ת.ז.', () => {
    const byId = identityKeysIn(all, 'ID1');
    const byName = identityKeysIn(all, 'N');
    expect(isDuplicateOwner([byId], byName)).toBe(false);
  });
});

describe('isDuplicateOwner', () => {
  it('כפול רק כשכל המזהים החדשים כבר קיימים', () => {
    expect(isDuplicateOwner([['a'], ['b']], ['a'])).toBe(true);
    expect(isDuplicateOwner([['a'], ['b']], ['a', 'b'])).toBe(true);
    expect(isDuplicateOwner([['a']], ['a', 'c'])).toBe(false);
    expect(isDuplicateOwner([], ['a'])).toBe(false);
  });
});

describe('identityKeysIn — זהות הבעלים למניעת הוספה כפולה', () => {
  it('שני חוכרים של אותו בעלים ללא ת.ז. מקבלים זהויות שונות', () => {
    const all: OwnersByVersion = {
      v1: [],
      v2: [
        h('owner', '', '111', '1/2', 'lesseeA', 'aid'),
        h('owner', '', '112', '1/2', 'lesseeB', ''),
      ],
    };
    const a = identityKeysIn(all, 'lesseeA');
    const b = identityKeysIn(all, 'lesseeB');
    const owner = identityKeysIn(all, 'owner');
    expect(a).toEqual(['aid']);
    expect(b).toEqual(['lesseeB']);
    expect(owner).toEqual(['owner']);
  });

  it('אותו אדם לפי שם ולפי ת.ז. מקבל אותה זהות', () => {
    const all: OwnersByVersion = { v1: [], v2: [h('N', 'ID', '41', '1/10')] };
    expect(identityKeysIn(all, 'N')).toEqual(identityKeysIn(all, 'ID'));
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
    const keysA = identityKeysIn(all, rowA!.altNameHash);
    const keysB = identityKeysIn(all, rowB!.altNameHash);
    expect(isDuplicateOwner([keysA], keysB)).toBe(false);
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
