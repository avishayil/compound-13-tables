import { DATASETS, ownerRows, type VersionId } from '../data/datasets';
import type { RightsResult } from '../lib/calc';
import { roundArea, roundCurrency, roundUnits } from '../lib/calc';
import { sumResults } from '../lib/rows';
import type { AddedOwner } from './OwnerPicker';

interface Props {
  owners: AddedOwner[];
}

/** סדר העמודות: מהגרסה הקודמת לעדכנית, כדי שהשינוי (Δ) יקרא משמאל לימין בזמן. */
const ORDER: VersionId[] = ['v1', 'v2'];

interface Metric {
  label: string;
  value: (r: RightsResult) => number;
  format: (v: number) => string;
}

const METRICS: Metric[] = [
  {
    label: 'סה״כ מגורים (מ״ר)',
    value: (r) => r.relativeResidentialArea,
    format: (v) => roundArea(v).toLocaleString('he-IL', { maximumFractionDigits: 2 }),
  },
  {
    label: 'זכות רעיונית לדירה',
    value: (r) => r.equivalentUnits,
    format: (v) => roundUnits(v).toLocaleString('he-IL', { maximumFractionDigits: 4 }),
  },
  {
    label: 'סה״כ מסחר ותעסוקה (מ״ר) *',
    value: (r) => r.relativeCommercialTotal,
    format: (v) => roundArea(v).toLocaleString('he-IL', { maximumFractionDigits: 2 }),
  },
  {
    label: 'שווי יחסי (₪)',
    value: (r) => r.relativeValue,
    format: (v) => `₪ ${roundCurrency(v).toLocaleString('he-IL')}`,
  },
];

function totalsFor(version: VersionId, owners: AddedOwner[]): RightsResult | null {
  const { computed } = ownerRows(
    version,
    owners.map((o) => o.hash),
  );
  if (computed.length === 0) return null;
  return sumResults(computed);
}

/** כרטיס השוואה: סיכום הזכויות של הבעלים שנבחרו בכל אחת מהגרסאות, והשינוי ביניהן. */
export default function VersionCompare({ owners }: Props) {
  if (owners.length === 0) return null;

  const totals = ORDER.map((v) => totalsFor(v, owners));
  const [before, after] = totals;

  const delta = (m: Metric) => {
    if (!before || !after) return null;
    const d = m.value(after) - m.value(before);
    const shown = m.format(Math.abs(d));
    if (shown === m.format(0)) return <span>ללא שינוי</span>;
    return (
      <span className={d > 0 ? 'delta-up' : 'delta-down'}>{`${d > 0 ? '+' : '−'}${shown}`}</span>
    );
  };

  return (
    <div className="card">
      <h2>השוואה בין גרסאות הטבלאות</h2>
      <table className="compare-table">
        <thead>
          <tr>
            <th></th>
            {ORDER.map((v) => (
              <th key={v}>{DATASETS[v].label}</th>
            ))}
            <th>שינוי</th>
          </tr>
        </thead>
        <tbody>
          {METRICS.map((m) => (
            <tr key={m.label}>
              <td>{m.label}</td>
              {totals.map((t, i) => (
                <td key={ORDER[i]}>{t ? m.format(m.value(t)) : 'לא נמצא'}</td>
              ))}
              <td>{delta(m) ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="compare-note">
        המגרשים השתנו בין הגרסאות (למשל מגרש 40 פוצל ל-40A ול-40B), ולכן ההשוואה היא בסך הזכויות ולא
        מגרש מול מגרש. אם שם נכתב אחרת בין הגרסאות, הבעלים מקושר לפי מספר הזהות.
      </p>
      <p className="compare-note">
        * הגדרת שטחי המסחר שונה בין הגרסאות: במופקדת — {DATASETS.v1.commercialNote} בעדכון 106(ב) —{' '}
        {DATASETS.v2.commercialNote} לכן חלק מהשינוי בשורה זו נובע מההגדרה ולא משינוי בזכויות.
      </p>
    </div>
  );
}
