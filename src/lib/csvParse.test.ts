import { describe, it, expect } from 'vitest';
import { parseCsv, parseCsvLine } from './csvParse';

describe('parseCsvLine', () => {
  it('מפצל שורה פשוטה לפי פסיקים', () => {
    expect(parseCsvLine('40A,2652,מגורים ומסחר')).toEqual(['40A', '2652', 'מגורים ומסחר']);
  });

  it('שומר פסיק בתוך שדה במירכאות', () => {
    expect(parseCsvLine('46,4069,"מגורים, מסחר ותעסוקה",14375')).toEqual([
      '46',
      '4069',
      'מגורים, מסחר ותעסוקה',
      '14375',
    ]);
  });

  it('מפענח מירכאות כפולות בתוך שדה', () => {
    expect(parseCsvLine('"בע""מ",1')).toEqual(['בע"מ', '1']);
  });

  it('שומר שדות ריקים', () => {
    expect(parseCsvLine('a,,b,')).toEqual(['a', '', 'b', '']);
  });
});

describe('parseCsv', () => {
  it('מסיר BOM, מתעלם משורות ריקות ומטפל ב-CRLF', () => {
    expect(parseCsv('﻿h1,h2\r\n1,2\r\n\r\n3,4\n')).toEqual([
      ['h1', 'h2'],
      ['1', '2'],
      ['3', '4'],
    ]);
  });
});
