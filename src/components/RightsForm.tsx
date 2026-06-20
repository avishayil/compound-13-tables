import { LOTS } from '../data/lots';
import type { RightRow } from '../lib/rows';

interface Props {
  rows: RightRow[];
  onChange: (id: string, patch: Partial<RightRow>) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}

export default function RightsForm({ rows, onChange, onAdd, onRemove }: Props) {
  return (
    <div className="card">
      <h2>הזנת זכויות</h2>
      <div className="rows">
        {rows.map((row, index) => (
          <div className="right-row" key={row.id}>
            <span className="row-number">{index + 1}</span>

            <label className="field">
              <span>מגרש</span>
              <select
                value={row.lotId}
                onChange={(e) => onChange(row.id, { lotId: Number(e.target.value) })}
              >
                {LOTS.map((lot) => (
                  <option key={lot.id} value={lot.id}>
                    מגרש {lot.id} — {lot.zoning}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>שבר זכות</span>
              <input
                type="text"
                inputMode="text"
                placeholder="לדוגמה: 1/250"
                value={row.shareInput}
                onChange={(e) => onChange(row.id, { shareInput: e.target.value })}
              />
            </label>

            <label className="field field-narrow">
              <span>כמות חזרות</span>
              <input
                type="number"
                min="1"
                step="1"
                value={row.quantity}
                onChange={(e) => onChange(row.id, { quantity: e.target.value })}
              />
            </label>

            <button
              type="button"
              className="btn-remove"
              onClick={() => onRemove(row.id)}
              disabled={rows.length === 1}
              aria-label="הסר שורה"
              title="הסר שורה"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <button type="button" className="btn-add" onClick={onAdd}>
        + הוסף זכות נוספת
      </button>
    </div>
  );
}
