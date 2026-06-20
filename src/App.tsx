import { useMemo, useState } from 'react';
import RightsForm from './components/RightsForm';
import ResultsTable from './components/ResultsTable';
import OwnerPicker from './components/OwnerPicker';
import { getLotById, LOTS } from './data/lots';
import type { OwnerHolding } from './data/owners';
import { computeRow, isError, type ComputedRow, type RightRow, type RowError } from './lib/rows';

let rowCounter = 0;
function newRow(): RightRow {
  rowCounter += 1;
  return { id: `row-${rowCounter}`, lotId: LOTS[0].id, shareInput: '', quantity: '1' };
}

type Mode = 'fraction' | 'name';

/** מחשב את כל השורות התקינות ומחזיר תוצאות + שגיאות. */
function computeRows(rows: RightRow[]): { computed: ComputedRow[]; errors: RowError[] } {
  const computed: ComputedRow[] = [];
  const errors: RowError[] = [];
  for (const row of rows) {
    if (row.shareInput.trim() === '') continue; // דילוג על שורות ריקות
    const lot = getLotById(row.lotId);
    if (!lot) continue;
    const res = computeRow(row, lot);
    if (isError(res)) errors.push(res);
    else computed.push(res);
  }
  return { computed, errors };
}

export default function App() {
  const [mode, setMode] = useState<Mode>('name');

  // מצב "לפי שבר" — שורות שהמשתמש מזין ידנית
  const [rows, setRows] = useState<RightRow[]>([newRow()]);

  // מצב "לפי שם" — החזקות שנמצאו ע"פ hash, מומרות לשורות חישוב
  const [ownerRows, setOwnerRows] = useState<RightRow[]>([]);

  const manual = useMemo(() => computeRows(rows), [rows]);
  const owner = useMemo(() => computeRows(ownerRows), [ownerRows]);

  const handleChange = (id: string, patch: Partial<RightRow>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const handleAdd = () => setRows((prev) => [...prev, newRow()]);
  const handleRemove = (id: string) =>
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((r) => r.id !== id)));

  const handleOwnerResult = (holdings: OwnerHolding[]) => {
    // קיבוץ החזקות זהות (אותו מגרש + אותו שבר) לשורה אחת עם כמות מצטברת
    const grouped = new Map<string, { lotId: number; fraction: string; quantity: number }>();
    for (const h of holdings) {
      const key = `${h.plotId}|${h.fraction}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.quantity += 1;
      } else {
        grouped.set(key, { lotId: h.plotId, fraction: h.fraction, quantity: 1 });
      }
    }
    setOwnerRows(
      [...grouped.values()].map((g, i) => ({
        id: `owner-${i}`,
        lotId: g.lotId,
        shareInput: g.fraction,
        quantity: String(g.quantity),
      })),
    );
  };

  const activeComputed = mode === 'fraction' ? manual.computed : owner.computed;
  const errorByRowIndex = rows
    .map((row, index) => ({ index, error: manual.errors.find((e) => e.id === row.id) }))
    .filter((x) => x.error);

  return (
    <div className="app">
      <header className="app-header">
        <h1>מחשבון זכויות בנייה — מתחם 13 חדרה</h1>
        <p className="subtitle">
          קבלו חישוב יחסי של זכויות מגורים, מסחר ותעסוקה — לפי שם הבעלים או לפי שבר הזכות במגרש.
        </p>
      </header>

      <main>
        <div className="card instructions">
          <h2>איך זה עובד? 🙂</h2>
          <ol>
            <li>
              קודם מצאו את עצמכם בטבלאות:{' '}
              <a
                href="https://mavat.iplan.gov.il/SV4/1/3005361928/310"
                target="_blank"
                rel="noreferrer"
              >
                פתחו את אתר התכנית הרשמי (מבא"ת)
              </a>{' '}
              ונווטו אל: <strong>מסמכי התכנית</strong> ← <strong>מסמכים מופקדים</strong> ←{' '}
              <strong>נספחים</strong> ← <strong>טבלאות איזון והקצאה</strong>. שם, בעמודים 69–75,
              מופיעים שמות הבעלים — חפשו את שמכם.
            </li>
            <li>
              הדרך הקלה: בחרו <strong>״לפי שם״</strong> והקלידו את שמכם המלא (או מספר ת.ז.) — נמצא
              אוטומטית את כל המגרשים והשברים שלכם ונחשב הכול. אפשר להוסיף עוד בעלים (למשל בני זוג)
              והחישוב יסכם את כולם יחד.
            </li>
            <li>
              יודעים את השבר שלכם? בחרו <strong>״לפי שבר״</strong>, בחרו מגרש והקלידו את השבר (למשל
              1/250). אפשר להוסיף כמה שורות.
            </li>
            <li>
              לא מוצאים את עצמכם? נסו להקליד את השם בדיוק כפי שמופיע במסמכי התכנית (כולל סדר המילים),
              או חפשו לפי מספר ת.ז.
            </li>
          </ol>
        </div>

        <div className="card mode-card">
          <div className="mode-toggle mode-toggle-main" role="radiogroup" aria-label="מצב חישוב">
            <button
              type="button"
              role="radio"
              aria-checked={mode === 'name'}
              className={mode === 'name' ? 'active' : ''}
              onClick={() => setMode('name')}
            >
              לפי שם
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={mode === 'fraction'}
              className={mode === 'fraction' ? 'active' : ''}
              onClick={() => setMode('fraction')}
            >
              לפי שבר
            </button>
          </div>
        </div>

        {mode === 'name' ? (
          <OwnerPicker onResult={handleOwnerResult} />
        ) : (
          <>
            <RightsForm
              rows={rows}
              onChange={handleChange}
              onAdd={handleAdd}
              onRemove={handleRemove}
            />
            {errorByRowIndex.length > 0 && (
              <div className="card errors-card" role="alert">
                <h2>שגיאות קלט</h2>
                <ul>
                  {errorByRowIndex.map(({ index, error }) => (
                    <li key={error!.id}>
                      שורה {index + 1}: {error!.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        <ResultsTable rows={activeComputed} />
      </main>

      <footer className="disclaimer">
        <p>
          נתוני המגרשים מבוססים על חילוץ ל-CSV מתוך קובץ ה-PDF של טבלאות האיזון וההקצאה. נתוני
          הבעלים נשמרים באופן אנונימי בלבד (חתימת hash, ללא שמות או מספרי זהות גלויים). ניתן לאמת
          את נתוני המגרשים מול המקור:{' '}
          <a href={`${import.meta.env.BASE_URL}plots.pdf`} target="_blank" rel="noreferrer">
            PDF מגרשים
          </a>{' '}
          |{' '}
          <a href={`${import.meta.env.BASE_URL}plots.csv`} target="_blank" rel="noreferrer">
            CSV מגרשים
          </a>
          .
        </p>
        <p>
          החישוב באפליקציה הוא חישוב אריתמטי יחסי בלבד לפי הנתונים שהוזנו. הוא אינו מהווה שומה, ייעוץ
          משפטי, ייעוץ תכנוני או אישור תכנוני כלשהו.
        </p>
      </footer>
    </div>
  );
}
