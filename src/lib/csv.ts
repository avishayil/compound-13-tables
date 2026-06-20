import type { ComputedRow } from './rows';
import { roundArea, roundUnits } from './calc';

const HEADERS = [
  'ייעוד',
  'שבר',
  'כמות',
  'סה״כ מגורים (מ״ר)',
  'זכות רעיונית לדירה',
  'סה״כ מסחר (מ״ר)',
];

function escapeCell(value: string | number): string {
  const s = String(value);
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** בונה תוכן CSV מטבלת התוצאות, כולל BOM ל-UTF-8 כדי שעברית תיפתח נכון ב-Excel. */
export function buildCsv(rows: ComputedRow[]): string {
  const lines = [HEADERS.map(escapeCell).join(',')];
  for (const row of rows) {
    const r = row.result;
    lines.push(
      [
        row.lot.zoning,
        row.shareInput,
        row.quantity,
        roundArea(r.relativeResidentialArea),
        roundUnits(r.equivalentUnits),
        roundArea(r.relativeCommercialTotal),
      ]
        .map(escapeCell)
        .join(','),
    );
  }
  return '﻿' + lines.join('\r\n');
}

/** מוריד את ה-CSV כקובץ. */
export function downloadCsv(rows: ComputedRow[], filename = 'zchuyot-binya-machtam-13.csv'): void {
  const blob = new Blob([buildCsv(rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
