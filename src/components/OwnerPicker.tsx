import { useState } from 'react';
import {
  hasExcludedNameRows,
  isAmbiguous,
  isDuplicate,
  isFound,
  resolveHoldings,
  type VersionId,
} from '../data/datasets';
import type { OwnerHolding } from '../data/owners';
import { normalizeId, normalizeName, sha256Hex } from '../lib/hash';

/** בעלים שנוסף לרשימה: התווית שהמשתמש הקליד וה-hash שחושב ממנה. */
export interface AddedOwner {
  label: string;
  hash: string;
  /** השם תואם ליותר ממספר זהות אחד — ייתכן שמדובר בכמה בעלים באותו שם */
  ambiguous: boolean;
  /** יש בטבלאות שורות בשמו בלי מספר זהות, שלא נכללו (אפשר להוסיפן בחיפוש לפי השם) */
  excludedNameRows: boolean;
}

interface Props {
  /** הגרסה הפעילה — ההחזקות המוצגות בשבבים נלקחות ממנה */
  version: VersionId;
  owners: AddedOwner[];
  onChange: (owners: AddedOwner[]) => void;
}

type SearchMode = 'name' | 'id';

export default function OwnerPicker({ version, owners, onChange }: Props) {
  const [mode, setMode] = useState<SearchMode>('name');
  const [text, setText] = useState('');
  const [status, setStatus] = useState<'idle' | 'notfound' | 'duplicate'>('idle');

  const holdingsOf = (o: AddedOwner): OwnerHolding[] => resolveHoldings(version, o.hash);

  const handleAdd = async () => {
    const raw = text.trim();
    if (raw === '') {
      setStatus('idle');
      return;
    }
    const normalized = mode === 'name' ? normalizeName(raw) : normalizeId(raw);
    const hash = await sha256Hex(normalized);
    if (!isFound(hash)) {
      setStatus('notfound');
      return;
    }
    // מניעת הוספה כפולה: בעלים שכבר ברשימה ומתייחס בדיוק לאותם צדדים בטבלאות (אותו hash, או
    // שם ות.ז. של אותו אדם). חוכר של בעלים שנוסף, או בעל שם זהה, ניתנים להוספה.
    if (
      isDuplicate(
        owners.map((o) => o.hash),
        hash,
      )
    ) {
      setStatus('duplicate');
      setText('');
      return;
    }

    onChange([
      ...owners,
      {
        label: raw,
        hash,
        ambiguous: isAmbiguous(hash),
        excludedNameRows: hasExcludedNameRows(hash),
      },
    ]);
    setText('');
    setStatus('idle');
  };

  const handleRemoveOwner = (hash: string) => {
    onChange(owners.filter((o) => o.hash !== hash));
  };

  /** מספר המגרשים הייחודיים שבהם לבעלים יש זכויות. */
  const countPlots = (holdings: OwnerHolding[]) => new Set(holdings.map((h) => h.plotId)).size;

  // מספר המגרשים הייחודיים על פני כל הבעלים שנוספו
  const totalPlots = countPlots(owners.flatMap(holdingsOf));

  /** ניסוח עברי תקין: "מגרש אחד" / "N מגרשים". */
  const plotsLabel = (n: number) => (n === 1 ? 'מגרש אחד' : `${n} מגרשים`);

  return (
    <div className="card">
      <h2>חיפוש לפי שם או ת.ז.</h2>

      <p className="owner-hint">
        החיפוש מתבצע על המכשיר שלכם בלבד. השמות ומספרי הזהות אינם נשמרים באפליקציה — נשמרת רק חתימה
        מוצפנת (hash), כך שאין חשיפה של פרטים אישיים. אפשר להוסיף כמה בעלים יחד (למשל בני זוג)
        והחישוב יסכם את כולם.
      </p>

      <div className="mode-toggle" role="radiogroup" aria-label="סוג חיפוש">
        <button
          type="button"
          role="radio"
          aria-checked={mode === 'name'}
          className={mode === 'name' ? 'active' : ''}
          onClick={() => setMode('name')}
        >
          לפי שם מלא
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={mode === 'id'}
          className={mode === 'id' ? 'active' : ''}
          onClick={() => setMode('id')}
        >
          לפי מספר ת.ז. / תאגיד
        </button>
      </div>

      <div className="owner-search-row">
        <label className="field">
          <span>{mode === 'name' ? 'שם מלא (כפי שמופיע בטבלאות)' : 'מספר ת.ז. / תאגיד'}</span>
          <input
            type="text"
            inputMode={mode === 'id' ? 'numeric' : 'text'}
            placeholder={mode === 'name' ? 'לדוגמה: כהן ישראל' : 'לדוגמה: 056215759'}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setStatus('idle');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
            }}
          />
        </label>
        <button type="button" className="btn-add" onClick={handleAdd}>
          {owners.length === 0 ? 'חיפוש' : '+ הוסף בעלים'}
        </button>
      </div>

      {owners.length > 0 && (
        <div className="owner-chips">
          {owners.map((o) => {
            const n = countPlots(holdingsOf(o));
            return (
              <span className="owner-chip" key={o.hash}>
                <span
                  className={n === 0 ? 'owner-chip-label owner-chip-missing' : 'owner-chip-label'}
                >
                  {o.label} <small>({n === 0 ? 'לא נמצא בגרסה זו' : plotsLabel(n)})</small>
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveOwner(o.hash)}
                  aria-label={`הסר ${o.label}`}
                  title="הסר"
                >
                  ✕
                </button>
              </span>
            );
          })}
        </div>
      )}

      {owners.length > 0 && (
        <p className="owner-selected">
          סה״כ {owners.length} בעלים, זכויות ב־{plotsLabel(totalPlots)}. התוצאות מוצגות למטה. ✨
        </p>
      )}
      {status === 'notfound' && (
        <p className="empty">
          לא נמצאה התאמה. ודאו שהשם מוקלד בדיוק כפי שמופיע בטבלאות (כולל סדר המילים), או נסו חיפוש
          לפי מספר ת.ז.
        </p>
      )}
      {status === 'duplicate' && <p className="empty">הבעלים הזה כבר נוסף לרשימה.</p>}
      {owners.some((o) => o.ambiguous) && (
        <p className="empty">
          השם{' '}
          {owners
            .filter((o) => o.ambiguous)
            .map((o) => `״${o.label}״`)
            .join(', ')}{' '}
          מופיע בטבלאות עם יותר ממספר זהות אחד — ייתכן שמדובר בכמה בעלים באותו שם, והחישוב כולל את
          כל השורות שבהן השם מופיע. לחישוב מדויק — הסירו אותו וחפשו לפי מספר ת.ז. (ואם תופיע הודעה
          על שורות בשמכם בלי ת.ז., בדקו אותן מול הטבלאות).
        </p>
      )}
      {owners.some((o) => o.excludedNameRows) && (
        <p className="empty">
          עבור{' '}
          {owners
            .filter((o) => o.excludedNameRows)
            .map((o) => `״${o.label}״`)
            .join(', ')}{' '}
          יש בטבלאות גם שורות באותו שם בלי מספר זהות, והן לא נכללו בחישוב (ייתכן שהן של אדם אחר
          באותו שם). אם הן שלכם — הוסיפו גם חיפוש לפי השם המלא.
        </p>
      )}
      {owners.some((o) => holdingsOf(o).length === 0) && (
        <p className="empty">
          חלק מהבעלים שנוספו (מסומנים בקו) נמצאו רק בגרסה האחרת של הטבלאות. החליפו גרסה למעלה כדי
          לראות את הזכויות שלהם.
        </p>
      )}
    </div>
  );
}
