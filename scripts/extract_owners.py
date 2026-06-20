#!/usr/bin/env python3
"""חילוץ נתוני הבעלים מ-named_tables.pdf אל public/owners.csv — בצורה אנונימית.

פרטיות: הקובץ הציבורי לא מכיל שמות או מספרי זהות בטקסט גלוי. במקום זאת נשמרים
**hashes** (SHA-256) של השם ושל מספר הזהות, כך שחיפוש בצד-לקוח עובד (המשתמש מקליד את
שמו או ת.ז. המלאים, אנו מחשבים hash ומשווים) בלי לחשוף PII.

מבנה ה-PDF: כל בעלים הוא עמודה בטבלה; בעמודה עד 5 בלוקים אנכיים, אחד לכל מגרש שבו יש לו
זכויות. כל בלוק מכיל: שבר (החלק במגרש), ייעוד, שטח, ומספר המגרש. הטקסט מסובב 90° ו-RTL,
ויש watermark מסובב שמסונן לפי שם הפונט. תיקון גליף: 'ð' -> 'נ' (נון סופית).

אימות: סכום השברים של כל מגרש צריך להיות 1.0 בדיוק.
"""
import csv
import hashlib
import re
import sys
import unicodedata
from collections import defaultdict

import pdfplumber

PDF_PATH = "public/named_tables.pdf"
CSV_PATH = "public/owners.csv"

# טווחי-y (top) לכל אחד מ-5 ה-slots: (טווח השבר, טווח מספר המגרש)
SLOTS = [
    ((110, 133), (160, 171)),
    ((176, 197), (235, 247)),
    ((250, 273), (308, 319)),
    ((323, 346), (383, 395)),
    ((399, 420), (456, 468)),
]
NAME_BAND = (715, 729)
ID_BAND = (696, 711)


def normalize_name(name):
    """נרמול שם לפני hashing: רווחים מצומצמים, גרשיים אחידים."""
    name = unicodedata.normalize("NFKC", name)
    name = name.replace("״", '"').replace("׳", "'")
    return re.sub(r"\s+", " ", name).strip()


def normalize_id(raw):
    """נרמול מס׳ זהות: השארת ספרות/אותיות בלבד; ריק אם אין."""
    cleaned = re.sub(r"[^0-9A-Za-z]", "", raw)
    return cleaned or None


def sha(value):
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def parse_page(page):
    """מחזיר רשימת (name, id_raw, [(plotId, fraction), ...]) מעמוד אחד."""
    chars = [c for c in page.chars if "David" in c["fontname"]]

    by_x = defaultdict(list)
    for c in chars:
        by_x[round(c["x0"], 0)].append(c)
    keys = sorted(by_x)
    groups = []
    for k in keys:
        if groups and k - groups[-1][-1] <= 1.5:
            groups[-1].append(k)
        else:
            groups.append([k])

    out = []
    for grp in groups:
        col_chars = [c for k in grp for c in by_x[k]]

        def band(y0, y1):
            sub = sorted(
                (c for c in col_chars if y0 <= c["top"] <= y1),
                key=lambda c: c["top"],
            )
            return "".join(c["text"] for c in sub)

        name = band(*NAME_BAND)[::-1].strip().replace("ð", "נ")
        if not name or "שם הבעלים" in name:
            continue
        id_raw = band(*ID_BAND).strip()

        holdings = []
        for (fy0, fy1), (py0, py1) in SLOTS:
            mf = re.search(r"(\d+)/(\d+)", band(fy0, fy1))
            mp = re.search(r"\d+", band(py0, py1))
            if mf and mp:
                holdings.append((int(mp.group()), mf.group()))
        if holdings:
            out.append((name, id_raw, holdings))
    return out


def main():
    columns = []
    with pdfplumber.open(PDF_PATH) as pdf:
        for page in pdf.pages:
            columns.extend(parse_page(page))

    rows = []  # (name_hash, id_hash, plotId, fraction)
    id_count = 0
    for name, id_raw, holdings in columns:
        name_hash = sha(normalize_name(name))
        norm_id = normalize_id(id_raw)
        id_hash = sha(norm_id) if norm_id else ""
        if norm_id:
            id_count += 1
        for plot, frac in holdings:
            rows.append((name_hash, id_hash, plot, frac))

    # אימות שלמות: סכום השברים של כל מגרש ≈ 1.0
    by_plot = defaultdict(float)
    for _, _, plot, frac in rows:
        a, b = frac.split("/")
        by_plot[plot] += int(a) / int(b)
    bad = {p: round(s, 4) for p, s in by_plot.items() if not (0.999 < s < 1.001)}
    if bad:
        print(f"WARNING: plots whose fractions do not sum to 1.0: {bad}", file=sys.stderr)

    with open(CSV_PATH, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["nameHash", "idHash", "plotId", "fraction"])
        for name_hash, id_hash, plot, frac in rows:
            w.writerow([name_hash, id_hash, plot, frac])

    owners = len({r[0] for r in rows})
    print(
        f"wrote {CSV_PATH}: {len(rows)} holdings, {owners} owners, "
        f"{len(by_plot)} plots, {id_count} owner-columns had an id"
    )


if __name__ == "__main__":
    main()
