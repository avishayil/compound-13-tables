import type { Lot } from '../data/lots';
import { calculateRights, parseShareInput, type RightsResult } from './calc';

/** שורת קלט גולמית שהמשתמש מזין בטופס. */
export interface RightRow {
  id: string;
  lotId: number;
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
