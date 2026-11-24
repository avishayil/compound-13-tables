import type { Lot } from '../data/lots';
import type { Dataset } from '../data/datasets';
import type { OwnerHolding } from '../data/owners';
import { calculateRights, parseShareInput, type RightsResult } from './calc';

/** שורת קלט גולמית שהמשתמש מזין בטופס. */
export interface RightRow {
  id: string;
  lotId: string;
  shareInput: string;
  quantity: string;
}

/** שורה מחושבת בהצלחה לתצוגה בטבלה. */
export interface ComputedRow {
  id: string;
  lot: Lot;
  shareInput: string;
  quantity: number;
  result: RightsResult;
}

/** שורה עם שגיאת validation. */
export interface RowError {
  id: string;
  message: string;
}

/**
 * מחשב שורה בודדת. מחזיר את התוצאה או שגיאה בעברית.
 * משתמש ב-getLotById דרך ה-lot שכבר נשלף בקריאה.
 */
export function computeRow(row: RightRow, lot: Lot): ComputedRow | RowError {
  try {
    const share = parseShareInput(row.shareInput);
    const quantity = Number(row.quantity.trim());
    if (row.quantity.trim() === '') {
      throw new Error('יש להזין כמות חזרות.');
    }
    const result = calculateRights(lot, share, quantity);
    return {
      id: row.id,
      lot,
      shareInput: row.shareInput.trim(),
      quantity,
      result,
    };
  } catch (err) {
    return { id: row.id, message: err instanceof Error ? err.message : 'שגיאה לא ידועה.' };
  }
}

export function isError(row: ComputedRow | RowError): row is RowError {
  return (row as RowError).message !== undefined;
}

/**
 * מחשב את כל השורות מול מגרשי הגרסה. מדלג על שורות ריקות ועל מגרש שלא קיים בגרסה.
 */
export function computeRows(
  dataset: Dataset,
  rows: RightRow[],
): { computed: ComputedRow[]; errors: RowError[] } {
  const computed: ComputedRow[] = [];
  const errors: RowError[] = [];
  for (const row of rows) {
    if (row.shareInput.trim() === '') continue;
    const lot = dataset.getLot(row.lotId);
    if (!lot) continue;
    const res = computeRow(row, lot);
    if (isError(res)) errors.push(res);
    else computed.push(res);
  }
  return { computed, errors };
}

/** ממיר החזקות לשורות חישוב: החזקות זהות (אותו מגרש + אותו שבר) מקובצות לשורה אחת עם כמות. */
export function holdingsToRows(holdings: OwnerHolding[]): RightRow[] {
  const grouped = new Map<string, { lotId: string; fraction: string; quantity: number }>();
  for (const h of holdings) {
    const key = `${h.plotId}|${h.fraction}`;
    const existing = grouped.get(key);
    if (existing) existing.quantity += 1;
    else grouped.set(key, { lotId: h.plotId, fraction: h.fraction, quantity: 1 });
  }
  return [...grouped.values()].map((g, i) => ({
    id: `owner-${i}`,
    lotId: g.lotId,
    shareInput: g.fraction,
    quantity: String(g.quantity),
  }));
}

export function emptyResult(): RightsResult {
  return {
    effectiveShare: 0,
    sharePercent: 0,
    relativeLandArea: 0,
    relativeResidentialArea: 0,
    equivalentUnits: 0,
    relativeCommercialGround: 0,
    relativeCommercialUpper: 0,
    relativeCommercialTotal: 0,
    relativeTotalBuildRights: 0,
    relativeValue: 0,
  };
}

/** סכום כל שדות התוצאה על פני השורות. */
export function sumResults(rows: ComputedRow[]): RightsResult {
  return rows.reduce((acc, row) => {
    const r = row.result;
    for (const key of Object.keys(acc) as (keyof RightsResult)[]) {
      acc[key] += r[key];
    }
    return acc;
  }, emptyResult());
}
