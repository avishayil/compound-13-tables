import { describe, it, expect } from 'vitest';
import {
  DATASETS,
  identityKeysIn,
  resolveHoldings,
  resolveManyIn,
  resolveOwners,
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
  // בעלים ללא ת.ז. שלקרקע שלו כמה חוכרים
  const lesseeRows = DATASETS.v2.owners.filter((o) => o.altNameHash && !o.idHash);
  const owner = lesseeRows[0].nameHash;
  const [rowA, rowB] = lesseeRows.filter(
    (o, i, arr) =>
      o.nameHash === owner && arr.findIndex((x) => x.altNameHash === o.altNameHash) === i,
  );

  it('שני חוכרים שונים של אותו בעלים אינם נחשבים כפולים', () => {
    const keysA = identityKeysIn(
      { v1: DATASETS.v1.owners, v2: DATASETS.v2.owners },
      rowA.altNameHash,
    );
    const keysB = identityKeysIn(
      { v1: DATASETS.v1.owners, v2: DATASETS.v2.owners },
      rowB.altNameHash,
    );
    expect(keysA.some((k) => keysB.includes(k))).toBe(false);
  });

  it('הוספת הבעלים והחוכר של אותה שורה לא מכפילה את הזכויות', () => {
    const both = resolveOwners('v2', [owner, rowA.altNameHash]);
    expect(both.filter((x) => x === rowA)).toHaveLength(1);
  });

  it('resolveHoldings לחוכר מחזיר רק את השורות שלו', () => {
    const holdings = resolveHoldings('v2', rowA.altNameHash);
    expect(holdings.length).toBeGreaterThan(0);
    expect(
      holdings.every((x) => x.altNameHash === rowA.altNameHash || x.altIdHash === rowA.altIdHash),
    ).toBe(true);
  });
});
