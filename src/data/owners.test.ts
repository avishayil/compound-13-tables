import { describe, it, expect } from 'vitest';
import { OWNERS, parseOwnersCsv, getHoldingsByHash } from './owners';
import { getLotById } from './lots';
import { normalizeName, sha256Hex } from '../lib/hash';

describe('parseOwnersCsv', () => {
  it('מפענח שורות ל-hashes, מגרש ושבר', () => {
    const csv = 'nameHash,idHash,plotId,fraction\nabc,def,44,1/250\nabc,def,152,11/10000\n';
    const rows = parseOwnersCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ nameHash: 'abc', idHash: 'def', plotId: 44, fraction: '1/250' });
    expect(rows[1].plotId).toBe(152);
  });
});

describe('owners.csv (נתונים אמיתיים)', () => {
  it('מכיל החזקות', () => {
    expect(OWNERS.length).toBeGreaterThan(0);
  });

  it('כל מגרש בהחזקות קיים ב-LOTS', () => {
    for (const o of OWNERS) {
      expect(getLotById(o.plotId)).toBeDefined();
    }
  });

  it('סכום השברים של כל מגרש שווה ל-1 (שלמות נתונים)', () => {
    const byPlot = new Map<number, number>();
    for (const o of OWNERS) {
      const [a, b] = o.fraction.split('/').map(Number);
      byPlot.set(o.plotId, (byPlot.get(o.plotId) ?? 0) + a / b);
    }
    for (const [, sum] of byPlot) {
      expect(sum).toBeCloseTo(1, 6);
    }
  });

  it('getHoldingsByHash מחזיר ריק עבור hash לא קיים', () => {
    expect(getHoldingsByHash('does-not-exist')).toEqual([]);
    expect(getHoldingsByHash('')).toEqual([]);
  });

  it('getHoldingsByHash מחזיר את כל ההחזקות עבור nameHash קיים', () => {
    const someHash = OWNERS[0].nameHash;
    const holdings = getHoldingsByHash(someHash);
    expect(holdings.length).toBeGreaterThan(0);
    expect(holdings.every((h) => h.nameHash === someHash || h.idHash === someHash)).toBe(true);
  });

  it('שומר החזקות כפולות לגיטימיות (בר ליאור = 4 שורות, לא ממוזג)', async () => {
    const hash = await sha256Hex(normalizeName('בר ליאור'));
    const holdings = getHoldingsByHash(hash);
    expect(holdings).toHaveLength(4);
    // שני מגרשים, כל אחד מופיע פעמיים
    const plot44 = holdings.filter((h) => h.plotId === 44 && h.fraction === '1/250');
    const plot152 = holdings.filter((h) => h.plotId === 152 && h.fraction === '11/10000');
    expect(plot44).toHaveLength(2);
    expect(plot152).toHaveLength(2);
  });
});
