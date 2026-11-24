import { describe, it, expect } from 'vitest';
import { buildCsv } from './csv';
import { calculateRights } from './calc';
import { DATASETS } from '../data/datasets';
import type { ComputedRow } from './rows';

describe('buildCsv', () => {
  const lot = DATASETS.v2.getLot('107')!;
  const row: ComputedRow = {
    id: 'r1',
    lot,
    shareInput: '14972/100000',
    quantity: 1,
    result: calculateRights(lot, 14972 / 100000, 1),
  };

  it('כולל עמודת מגרש ועמודת שווי יחסי בשקלים', () => {
    const [header, line] = buildCsv([row]).replace(/^﻿/, '').split('\r\n');
    expect(header.split(',')).toEqual([
      'מגרש',
      'ייעוד',
      'שבר',
      'כמות',
      'סה״כ מגורים (מ״ר)',
      'זכות רעיונית לדירה',
      'סה״כ מסחר ותעסוקה (מ״ר)',
      'שווי יחסי (₪)',
    ]);
    const cells = line.split(',');
    expect(cells[0]).toBe('107');
    expect(cells[cells.length - 1]).toBe('3789413');
  });
});
