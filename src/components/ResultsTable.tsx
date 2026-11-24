import type { ComputedRow } from '../lib/rows';
import { sumResults } from '../lib/rows';
import { roundArea, roundCurrency, roundUnits } from '../lib/calc';
import { downloadCsv } from '../lib/csv';
import { compareLotIds } from '../data/lots';
import type { Dataset } from '../data/datasets';

interface Props {
  rows: ComputedRow[];
  dataset: Dataset;
}

const fmtArea = (v: number) => roundArea(v).toLocaleString('he-IL', { maximumFractionDigits: 2 });
const fmtUnits = (v: number) => roundUnits(v).toLocaleString('he-IL', { maximumFractionDigits: 4 });
export const fmtCurrency = (v: number) => `₪ ${roundCurrency(v).toLocaleString('he-IL')}`;

const COMMERCIAL_LABEL = 'סה״כ מסחר ותעסוקה (מ״ר)';
const VALUE_LABEL = 'שווי יחסי (₪)';

/** האם המגרשים בתוצאות כוללים זכויות מסחר/תעסוקה כלשהן. */
function hasAnyCommercial(rows: ComputedRow[]): boolean {
  return rows.some(
    (row) => row.lot.commercialGroundFloorArea > 0 || row.lot.commercialUpperArea > 0,
  );
}

export default function ResultsTable({ rows, dataset }: Props) {
  if (rows.length === 0) {
    return (
      <div className="card">
        <h2>תוצאות</h2>
        <p className="empty">אין תוצאות להצגה. הזן שבר זכות תקין כדי לראות חישוב.</p>
      </div>
    );
  }

  // קיבוץ לפי מגרש לצורך סיכומי ביניים
  const byLot = new Map<string, ComputedRow[]>();
  for (const row of rows) {
    const list = byLot.get(row.lot.id) ?? [];
    list.push(row);
    byLot.set(row.lot.id, list);
  }
  const lotIds = [...byLot.keys()].sort(compareLotIds);
  const showLotSummaries = lotIds.length > 1 || (byLot.get(lotIds[0])?.length ?? 0) > 1;

  const grand = sumResults(rows);
  const showCommercial = hasAnyCommercial(rows);

  // מספר העמודות שהתווית בשורות הסיכום מתפרשת עליהן (מגרש + ייעוד + שבר + כמות)
  const labelSpan = 4;

  return (
    <div className="card">
      <div className="results-head">
        <h2>תוצאות</h2>
        <button
          type="button"
          className="btn-csv"
          onClick={() => downloadCsv(rows, `zchuyot-binya-machtam-13-${dataset.id}.csv`)}
        >
          ⬇ ייצוא CSV
        </button>
      </div>
      <p className="results-version">לפי גרסת הטבלאות: {dataset.label}</p>

      <table className="results-table">
        <thead>
          <tr>
            <th className="col-lot">מגרש</th>
            <th className="col-zoning">ייעוד</th>
            <th>שבר</th>
            <th>כמות</th>
            <th>סה״כ מגורים (מ״ר)</th>
            <th>זכות רעיונית לדירה</th>
            {showCommercial && <th>{COMMERCIAL_LABEL}</th>}
            <th>{VALUE_LABEL}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const r = row.result;
            return (
              <tr key={row.id}>
                <td data-label="מגרש">{row.lot.id}</td>
                <td className="col-zoning" data-label="ייעוד">
                  {row.lot.zoning}
                </td>
                <td data-label="שבר">{row.shareInput}</td>
                <td data-label="כמות">{row.quantity}</td>
                <td data-label="סה״כ מגורים (מ״ר)">{fmtArea(r.relativeResidentialArea)}</td>
                <td data-label="זכות רעיונית לדירה">{fmtUnits(r.equivalentUnits)}</td>
                {showCommercial && (
                  <td data-label={COMMERCIAL_LABEL}>{fmtArea(r.relativeCommercialTotal)}</td>
                )}
                <td data-label={VALUE_LABEL}>{fmtCurrency(r.relativeValue)}</td>
              </tr>
            );
          })}

          {showLotSummaries &&
            lotIds.map((lotId) => {
              const s = sumResults(byLot.get(lotId)!);
              return (
                <tr key={`sum-${lotId}`} className="row-subtotal">
                  <td data-label="סיכום" colSpan={labelSpan}>
                    סיכום מגרש {lotId}
                  </td>
                  <td data-label="סה״כ מגורים (מ״ר)">{fmtArea(s.relativeResidentialArea)}</td>
                  <td data-label="זכות רעיונית לדירה">{fmtUnits(s.equivalentUnits)}</td>
                  {showCommercial && (
                    <td data-label={COMMERCIAL_LABEL}>{fmtArea(s.relativeCommercialTotal)}</td>
                  )}
                  <td data-label={VALUE_LABEL}>{fmtCurrency(s.relativeValue)}</td>
                </tr>
              );
            })}

          <tr className="row-total">
            <td data-label="" colSpan={labelSpan}>
              סה״כ כל הזכויות
            </td>
            <td data-label="סה״כ מגורים (מ״ר)">{fmtArea(grand.relativeResidentialArea)}</td>
            <td data-label="זכות רעיונית לדירה">{fmtUnits(grand.equivalentUnits)}</td>
            {showCommercial && (
              <td data-label={COMMERCIAL_LABEL}>{fmtArea(grand.relativeCommercialTotal)}</td>
            )}
            <td data-label={VALUE_LABEL}>{fmtCurrency(grand.relativeValue)}</td>
          </tr>
        </tbody>
      </table>

      <dl className="results-legend">
        <div>
          <dt>מגרש</dt>
          <dd>מספר המגרש במצב המוצע (המצב היוצא) שבו מוקצית לך הזכות.</dd>
        </div>
        <div>
          <dt>ייעוד</dt>
          <dd>מה מותר לבנות על הקרקע לפי התכנית — למשל מגורים, מסחר או תעסוקה.</dd>
        </div>
        <div>
          <dt>שבר</dt>
          <dd>החלק שלך במגרש, כפי שמופיע בטבלת ההקצאה (לדוגמה 1/250).</dd>
        </div>
        <div>
          <dt>כמות</dt>
          <dd>כמה פעמים אותו שבר רשום על שמך, אם הוא מופיע ביותר מרישום אחד.</dd>
        </div>
        <div>
          <dt>סה״כ מגורים (מ״ר)</dt>
          <dd>שטח הבנייה למגורים שמגיע לחלק שלך, במטרים רבועים.</dd>
        </div>
        <div>
          <dt>זכות רעיונית לדירה</dt>
          <dd>
            מדד יחסי לגודל הזכות שלך, בערך של דירות. זו אינה דירה בפועל — כדי להפוך זכות לדירה ממשית
            צריך להוסיף עלויות בנייה, והתנאים נקבעים בהתקשרות מול היזם (תנאי הקומבינציה, בנק הדירות
            וכד׳).
          </dd>
        </div>
        {showCommercial && (
          <div>
            <dt>{COMMERCIAL_LABEL}</dt>
            <dd>
              שטח הבנייה למסחר ולתעסוקה שמגיע לחלק שלך, במטרים רבועים. כולל:{' '}
              {dataset.commercialNote}
            </dd>
          </div>
        )}
        <div>
          <dt>{VALUE_LABEL}</dt>
          <dd>
            החלק שלך כפול שווי המגרש כפי שנקבע בטבלת השמאי (״סה״כ שווי המגרש״). זהו ערך יחסי מתוך
            הטבלה בלבד — לא שומה ולא מחיר שוק.
          </dd>
        </div>
      </dl>
    </div>
  );
}
