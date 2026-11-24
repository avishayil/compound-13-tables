import { useState } from 'react';
import { resolveHoldings, VERSION_IDS, type VersionId } from '../data/datasets';
import type { OwnerHolding } from '../data/owners';
import { normalizeId, normalizeName, sha256Hex } from '../lib/hash';

/** בעלים שנוסף לרשימה: התווית שהמשתמש הקליד וה-hash שחושב ממנה. */
export interface AddedOwner {
  /** מזהי הבעלים (hash של ת.ז., או של שם אם אין ת.ז.) בכל הגרסאות — למניעת הוספה כפולה */
  keys: string[];
  label: string;
  hash: string;
}

interface Props {
  /** הגרסה הפעילה — ההחזקות המוצגות בשבבים נלקחות ממנה */
  version: VersionId;
  owners: AddedOwner[];
  onChange: (owners: AddedOwner[]) => void;
}

type SearchMode = 'name' | 'id';

/**
 * מזהי הבעלים בכל הגרסאות: hash של ת.ז. (או של שם, אם אין ת.ז.) של כל החזקה שנמצאה.
 * משמש למניעת הוספה כפולה של אותו בעלים (גם אם נוסף פעם לפי שם ופעם לפי ת.ז.).
 * הערה: החזקות כפולות *בתוך* אותו בעלים הן לגיטימיות (זכויות נפרדות) ונשמרות כפי שהן.
 */
function ownerKeys(hash: string): string[] {
  const keys = new Set<string>();
  for (const v of VERSION_IDS) {
    for (const h of resolveHoldings(v, hash)) keys.add(h.idHash || h.nameHash);
  }
  return [...keys];
}

export default function OwnerPicker({ version, owners, onChange }: Props) {
  const [mode, setMode] = useState<SearchMode>('name');
  const [text, setText] = useState('');
  const [status, setStatus] = useState<'idle' | 'notfound' | 'duplicate' | 'otherversion'>('idle');

  const holdingsOf = (o: AddedOwner): OwnerHolding[] => resolveHoldings(version, o.hash);

  const handleAdd = async () => {
    const raw = text.trim();
    if (raw === '') {
      setStatus('idle');
      return;
    }
    const normalized = mode === 'name' ? normalizeName(raw) : normalizeId(raw);
    const hash = await sha256Hex(normalized);
    const keys = ownerKeys(hash);

    if (keys.length === 0) {
      setStatus('notfound');
      return;
    }
    // מניעת הוספה כפולה של אותו בעלים — גם אם נוסף פעם לפי שם ופעם לפי ת.ז.
    if (owners.some((o) => o.keys.some((k) => keys.includes(k)))) {
      setStatus('duplicate');
      setText('');
      return;
    }

    onChange([...owners, { keys, label: raw, hash }]);
    setText('');
    setStatus(resolveHoldings(version, hash).length === 0 ? 'otherversion' : 'idle');
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
      {status === 'otherversion' && (
        <p className="empty">
          הבעלים נמצא רק בגרסה האחרת של הטבלאות. החליפו גרסה למעלה כדי לראות את הזכויות.
        </p>
      )}
    </div>
  );
}
