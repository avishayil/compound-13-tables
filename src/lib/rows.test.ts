import { describe, it, expect } from 'vitest';
import { computeRows, holdingsToRows, sumResults, type RightRow } from './rows';
import { DATASETS } from '../data/datasets';
import type { OwnerHolding } from '../data/owners';

const holding = (plotId: string, fraction: string): OwnerHolding => ({
  nameHash: 'n',
  idHash: 'i',
  altNameHash: '',
  altIdHash: '',
  plotId,
  fraction,
});

describe('holdingsToRows', () => {
  it('מקבץ החזקות זהות (מגרש + שבר) לשורה אחת עם כמות מצטברת', () => {
    const rows = holdingsToRows([
      holding('150', '1176/100000'),
      holding('40A', '1/2'),
      holding('150', '1176/100000'),
    ]);
    expect(
      rows.map(({ lotId, shareInput, quantity }) => ({ lotId, shareInput, quantity })),
    ).toEqual([
      { lotId: '150', shareInput: '1176/100000', quantity: '2' },
      { lotId: '40A', shareInput: '1/2', quantity: '1' },
    ]);
    expect(new Set(rows.map((r) => r.id)).size).toBe(2);
  });
});

describe('computeRows', () => {
  const row = (lotId: string, shareInput: string, quantity = '1'): RightRow => ({
    id: `${lotId}-${shareInput}`,
    lotId,
    shareInput,
    quantity,
  });

  it('מחשב מול מגרשי הגרסה ומדלג על שורות ריקות או מגרש שלא קיים בגרסה', () => {
    const { computed, errors } = computeRows(DATASETS.v2, [
      row('40A', '1/2'),
      row('40', '1/2'), // קיים רק במופקדת
      row('41', ''),
      row('41', 'abc'),
    ]);
    expect(computed.map((c) => c.lot.id)).toEqual(['40A']);
    expect(computed[0].result.relativeValue).toBeCloseTo(25_110_000 / 2, 4);
    expect(errors.map((e) => e.id)).toEqual(['41-abc']);
  });
});

describe('sumResults', () => {
  it('מסכם את כל השדות, כולל שווי', () => {
    const { computed } = computeRows(DATASETS.v2, [
      { id: 'a', lotId: '107', shareInput: '1/2', quantity: '1' },
      { id: 'b', lotId: '42A', shareInput: '1/10', quantity: '1' },
    ]);
    const s = sumResults(computed);
    expect(s.relativeResidentialArea).toBeCloseTo(5490 / 2 + 615.1, 6);
    expect(s.relativeCommercialTotal).toBeCloseTo(317, 6);
    expect(s.relativeValue).toBeCloseTo(25_310_000 / 2 + 3_088_000, 4);
  });

  it('מחזיר אפסים לרשימה ריקה', () => {
    expect(sumResults([]).relativeValue).toBe(0);
  });
});
