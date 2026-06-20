import type { ComputedRow } from '../lib/rows';
import type { RightsResult } from '../lib/calc';
import { roundArea, roundUnits } from '../lib/calc';
import { downloadCsv } from '../lib/csv';

interface Props {
  rows: ComputedRow[];
}

const fmtArea = (v: number) => roundArea(v).toLocaleString('he-IL', { maximumFractionDigits: 2 });
const fmtUnits = (v: number) => roundUnits(v).toLocaleString('he-IL', { maximumFractionDigits: 4 });

function emptyResult(): RightsResult {
  return {
    effectiveShare: 0,
    sharePercent: 0,
    relativeLandArea: 0,
    relativeResidentialArea: 0,
    equivalentUnits: 0,
    relativeCommercialGround: 0,
    relativeCommercialFirst: 0,
    relativeCommercialTotal: 0,
    relativeTotalBuildRights: 0,
  };
}

function sumResults(rows: ComputedRow[]): RightsResult {
  return rows.reduce((acc, row) => {
    const r = row.result;
    acc.effectiveShare += r.effectiveShare;
    acc.sharePercent += r.sharePercent;
    acc.relativeLandArea += r.relativeLandArea;
    acc.relativeResidentialArea += r.relativeResidentialArea;
    acc.equivalentUnits += r.equivalentUnits;
    acc.relativeCommercialGround += r.relativeCommercialGround;
    acc.relativeCommercialFirst += r.relativeCommercialFirst;
    acc.relativeCommercialTotal += r.relativeCommercialTotal;
    acc.relativeTotalBuildRights += r.relativeTotalBuildRights;
    return acc;
  }, emptyResult());
}

/** האם המגרשים בתוצאות כוללים זכויות מסחר/תעסוקה כלשהן. */
function hasAnyCommercial(rows: ComputedRow[]): boolean {
  return rows.some(
    (row) =>
      row.lot.commercialGroundFloorArea > 0 || row.lot.commercialFirstFloorArea > 0,
  );
}

export default function ResultsTable({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <div className="card">
        <h2>תוצאות</h2>
        <p className="empty">אין תוצאות להצגה. הזן שבר זכות תקין כדי לראות חישוב.</p>
      </div>
    );
  }

  // קיבוץ לפי מגרש לצורך סיכומי ביניים
  const byLot = new Map<number, ComputedRow[]>();
  for (const row of rows) {
    const list = byLot.get(row.lot.id) ?? [];
    list.push(row);
    byLot.set(row.lot.id, list);
  }
  const lotIds = [...byLot.keys()].sort((a, b) => a - b);
  const showLotSummaries = lotIds.length > 1 || (byLot.get(lotIds[0])?.length ?? 0) > 1;

  const grand = sumResults(rows);
  const showCommercial = hasAnyCommercial(rows);

  // מספר העמודות שהתווית בשורות הסיכום מתפרשת עליהן (ייעוד + שבר + כמות)
  const labelSpan = 3;

  return (
    <div className="card">
      <div className="results-head">
        <h2>תוצאות</h2>
        <button type="button" className="btn-csv" onClick={() => downloadCsv(rows)}>
          ⬇ ייצוא CSV
        </button>
      </div>

      <table className="results-table">
        <thead>
          <tr>
            <th>ייעוד</th>
            <th>שבר</th>
            <th>כמות</th>
            <th>סה״כ מגורים (מ״ר)</th>
            <th>זכות רעיונית לדירה</th>
            {showCommercial && <th>סה״כ מסחר (מ״ר)</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const r = row.result;
            return (
              <tr key={row.id}>
                <td data-label="ייעוד">{row.lot.zoning}</td>
                <td data-label="שבר">{row.shareInput}</td>
                <td data-label="כמות">{row.quantity}</td>
                <td data-label="סה״כ מגורים (מ״ר)">{fmtArea(r.relativeResidentialArea)}</td>
                <td data-label="זכות רעיונית לדירה">{fmtUnits(r.equivalentUnits)}</td>
                {showCommercial && (
                  <td data-label="סה״כ מסחר (מ״ר)">{fmtArea(r.relativeCommercialTotal)}</td>
                )}
              </tr>
            );
          })}

          {showLotSummaries &&
            lotIds.map((lotId) => {
              const list = byLot.get(lotId)!;
              const s = sumResults(list);
              return (
                <tr key={`sum-${lotId}`} className="row-subtotal">
                  <td data-label="סיכום" colSpan={labelSpan}>
                    סיכום מגרש {lotId}
                  </td>
                  <td data-label="סה״כ מגורים (מ״ר)">{fmtArea(s.relativeResidentialArea)}</td>
                  <td data-label="זכות רעיונית לדירה">{fmtUnits(s.equivalentUnits)}</td>
                  {showCommercial && (
                    <td data-label="סה״כ מסחר (מ״ר)">{fmtArea(s.relativeCommercialTotal)}</td>
                  )}
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
              <td data-label="סה״כ מסחר (מ״ר)">{fmtArea(grand.relativeCommercialTotal)}</td>
            )}
          </tr>
        </tbody>
      </table>

      <dl className="results-legend">
        <div>
          <dt>ייעוד</dt>
          <dd>מה מותר לבנות על הקרקע לפי התכנית — למשל מגורים, מסחר או תעסוקה.</dd>
        </div>
        <div>
          <dt>שבר</dt>
          <dd>חלק הבעלות שלך במגרש, כפי שרשום בטאבו (לדוגמה 1/250).</dd>
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
            מדד יחסי לגודל הזכות שלך, בערך של דירות. זו אינה דירה בפועל — כדי להפוך זכות
            לדירה ממשית צריך להוסיף עלויות בנייה, והתנאים נקבעים בהתקשרות מול היזם (תנאי
            הקומבינציה, בנק הדירות וכד׳).
          </dd>
        </div>
        {showCommercial && (
          <div>
            <dt>סה״כ מסחר (מ״ר)</dt>
            <dd>שטח הבנייה למסחר ולתעסוקה שמגיע לחלק שלך, במטרים רבועים.</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
