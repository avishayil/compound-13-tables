import { useMemo, useState } from 'react';
import RightsForm from './components/RightsForm';
import ResultsTable from './components/ResultsTable';
import OwnerPicker, { type AddedOwner } from './components/OwnerPicker';
import VersionCompare from './components/VersionCompare';
import { DATASETS, DEFAULT_VERSION, VERSION_IDS, ownerRows, type VersionId } from './data/datasets';
import { computeRows, type RightRow } from './lib/rows';

const MAVAT_URL = 'https://mavat.iplan.gov.il/SV4/1/3005361928/310';

let rowCounter = 0;
function newRow(version: VersionId): RightRow {
  rowCounter += 1;
  return {
    id: `row-${rowCounter}`,
    lotId: DATASETS[version].lots[0].id,
    shareInput: '',
    quantity: '1',
  };
}

type Mode = 'fraction' | 'name';

/** איפה מוצאים את השמות בכל גרסה — הצעד הראשון בהוראות. */
function findYourselfStep(version: VersionId) {
  const link = (
    <a href={MAVAT_URL} target="_blank" rel="noreferrer">
      פתחו את אתר התכנית הרשמי (מבא"ת)
    </a>
  );
  if (version === 'v1') {
    return (
      <li>
        קודם מצאו את עצמכם בטבלאות: {link} ונווטו אל: <strong>מסמכי התכנית</strong> ←{' '}
        <strong>מסמכים מופקדים</strong> ← <strong>נספחים</strong> ←{' '}
        <strong>טבלאות איזון והקצאה</strong>. שם, בעמודים 69–75, מופיעים שמות הבעלים — חפשו את שמכם.
      </li>
    );
  }
  return (
    <li>
      קודם מצאו את עצמכם בטבלאות: {link} ופתחו את <strong>טבלאות האיזון וההקצאה</strong> המעודכנות
      (עדכון לפי סעיף 106(ב), נובמבר 2026 — קובץ של 12 עמודים). חפשו את שמכם בעמודות{' '}
      <strong>שם הבעלים</strong> או <strong>שם החוכר</strong>.
    </li>
  );
}

export default function App() {
  const [mode, setMode] = useState<Mode>('name');
  const [version, setVersion] = useState<VersionId>(DEFAULT_VERSION);
  const dataset = DATASETS[version];

  // מצב "לפי שבר" — שורות שהמשתמש מזין ידנית (מגרשים שונים בכל גרסה)
  const [rows, setRows] = useState<RightRow[]>([newRow(DEFAULT_VERSION)]);

  // מצב "לפי שם" — בעלים שנוספו (לפי hash); ההחזקות נגזרות מהגרסה הפעילה
  const [owners, setOwners] = useState<AddedOwner[]>([]);

  const manual = useMemo(() => computeRows(dataset, rows), [dataset, rows]);
  const owner = useMemo(
    () =>
      ownerRows(
        version,
        owners.map((o) => o.hash),
      ),
    [version, owners],
  );

  const handleVersion = (next: VersionId) => {
    if (next === version) return;
    setVersion(next);
    // מספרי המגרשים שונים בין הגרסאות — השורות הידניות מתאפסות
    setRows([newRow(next)]);
  };

  const handleChange = (id: string, patch: Partial<RightRow>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const handleAdd = () => setRows((prev) => [...prev, newRow(version)]);
  const handleRemove = (id: string) =>
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((r) => r.id !== id)));

  const base = import.meta.env.BASE_URL;

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
            {findYourselfStep(version)}
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
              יש שתי גרסאות של הטבלאות: <strong>המופקדת</strong> (יוני 2026) ו
              <strong>העדכון לפי סעיף 106(ב)</strong> (נובמבר 2026), שבו חלק מהמגרשים פוצלו (למשל
              40A ו-40B). בחרו גרסה למעלה — בחיפוש לפי שם תוצג גם השוואה בין הגרסאות.
            </li>
            <li>
              לא מוצאים את עצמכם? נסו להקליד את השם בדיוק כפי שמופיע במסמכי התכנית (כולל סדר
              המילים), או חפשו לפי מספר ת.ז.
            </li>
          </ol>
        </div>

        <div className="card version-card">
          <p className="version-title">גרסת הטבלאות</p>
          <div className="mode-toggle" role="radiogroup" aria-label="גרסת הטבלאות">
            {VERSION_IDS.map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={version === v}
                className={version === v ? 'active' : ''}
                onClick={() => handleVersion(v)}
              >
                {DATASETS[v].label}
              </button>
            ))}
          </div>
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
          <OwnerPicker version={version} owners={owners} onChange={setOwners} />
        ) : (
          <>
            <RightsForm
              dataset={dataset}
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

        <ResultsTable rows={activeComputed} dataset={dataset} />

        {mode === 'name' && <VersionCompare owners={owners} />}
      </main>

      <footer className="disclaimer">
        <p>
          נתוני המגרשים מבוססים על חילוץ ל-CSV מתוך קובץ ה-PDF של טבלאות האיזון וההקצאה. נתוני
          הבעלים נשמרים באופן אנונימי בלבד (חתימת hash, ללא שמות או מספרי זהות גלויים). ניתן לאמת את
          נתוני המגרשים מול המקור:
        </p>
        <ul className="sources">
          {VERSION_IDS.map((v) => (
            <li key={v}>
              {DATASETS[v].label}:{' '}
              <a href={`${base}${DATASETS[v].sources.plotsPdf}`} target="_blank" rel="noreferrer">
                PDF מגרשים
              </a>{' '}
              |{' '}
              <a href={`${base}${DATASETS[v].sources.plotsCsv}`} target="_blank" rel="noreferrer">
                CSV מגרשים
              </a>
            </li>
          ))}
          <li>
            תשריט מצב מוצע (106(ב)):{' '}
            <a href={`${base}maps/proposed-1.pdf`} target="_blank" rel="noreferrer">
              גיליון 1
            </a>{' '}
            |{' '}
            <a href={`${base}maps/proposed-2.pdf`} target="_blank" rel="noreferrer">
              גיליון 2
            </a>
          </li>
        </ul>
        <p>
          בגרסת 106(ב) נתוני המגרשים הוקלדו מתוך טבלת השמאי (שמופיעה כתמונה ב-PDF) ואומתו מול שורת
          הסיכום ומול שווי הזכויות בטבלת ההקצאה. השווי היחסי (₪) הוא החלק במגרש כפול שווי המגרש
          בטבלה — אינו שומה.
        </p>
        <p>
          החישוב באפליקציה הוא חישוב אריתמטי יחסי בלבד לפי הנתונים שהוזנו. הוא אינו מהווה שומה,
          ייעוץ משפטי, ייעוץ תכנוני או אישור תכנוני כלשהו.
        </p>
      </footer>
    </div>
  );
}
