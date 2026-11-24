#!/usr/bin/env python3
"""חילוץ נתוני הבעלים של גרסה v1 (מופקדת, יוני 2026) אל public/data/v1/owners.csv —
בצורה אנונימית (hashes בלבד).

מקור: sources/v1/principles.pdf — מסמך העקרונות "חתום להפקדה" (81 עמ׳). טבלת ההקצאה עם
השמות נמצאת בעמ׳ 69–75. הקובץ מכיל שמות ומספרי זהות ולכן הוא ב-.gitignore ומחוץ ל-public/.

מבנה הטבלה: שורה לכל בעלים במצב הנכנס; במצב היוצא עד 5 "משבצות" זו לצד זו (מגרש 1..5),
בכל אחת: שבר, ייעוד, שטח ומספר מגרש. שבר "1" פירושו המגרש בשלמותו (נשמר כ-1/1).
הגופן ממפה את האות נ ל-'ð' (מתוקן ב-pdf_table.fix_glyphs).

(גרסה קודמת של הסקריפט קראה ייצוא מסובב של הטבלה ונעזרה בטווח-y קבוע לשם — מה שקטע שמות
ארוכים, לרוב את האות הראשונה, ולכן חלק מה-hashes של השמות היו שגויים. הגרסה הזו קוראת את
המסמך המקורי לפי גבולות התאים.)

אימות (נכשל = יציאה עם קוד 1, ללא כתיבת הקובץ):
  * סכום השברים בכל מגרש = 1 בדיוק (Fraction), וכל 52 המגרשים מוקצים.
  * לכל בעלים: Σ שבר × שווי המגרש (plots.csv) ≈ "שווי הזכויות במגרשי התמורה" המודפס (±10 ₪).
  * מגרשים ציבוריים (עמ׳ 75: דרכים/שב"צ/שצ"פ שמוקצים לרשות) אינם ב-plots.csv ומדולגים.
  * הערה (לא חוסם): שטחי מגרשים בטבלת ההקצאה שונים במעט מטבלת השווי בעמ׳ 67.

שימוש (pdfplumber נדרש, למשל ב-venv):
  python -I scripts/extract_owners_v1.py
"""
import csv
import os
import re
import sys
from collections import defaultdict
from fractions import Fraction

import pdfplumber

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from owner_hash import normalize_id, normalize_name, sha  # noqa: E402
from pdf_table import (  # noqa: E402
    at,
    cell_text,
    clean,
    find_header,
    in_col,
    ltr_text,
    owner_bands,
    parse_number,
    text_lines,
    verticals,
)

PDF_PATH = "sources/v1/principles.pdf"
PAGES = range(69, 76)  # עמודי טבלת ההקצאה עם השמות (1-based)
PLOTS_CSV = "public/data/v1/plots.csv"
CSV_PATH = "public/data/v1/owners.csv"

OWNER_NAME = (1054, 1083)
OWNER_ID = (1026, 1054)
TOTAL_VALUE = (83, 109)
# (מגרש, שטח, שבר) לכל אחת מ-5 המשבצות
SLOTS = [
    ((652, 670), (633, 652), (557, 597)),
    ((537, 557), (517, 537), (439, 482)),
    ((421, 439), (402, 421), (325, 365)),
    ((304, 325), (283, 304), (210, 248)),
    ((189, 210), (168, 189), (109, 147)),
]
# המגרשים הציבוריים (דרכים, שב"צ, שצ"פ) שמוקצים לרשות בעמ׳ 75 — אינם ב-plots.csv.
# כל מגרש אחר שאינו ב-plots.csv הוא שגיאת קריאה ונכשל.
PUBLIC_LOTS = {str(n) for n in [*range(1, 11), *range(12, 16), 20, 21, 22, 24, 25, 26, *range(28, 38)]} | {
    str(n) for n in range(200, 209)
}
EXPECTED_VERTICALS = {x for slot in SLOTS for col in slot for x in col} | {
    *OWNER_NAME,
    *OWNER_ID,
    *TOTAL_VALUE,
}


def parse_page(page, page_no):
    missing = EXPECTED_VERTICALS - verticals(page)
    if missing:
        raise SystemExit(f"page {page_no}: column borders changed, missing {sorted(missing)}")
    header = find_header(page, 1158, 25, page_no)
    data_top = header["bottom"]
    data_bottom = max(r["bottom"] for r in page.rects if r["height"] > 50)

    out = []
    for y0, band in owner_bands(page, OWNER_NAME, data_top, data_bottom):

        def col(c_range):
            return [c for c in band if in_col(c, c_range)]

        holdings = []
        for lot_col, area_col, frac_col in SLOTS:
            frac_lines = [ln for ln in text_lines(col(frac_col)) if ln[1]]
            area_lines = [ln for ln in text_lines(col(area_col)) if ln[1]]
            lot_lines = [ln for ln in text_lines(col(lot_col)) if re.fullmatch(r"\d+", ln[1])]
            # תוכן התאים ממורכז אנכית ועשוי להיות מוסט בכמה נקודות: כשמספר השורות זהה,
            # משייכים לפי הסדר; אחרת לפי קרבת y.
            paired = len(frac_lines) == len(lot_lines) == len(area_lines)
            for i, (top, lot) in enumerate(lot_lines):
                frac = frac_lines[i][1] if paired else at(frac_lines, top)
                if frac == "1":
                    frac = "1/1"
                if not re.fullmatch(r"\d+/\d+", frac):
                    raise SystemExit(f"page {page_no}: lot {lot} at y={top} has no fraction ({frac!r})")
                area_text = area_lines[i][1] if paired else at(area_lines, top)
                area = parse_number(area_text) or 0
                holdings.append({"lot": lot, "fraction": frac, "area": area})

        total = parse_number(" ".join(t for _, t in text_lines(col(TOTAL_VALUE))))
        out.append(
            {
                "page": page_no,
                "y": y0,
                "name": cell_text(col(OWNER_NAME)),
                "owner_id": ltr_text(col(OWNER_ID)),
                "total": total,
                "holdings": holdings,
            }
        )
    return out


def main():
    with open(PLOTS_CSV, encoding="utf-8-sig", newline="") as f:
        plots = {r[0]: r for r in list(csv.reader(f))[1:]}

    bands = []
    with pdfplumber.open(PDF_PATH) as pdf:
        for n in PAGES:
            bands.extend(parse_page(pdf.pages[n - 1], n))

    errors = []
    area_mismatch = defaultdict(set)  # lot -> {area in allocation table}
    public_lots = set()
    rows = []  # (nameHash, idHash, plotId, fraction)
    by_lot = defaultdict(Fraction)
    owners = set()
    for b in bands:
        # מגרשים ציבוריים (דרכים, שב"צ, שצ"פ — מוקצים לרשות) אינם ב-plots.csv ואינם רלוונטיים למחשבון
        tradeable = [h for h in b["holdings"] if h["lot"] in plots]
        for h in b["holdings"]:
            if h["lot"] in plots:
                continue
            if h["lot"] in PUBLIC_LOTS and b["page"] == 75:
                public_lots.add(h["lot"])
            else:
                errors.append(f"page {b['page']} y={b['y']}: unknown lot {h['lot']} (not tradeable, not public)")
        if not tradeable:
            continue
        name = clean(b["name"])
        oid = normalize_id(b["owner_id"])
        if not name:
            errors.append(f"page {b['page']} y={b['y']}: holdings without an owner name")
            continue
        value = 0
        for h in tradeable:
            lot = h["lot"]
            if h["area"] != int(plots[lot][1]):
                area_mismatch[lot].add(h["area"])
            frac = Fraction(h["fraction"])
            by_lot[lot] += frac
            value += frac * int(plots[lot][8])
        if b["total"] is None or abs(value - b["total"]) > 10:
            errors.append(
                f"page {b['page']} y={b['y']}: Σ fraction × lot value = {float(value):,.0f} "
                f"!= printed total {b['total']}"
            )
        name_hash = sha(normalize_name(name))
        id_hash = sha(oid) if oid else ""
        owners.add((name_hash, id_hash))
        for h in tradeable:
            rows.append((name_hash, id_hash, h["lot"], h["fraction"]))

    if area_mismatch:
        # במסמך המופקד שטחי המגרשים בטבלת ההקצאה שונים במעט מטבלת השווי (עמ׳ 67) — לא חוסם,
        # כי המחשבון משתמש בשטחי עמ׳ 67 ואינו מציג שטח מגרש.
        print(
            "note: lot areas differ from plots.csv (p. 67): "
            + ", ".join(f"{lot}: {sorted(a)} vs {plots[lot][1]}" for lot, a in sorted(area_mismatch.items(), key=lambda kv: int(kv[0]))),
            file=sys.stderr,
        )

    for lot, total in by_lot.items():
        if total != 1:
            errors.append(f"lot {lot}: fractions sum to {total} ({float(total):.6f}), expected 1")
    unallocated = set(plots) - set(by_lot)
    if unallocated:
        errors.append(f"lots with no holdings: {sorted(unallocated, key=int)}")

    if errors:
        print("\n".join(errors), file=sys.stderr)
        print(f"{len(errors)} validation errors — {CSV_PATH} NOT written", file=sys.stderr)
        sys.exit(1)

    with open(CSV_PATH, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["nameHash", "idHash", "plotId", "fraction"])
        w.writerows(rows)

    print(
        f"wrote {CSV_PATH}: {len(rows)} holdings, {len(owners)} owner rows, {len(by_lot)} lots "
        f"— all lots sum to 1, owner totals match; skipped {len(public_lots)} public lots"
    )


if __name__ == "__main__":
    main()
