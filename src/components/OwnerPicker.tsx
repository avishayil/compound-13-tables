import { useState } from 'react';
import { getHoldingsByHash, type OwnerHolding } from '../data/owners';
import { normalizeId, normalizeName, sha256Hex } from '../lib/hash';

interface Props {
  /** נקרא עם כל ההחזקות המאוחדות של הבעלים שנוספו (ריק = אין). */
  onResult: (holdings: OwnerHolding[]) => void;
}

type SearchMode = 'name' | 'id';

/** בעלים שנוסף לרשימה: התווית שהמשתמש הקליד, זהות הבעלים, וההחזקות. */
interface AddedOwner {
  key: string;
  label: string;
  holdings: OwnerHolding[];
}

/**
 * זהות הבעלים = שילוב ה-hash של השם וה-hash של הת.ז.
 * משמש למניעת הוספה כפולה של אותו בעלים (גם אם נוסף פעם לפי שם ופעם לפי ת.ז.).
 * הערה: החזקות כפולות *בתוך* אותו בעלים הן לגיטימיות (זכויות נפרדות) ונשמרות כפי שהן.
 */
function ownerIdentity(holdings: OwnerHolding[]): string {
  const first = holdings[0];
  return `${first.nameHash}|${first.idHash}`;
}

export default function OwnerPicker({ onResult }: Props) {
  const [mode, setMode] = useState<SearchMode>('name');
  const [text, setText] = useState('');
  const [owners, setOwners] = useState<AddedOwner[]>([]);
  const [status, setStatus] = useState<'idle' | 'notfound' | 'duplicate'>('idle');

  /**
   * מאחד את כל ההחזקות של הבעלים שנוספו ומדווח למעלה.
   * אין מסירת כפילויות ברמת ההחזקה — שורות כפולות לאותו בעלים הן זכויות נפרדות לגיטימיות.
   * הוספה כפולה של אותו בעלים נמנעת מראש (לפי זהות הבעלים) בעת ההוספה.
   */
  const publish = (list: AddedOwner[]) => {
    onResult(list.flatMap((o) => o.holdings));
  };

  const handleAdd = async () => {
    const raw = text.trim();
    if (raw === '') {
      setStatus('idle');
      return;
    }
    const normalized = mode === 'name' ? normalizeName(raw) : normalizeId(raw);
    const hash = await sha256Hex(normalized);
    const holdings = getHoldingsByHash(hash);

    if (holdings.length === 0) {
      setStatus('notfound');
      return;
    }
    // מניעת הוספה כפולה של אותו בעלים — גם אם נוסף פעם לפי שם ופעם לפי ת.ז.
    const identity = ownerIdentity(holdings);
    if (owners.some((o) => o.key === identity)) {
      setStatus('duplicate');
      setText('');
      return;
    }

    const next = [...owners, { key: identity, label: raw, holdings }];
    setOwners(next);
    publish(next);
    setText('');
    setStatus('idle');
  };

  const handleRemoveOwner = (key: string) => {
    const next = owners.filter((o) => o.key !== key);
    setOwners(next);
    publish(next);
  };

  /** מספר המגרשים הייחודיים שבהם לבעלים יש זכויות. */
  const countPlots = (holdings: OwnerHolding[]) => new Set(holdings.map((h) => h.plotId)).size;

  // מספר המגרשים הייחודיים על פני כל הבעלים שנוספו
  const totalPlots = countPlots(owners.flatMap((o) => o.holdings));

  /** ניסוח עברי תקין: "מגרש אחד" / "N מגרשים". */
  const plotsLabel = (n: number) => (n === 1 ? 'מגרש אחד' : `${n} מגרשים`);

  return (
    <div className="card">
      <h2>חיפוש לפי שם או ת.ז.</h2>

      <p className="owner-hint">
        החיפוש מתבצע על המכשיר שלכם בלבד. השמות ומספרי הזהות אינם נשמרים באפליקציה — נשמרת רק חתימה
        מוצפנת (hash), כך שאין חשיפה של פרטים אישיים. אפשר להוסיף כמה בעלים יחד (למשל בני זוג) והחישוב
        יסכם את כולם.
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
          {owners.map((o) => (
            <span className="owner-chip" key={o.key}>
              <span className="owner-chip-label">
                {o.label} <small>({plotsLabel(countPlots(o.holdings))})</small>
              </span>
              <button
                type="button"
                onClick={() => handleRemoveOwner(o.key)}
                aria-label={`הסר ${o.label}`}
                title="הסר"
              >
                ✕
              </button>
            </span>
          ))}
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
    </div>
  );
}
