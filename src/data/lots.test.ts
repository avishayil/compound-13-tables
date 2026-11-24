import { describe, it, expect } from 'vitest';
import { compareLotIds, parseLotsCsv, type Lot } from './lots';
import { DATASETS } from './datasets';

const HEADER =
  'מס׳ מגרש,שטח המגרש,ייעוד,שטח פלדלת למגורים,כמות יח״ד,מסחר קרקע,קומות עליונות,מב״צ,שווי';

describe('parseLotsCsv', () => {
  it('מפענח את כל העמודות, כולל מזהה מגרש עם אות וייעוד עם פסיק', () => {
    const lots = parseLotsCsv(
      `${HEADER}\n46,4069,"מגורים, מסחר ותעסוקה",14375,131,2035,15952,0,77490000\n`,
    );
    expect(lots).toEqual<Lot[]>([
      {
        id: '46',
        lotArea: 4069,
        zoning: 'מגורים, מסחר ותעסוקה',
        residentialPaldelletArea: 14375,
        housingUnits: 131,
        commercialGroundFloorArea: 2035,
        commercialUpperArea: 15952,
        publicBuildingArea: 0,
        lotValue: 77490000,
      },
    ]);
  });

  it('שומר מזהה מגרש כמחרוזת (40A)', () => {
    const [lot] = parseLotsCsv(`${HEADER}\n40A,2652,מגורים ומסחר,6690,61,381,0,0,25110000`);
    expect(lot.id).toBe('40A');
  });
});

describe('compareLotIds', () => {
  it('ממיין מספרית ואז לפי אות', () => {
    expect(['500', '100', '40B', '41', '40A', '45B'].sort(compareLotIds)).toEqual([
      '40A',
      '40B',
      '41',
      '45B',
      '100',
      '500',
    ]);
  });
});

/** סכום עמודה בכל המגרשים של גרסה. */
function total(lots: Lot[], key: keyof Lot): number {
  return lots.reduce((acc, lot) => acc + (lot[key] as number), 0);
}

describe('plots.csv (נתונים אמיתיים) מול שורת הסיכום המודפסת', () => {
  // שטחים: הסיכום המודפס מחושב מערכים לא מעוגלים — סטייה של עד 5 מ״ר היא עיגול תצוגה.
  // יח״ד ושווי: התאמה מדויקת. ראו scripts/validate_plots.py.
  it('v1 — 52 מגרשים, סכומים כמו בעמ׳ 67', () => {
    const lots = DATASETS.v1.lots;
    expect(lots).toHaveLength(52);
    expect(total(lots, 'housingUnits')).toBe(3000);
    expect(total(lots, 'lotValue')).toBe(1_510_100_000);
    expect(total(lots, 'publicBuildingArea')).toBe(1950);
    expect(Math.abs(total(lots, 'residentialPaldelletArea') - 330_635)).toBeLessThanOrEqual(5);
    expect(Math.abs(total(lots, 'commercialGroundFloorArea') - 24_150)).toBeLessThanOrEqual(5);
    expect(Math.abs(total(lots, 'commercialUpperArea') - 55_117)).toBeLessThanOrEqual(5);
  });

  it('v2 — 58 מגרשים, סכומים כמו בעמ׳ 100', () => {
    const lots = DATASETS.v2.lots;
    expect(lots).toHaveLength(58);
    expect(total(lots, 'housingUnits')).toBe(3216);
    expect(total(lots, 'lotValue')).toBe(1_467_770_000);
    expect(total(lots, 'publicBuildingArea')).toBe(1950);
    expect(Math.abs(total(lots, 'residentialPaldelletArea') - 353_323)).toBeLessThanOrEqual(5);
    expect(Math.abs(total(lots, 'commercialGroundFloorArea') - 16_947)).toBeLessThanOrEqual(5);
    expect(Math.abs(total(lots, 'commercialUpperArea') - 53_587)).toBeLessThanOrEqual(5);
  });

  it('v2 — מגרשים מפוצלים ומגרש 500 קיימים, מגרש 40 הישן לא', () => {
    const v2 = DATASETS.v2;
    for (const id of [
      '40A',
      '40B',
      '42A',
      '42B',
      '43A',
      '43B',
      '44A',
      '44B',
      '45A',
      '45B',
      '500',
    ]) {
      expect(v2.getLot(id), id).toBeDefined();
    }
    expect(v2.getLot('40')).toBeUndefined();
    expect(DATASETS.v1.getLot('40')).toBeDefined();
  });
});
