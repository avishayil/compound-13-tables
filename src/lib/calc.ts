import type { Lot } from '../data/lots';

/**
 * ממיר קלט שבר לערך מספרי (fractionValue):
 * - "a/b" -> a / b   (המכנה לא יכול להיות 0)
 * הקלט חייב להיות שבר בלבד. אחוז או מספר עשרוני אינם מתקבלים.
 * זורק Error עם הודעה בעברית עבור קלט ריק/לא תקין.
 */
export function parseShareInput(input: string): number {
  const trimmed = input.trim();
  if (trimmed === '') {
    throw new Error('יש להזין שבר זכות.');
  }

  if (!trimmed.includes('/')) {
    throw new Error('יש להזין שבר בלבד, בפורמט כמו 1/250.');
  }

  const parts = trimmed.split('/');
  if (parts.length !== 2) {
    throw new Error('שבר לא תקין. השתמש בפורמט כמו 1/250.');
  }

  const numerator = Number(parts[0].trim());
  const denominator = Number(parts[1].trim());
  if (parts[0].trim() === '' || parts[1].trim() === '') {
    throw new Error('שבר לא תקין. השתמש בפורמט כמו 1/250.');
  }
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) {
    throw new Error('שבר לא תקין. המונה והמכנה חייבים להיות מספרים.');
  }
  if (denominator === 0) {
    throw new Error('המכנה (denominator) לא יכול להיות 0.');
  }
  return numerator / denominator;
}

export interface RightsResult {
  effectiveShare: number;
  sharePercent: number;
  relativeLandArea: number;
  relativeResidentialArea: number;
  equivalentUnits: number;
  relativeCommercialGround: number;
  relativeCommercialUpper: number;
  relativeCommercialTotal: number;
  relativeTotalBuildRights: number;
  /** שווי יחסי (₪) = שבר × שווי המגרש בטבלת השמאי. אינו שומה. */
  relativeValue: number;
}

/**
 * מחשב זכויות בנייה יחסיות למגרש לפי השבר והכמות.
 * quantity חייב להיות מספר חיובי.
 */
export function calculateRights(lot: Lot, share: number, quantity: number): RightsResult {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error('כמות החזרות חייבת להיות מספר חיובי.');
  }

  const effectiveShare = share * quantity;
  const relativeCommercialGround = lot.commercialGroundFloorArea * effectiveShare;
  const relativeCommercialUpper = lot.commercialUpperArea * effectiveShare;
  const relativeCommercialTotal = relativeCommercialGround + relativeCommercialUpper;
  const relativeResidentialArea = lot.residentialPaldelletArea * effectiveShare;

  return {
    effectiveShare,
    sharePercent: effectiveShare * 100,
    relativeLandArea: lot.lotArea * effectiveShare,
    relativeResidentialArea,
    equivalentUnits: lot.housingUnits * effectiveShare,
    relativeCommercialGround,
    relativeCommercialUpper,
    relativeCommercialTotal,
    relativeTotalBuildRights: relativeResidentialArea + relativeCommercialTotal,
    relativeValue: lot.lotValue * effectiveShare,
  };
}

/** עיגול לתצוגה — שטחים ל-2 ספרות. */
export function roundArea(value: number): number {
  return Math.round(value * 100) / 100;
}

/** עיגול לתצוגה — שווי לשקל שלם. */
export function roundCurrency(value: number): number {
  return Math.round(value);
}

/** עיגול לתצוגה — יח״ד אקוויוולנטיות ל-4 ספרות. */
export function roundUnits(value: number): number {
  return Math.round(value * 1e4) / 1e4;
}

/** עיגול לתצוגה — אחוזים ל-4 ספרות. */
export function roundPercent(value: number): number {
  return Math.round(value * 1e4) / 1e4;
}
