import { describe, it, expect } from 'vitest';
import { parseShareInput, calculateRights } from './calc';
import { getLotById } from '../data/lots';

describe('parseShareInput', () => {
  it('מפענח שבר a/b', () => {
    expect(parseShareInput('1/250')).toBeCloseTo(0.004, 12);
    expect(parseShareInput('11/10000')).toBeCloseTo(0.0011, 12);
  });

  it('מתעלם מרווחים', () => {
    expect(parseShareInput('  1 / 250 ')).toBeCloseTo(0.004, 12);
  });

  it('דוחה אחוז (לא שבר)', () => {
    expect(() => parseShareInput('1.6%')).toThrow();
  });

  it('דוחה מספר עשרוני (לא שבר)', () => {
    expect(() => parseShareInput('0.016')).toThrow();
  });

  it('זורק שגיאה כשהמכנה 0', () => {
    expect(() => parseShareInput('1/0')).toThrow();
  });

  it('זורק שגיאה על קלט ריק', () => {
    expect(() => parseShareInput('')).toThrow();
    expect(() => parseShareInput('   ')).toThrow();
  });

  it('זורק שגיאה על קלט לא תקין', () => {
    expect(() => parseShareInput('abc')).toThrow();
    expect(() => parseShareInput('1/2/3')).toThrow();
    expect(() => parseShareInput('/250')).toThrow();
    expect(() => parseShareInput('1/')).toThrow();
  });
});

describe('calculateRights', () => {
  it('מגרש 44, שבר 1/250, כמות 4', () => {
    const lot = getLotById(44)!;
    const r = calculateRights(lot, parseShareInput('1/250'), 4);
    expect(r.effectiveShare).toBeCloseTo(0.016, 12);
    expect(r.sharePercent).toBeCloseTo(1.6, 10);
    expect(r.relativeLandArea).toBeCloseTo(71.296, 6);
    expect(r.relativeResidentialArea).toBeCloseTo(285.216, 6);
    expect(r.equivalentUnits).toBeCloseTo(2.56, 10);
    expect(r.relativeCommercialGround).toBeCloseTo(71.312, 6);
    expect(r.relativeCommercialFirst).toBeCloseTo(71.312, 6);
    expect(r.relativeCommercialTotal).toBeCloseTo(142.624, 6);
    expect(r.relativeTotalBuildRights).toBeCloseTo(427.84, 6);
  });

  it('מגרש 152, שבר 11/10000, כמות 4', () => {
    const lot = getLotById(152)!;
    const r = calculateRights(lot, parseShareInput('11/10000'), 4);
    expect(r.effectiveShare).toBeCloseTo(0.0044, 12);
    expect(r.sharePercent).toBeCloseTo(0.44, 10);
    expect(r.relativeLandArea).toBeCloseTo(6.842, 6);
    expect(r.relativeResidentialArea).toBeCloseTo(46.5124, 6);
    expect(r.equivalentUnits).toBeCloseTo(0.4356, 10);
    expect(r.relativeCommercialGround).toBe(0);
    expect(r.relativeCommercialFirst).toBe(0);
    expect(r.relativeCommercialTotal).toBe(0);
    expect(r.relativeTotalBuildRights).toBeCloseTo(46.5124, 6);
  });

  it('מגרש 127, שבר 1/250, כמות 1', () => {
    const lot = getLotById(127)!;
    const r = calculateRights(lot, parseShareInput('1/250'), 1);
    expect(r.effectiveShare).toBeCloseTo(0.004, 12);
    expect(r.sharePercent).toBeCloseTo(0.4, 10);
    expect(r.relativeLandArea).toBeCloseTo(4.816, 6);
    expect(r.relativeResidentialArea).toBeCloseTo(10.4, 6);
    expect(r.equivalentUnits).toBeCloseTo(0.092, 10);
    expect(r.relativeCommercialTotal).toBe(0);
    expect(r.relativeTotalBuildRights).toBeCloseTo(10.4, 6);
  });

  it('זורק שגיאה כשהכמות לא חיובית', () => {
    const lot = getLotById(44)!;
    expect(() => calculateRights(lot, 0.004, 0)).toThrow();
    expect(() => calculateRights(lot, 0.004, -1)).toThrow();
  });
});
