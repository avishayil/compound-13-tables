import { describe, it, expect } from 'vitest';
import { findHoldings, parseOwnersCsv, type OwnerHolding } from './owners';
import { DATASETS, VERSION_IDS, resolveHoldings } from './datasets';
import { normalizeName, sha256Hex } from '../lib/hash';

const nameHash = (name: string) => sha256Hex(normalizeName(name));

describe('parseOwnersCsv', () => {
  it('מפענח פורמט v1 (4 עמודות) — בלי hashes של חוכר', () => {
    const csv = 'nameHash,idHash,plotId,fraction\nabc,def,44,1/250\nabc,def,152,11/10000\n';
    const rows = parseOwnersCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual<OwnerHolding>({
      nameHash: 'abc',
      idHash: 'def',
      altNameHash: '',
      altIdHash: '',
      plotId: '44',
      fraction: '1/250',
    });
    expect(rows[1].plotId).toBe('152');
  });

  it('מפענח פורמט v2 (6 עמודות) — כולל hashes של חוכר ומגרש עם אות', () => {
    const csv = 'nameHash,idHash,altNameHash,altIdHash,plotId,fraction\nabc,,lname,lid,43B,1/1\n';
    expect(parseOwnersCsv(csv)).toEqual<OwnerHolding[]>([
      {
        nameHash: 'abc',
        idHash: '',
        altNameHash: 'lname',
        altIdHash: 'lid',
        plotId: '43B',
        fraction: '1/1',
      },
    ]);
  });
});

describe('findHoldings', () => {
  const owners = parseOwnersCsv(
    'nameHash,idHash,altNameHash,altIdHash,plotId,fraction\n' +
      'owner,oid,lessee,lid,100,1/2\n' +
      'other,,,,100,1/2\n',
  );

  it('מוצא לפי hash של שם/ת.ז. הבעלים או של שם/ת.ז. החוכר', () => {
    for (const hash of ['owner', 'oid', 'lessee', 'lid']) {
      expect(findHoldings(owners, hash), hash).toHaveLength(1);
    }
  });

  it('לא מתאים hash ריק לשדות ריקים', () => {
    expect(findHoldings(owners, '')).toEqual([]);
    expect(findHoldings(owners, 'does-not-exist')).toEqual([]);
  });
});

describe.each(VERSION_IDS)('owners.csv (נתונים אמיתיים) — %s', (version) => {
  const ds = DATASETS[version];

  it('מכיל החזקות', () => {
    expect(ds.owners.length).toBeGreaterThan(0);
  });

  it('כל מגרש בהחזקות קיים במגרשי הגרסה', () => {
    for (const o of ds.owners) {
      expect(ds.getLot(o.plotId), o.plotId).toBeDefined();
    }
  });

  it('סכום השברים של כל מגרש שווה ל-1 (שלמות נתונים)', () => {
    const byPlot = new Map<string, number>();
    for (const o of ds.owners) {
      const [a, b] = o.fraction.split('/').map(Number);
      byPlot.set(o.plotId, (byPlot.get(o.plotId) ?? 0) + a / b);
    }
    for (const [plot, sum] of byPlot) {
      expect(sum, plot).toBeCloseTo(1, 6);
    }
  });
});

describe('נתונים אמיתיים — בעלים ספציפיים', () => {
  it('v1: שומר החזקות כפולות לגיטימיות (בר ליאור = 4 שורות, לא ממוזג)', async () => {
    const holdings = DATASETS.v1.getHoldingsByHash(await nameHash('בר ליאור'));
    expect(holdings).toHaveLength(4);
    expect(holdings.filter((h) => h.plotId === '44' && h.fraction === '1/250')).toHaveLength(2);
    expect(holdings.filter((h) => h.plotId === '152' && h.fraction === '11/10000')).toHaveLength(2);
  });

  it('v2: תתי-שורות משויכות לבעלים לפי גבולות התא (43B שייך לדסקל, לא לקק"ל)', async () => {
    const daskal = DATASETS.v2.getHoldingsByHash(await nameHash('דסקל-חברה לחומרי בנין בע"מ'));
    expect(daskal.map((h) => `${h.plotId} ${h.fraction}`).sort()).toEqual([
      '102 1/1',
      '103 1/1',
      '43B 1/1',
    ]);
    const kkl = DATASETS.v2.getHoldingsByHash(await nameHash('קרן קיימת לישראל'));
    const kklKeys = kkl.map((h) => `${h.plotId} ${h.fraction}`);
    expect(kklKeys).toEqual(
      expect.arrayContaining(['107 14972/100000', '123 23854/100000', '152 1/1']),
    );
    expect(kkl.some((h) => h.plotId === '43B')).toBe(false);
  });
});

describe('resolveHoldings — קישור בין גרסאות', () => {
  it('מחזיר התאמה ישירה כשה-hash קיים בגרסה', async () => {
    const hash = await nameHash('בר ליאור');
    expect(resolveHoldings('v2', hash)).toEqual(DATASETS.v2.getHoldingsByHash(hash));
  });

  it('כששם לא נמצא בגרסה, מקשר דרך ת.ז. מהגרסה האחרת', () => {
    // בעלים שה-hash של שמו קיים רק ב-v1, אבל ה-ת.ז. שלו קיימת גם ב-v2
    const v2Ids = new Set(DATASETS.v2.owners.map((o) => o.idHash).filter(Boolean));
    const v2Names = new Set(DATASETS.v2.owners.flatMap((o) => [o.nameHash, o.altNameHash]));
    const candidate = DATASETS.v1.owners.find(
      (o) => o.idHash && v2Ids.has(o.idHash) && !v2Names.has(o.nameHash),
    );
    expect(candidate).toBeDefined();
    const linked = resolveHoldings('v2', candidate!.nameHash);
    expect(linked.length).toBeGreaterThan(0);
    expect(
      linked.every((h) => h.idHash === candidate!.idHash || h.altIdHash === candidate!.idHash),
    ).toBe(true);
  });

  it('מחזיר ריק כשאין התאמה באף גרסה', () => {
    expect(resolveHoldings('v1', 'does-not-exist')).toEqual([]);
    expect(resolveHoldings('v2', '')).toEqual([]);
  });
});
