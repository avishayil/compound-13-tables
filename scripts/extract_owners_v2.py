#!/usr/bin/env python3
"""חילוץ נתוני הבעלים של גרסה v2 (עדכון לפי סעיף 106(ב), נובמבר 2026) אל
public/data/v2/owners.csv — בצורה אנונימית (hashes בלבד, כמו ב-extract_owners_v1.py).

מקור: sources/v2/named_tables.pdf (טבלת ההקצאה והאיזון, 12 עמ׳ A3, מופק מאקסל).
הקובץ מכיל שמות ומספרי זהות ולכן הוא ב-.gitignore ומחוץ ל-public/ (כדי שלא ייכלל ב-build).

מבנה ה-PDF: שורה לכל בעלים/חוכר במצב הנכנס. לכל שורה אחת או יותר "תתי-שורות" במצב
היוצא (מגרש + שבר + שווי). גבולות השורות נקבעים לפי קווי ההפרדה האופקיים (rects בגובה
<1pt) שחוצים את עמודת שם הבעלים — ולא לפי קרבת טקסט, כי תוכן התא ממורכז אנכית ותת-שורה
עשויה להיות קרובה יותר לבעלים הקודם. העמודות נקבעות לפי קווי ההפרדה האנכיים.

הטקסט העברי שמור בסדר חזותי: בכל שורת טקסט ממיינים תווים לפי x יורד ואז הופכים חזרה
רצפים LTR (ספרות/לטינית). מספרי זהות ממוינים לפי x עולה.

אימות (נכשל = יציאה עם קוד 1, ללא כתיבת הקובץ):
  * סכום השברים בכל מגרש = 1 בדיוק (Fraction).
  * שבר × שווי המגרש (plots.csv) ≈ שווי הזכות המודפס (±2 ₪).
  * שטח המגרש בתת-השורה = שטח המגרש ב-plots.csv.
  * כל מגרש בהחזקות קיים ב-plots.csv, וכל מגרש ב-plots.csv מוקצה.

שימוש (pdfplumber נדרש, למשל ב-venv):
  python -I scripts/extract_owners_v2.py
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

PDF_PATH = "sources/v2/named_tables.pdf"
PLOTS_CSV = "public/data/v2/plots.csv"
CSV_PATH = "public/data/v2/owners.csv"

# גבולות העמודות (x) לפי קווי הטבלה — זהים בכל העמודים (נבדק בזמן ריצה).
COLS = {
    "owner_name": (1006, 1052),
    "owner_id": (969, 1006),
    "lessee_name": (929, 969),
    "lessee_id": (892, 929),
    "lot": (350, 375),
    "lot_area": (325, 350),
    "value": (185, 229),
    "fraction": (131, 185),
}
EXPECTED_VERTICALS = {131, 185, 229, 325, 350, 375, 892, 929, 969, 1006, 1052}


def parse_page(page, page_no):
    missing = EXPECTED_VERTICALS - verticals(page)

    # גבול עליון/תחתון של אזור הנתונים: תחתית כותרת הטבלה ותחתית הקווים האנכיים
    header = find_header(page, 1159, 30, page_no)
    data_top = header["bottom"]
    data_bottom = max(r["bottom"] for r in page.rects if r["height"] > 50)
    if missing:
        # עמוד הסיכום (12): אין עמודות שבר/שווי. מוודאים שאין בו שברים כדי לא לפספס החזקות.
        left = "".join(
            c["text"]
            for c in sorted(page.chars, key=lambda c: (round(c["top"]), c["x0"]))
            if c["x0"] < 375 and c["top"] > data_top
        )
        if re.search(r"\d+/\d+", left):
            raise SystemExit(
                f"page {page_no}: column borders changed (missing {sorted(missing)}) but fractions found"
            )
        return []

    bands = []
    for y0, band in owner_bands(page, COLS["owner_name"], data_top, data_bottom):

        def col_chars(col):
            return [c for c in band if in_col(c, COLS[col])]

        holdings = []
        frac_lines = text_lines(col_chars("fraction"))
        value_lines = text_lines(col_chars("value"))
        area_lines = text_lines(col_chars("lot_area"))
        for top, lot in text_lines(col_chars("lot")):
            if not re.fullmatch(r"\d+[AB]?", lot):
                continue
            frac = at(frac_lines, top)
            if not re.fullmatch(r"\d+/\d+", frac):
                raise SystemExit(f"page {page_no}: lot {lot} at y={top} has no fraction ({frac!r})")
            where = f"page {page_no} lot {lot} y={top}"
            value = parse_number(at(value_lines, top), f"{where} value") or 0
            area = parse_number(at(area_lines, top), f"{where} area") or 0
            holdings.append({"lot": lot, "fraction": frac, "value": value, "area": area})

        bands.append(
            {
                "page": page_no,
                "y": y0,
                "name": cell_text(col_chars("owner_name")),
                "owner_id": ltr_text(col_chars("owner_id")),
                "lessee": cell_text(col_chars("lessee_name")),
                "lessee_id": ltr_text(col_chars("lessee_id")),
                "holdings": holdings,
            }
        )
    return bands


def main():
    with open(PLOTS_CSV, encoding="utf-8-sig", newline="") as f:
        plots = {r[0]: r for r in list(csv.reader(f))[1:]}

    bands = []
    with pdfplumber.open(PDF_PATH) as pdf:
        for i, page in enumerate(pdf.pages, start=1):
            bands.extend(parse_page(page, i))

    errors = []
    rows = []  # (nameHash, idHash, altNameHash, altIdHash, lot, fraction)
    by_lot = defaultdict(Fraction)
    value_by_lot = defaultdict(int)
    owners = set()
    for b in bands:
        name, lessee = clean(b["name"]), clean(b["lessee"])
        oid, lid = normalize_id(b["owner_id"]), normalize_id(b["lessee_id"])
        if not b["holdings"]:
            continue
        if not name and not lessee:
            errors.append(f"page {b['page']} y={b['y']}: holdings without an owner name")
            continue
        name_hash = sha(normalize_name(name)) if name else ""
        id_hash = sha(oid) if oid else ""
        alt_name_hash = sha(normalize_name(lessee)) if lessee else ""
        alt_id_hash = sha(lid) if lid else ""
        owners.add((name_hash, id_hash, alt_name_hash, alt_id_hash))
        for h in b["holdings"]:
            lot = h["lot"]
            if lot not in plots:
                errors.append(f"page {b['page']}: lot {lot} not in {PLOTS_CSV}")
                continue
            lot_value = int(plots[lot][8])
            frac = Fraction(h["fraction"])
            if abs(frac * lot_value - h["value"]) > 2:
                errors.append(
                    f"page {b['page']}: lot {lot} {h['fraction']} × {lot_value:,} != printed {h['value']:,}"
                )
            if h["area"] != int(plots[lot][1]):
                errors.append(f"page {b['page']}: lot {lot} area {h['area']} != plots.csv {plots[lot][1]}")
            by_lot[lot] += frac
            value_by_lot[lot] += h["value"]
            rows.append((name_hash, id_hash, alt_name_hash, alt_id_hash, lot, h["fraction"]))

    for lot, total in by_lot.items():
        if total != 1:
            errors.append(f"lot {lot}: fractions sum to {total} ({float(total):.6f}), expected 1")
        if abs(value_by_lot[lot] - int(plots[lot][8])) > 10:
            errors.append(f"lot {lot}: holding values sum {value_by_lot[lot]:,} != lot value {plots[lot][8]}")
    unallocated = set(plots) - set(by_lot)
    if unallocated:
        errors.append(f"lots with no holdings: {sorted(unallocated)}")

    if errors:
        print("\n".join(errors), file=sys.stderr)
        print(f"{len(errors)} validation errors — {CSV_PATH} NOT written", file=sys.stderr)
        sys.exit(1)

    with open(CSV_PATH, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["nameHash", "idHash", "altNameHash", "altIdHash", "plotId", "fraction"])
        w.writerows(rows)

    with_lessee = sum(1 for o in owners if o[2])
    print(
        f"wrote {CSV_PATH}: {len(rows)} holdings, {len(owners)} owner rows "
        f"({with_lessee} with a lessee), {len(by_lot)} lots — all lots sum to 1, values match"
    )


if __name__ == "__main__":
    main()
