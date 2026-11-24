"""כלים משותפים לקריאת טבלאות ההקצאה (מופקות מאקסל) עם pdfplumber.

הטבלאות בנויות משורה לכל בעלים במצב הנכנס. גבולות השורות נקבעים לפי קווי ההפרדה
האופקיים (rects בגובה <1pt) שחוצים את עמודת שם הבעלים — ולא לפי קרבת טקסט, כי תוכן התא
ממורכז אנכית ותת-שורה במצב היוצא עשויה להיות קרובה יותר לבעלים הקודם.

הטקסט העברי שמור בסדר חזותי: בכל שורת טקסט ממיינים תווים לפי x יורד ואז הופכים חזרה
רצפים LTR (ספרות/לטינית). מספרי זהות ממוינים לפי x עולה.
"""
import re
from collections import defaultdict

LTR_RUN = re.compile(r"[0-9A-Za-z.,/\-]+")

# תיקוני גליפים: בגרסה המופקדת הגופן ממפה את האות נ ל-'ð'
GLYPH_FIXES = {"ð": "נ"}


def fix_glyphs(s):
    for bad, good in GLYPH_FIXES.items():
        s = s.replace(bad, good)
    return s


def in_col(c, col):
    """האם מרכז התו נמצא בטווח ה-x של העמודה."""
    x0, x1 = col
    mid = (c["x0"] + c["x1"]) / 2
    return x0 < mid < x1


def text_lines(chars):
    """מקבץ תווים לשורות לפי top ומחזיר רשימת (top, text) בסדר לוגי (RTL)."""
    lines = defaultdict(list)
    for c in chars:
        lines[round(c["top"])].append(c)
    out = []
    for top in sorted(lines):
        cs = sorted(lines[top], key=lambda c: -c["x0"])
        s = fix_glyphs("".join(c["text"] for c in cs))
        s = LTR_RUN.sub(lambda m: m.group(0)[::-1], s)
        out.append((top, s.strip()))
    return out


def cell_text(chars):
    """טקסט תא מרובה שורות (שם), שורות מחוברות ברווח."""
    return " ".join(t for _, t in text_lines(chars) if t)


def ltr_text(chars):
    """טקסט LTR (מספר זהות): שורות מלמעלה למטה, תווים לפי x עולה."""
    lines = defaultdict(list)
    for c in chars:
        lines[round(c["top"])].append(c)
    return "".join(
        "".join(c["text"] for c in sorted(lines[t], key=lambda c: c["x0"])) for t in sorted(lines)
    )


def at(lines, top, tol=2):
    """הטקסט בשורה שגובהה קרוב ל-top (לשיוך עמודות שונות של אותה תת-שורה)."""
    hits = [t for y, t in lines if abs(y - top) <= tol]
    return hits[0] if hits else ""


def verticals(page, min_height=50):
    return {round(r["x0"]) for r in page.rects if r["height"] > min_height}


def owner_bands(page, name_col, data_top, data_bottom):
    """מחלק את אזור הנתונים לרצועות (שורת בעלים אחת לכל רצועה). מחזיר [(y0, chars)]."""
    seps = sorted(
        {
            round(r["top"], 1)
            for r in page.rects
            if r["height"] < 1
            and r["x0"] <= name_col[0] + 1
            and r["x1"] >= name_col[1] - 1
            and data_top - 1 <= r["top"] <= data_bottom + 1
        }
        | {round(data_top, 1), round(data_bottom, 1)}
    )
    chars = [c for c in page.chars if data_top < c["top"] < data_bottom]
    bands = []
    for y0, y1 in zip(seps, seps[1:]):
        if y1 - y0 < 2:
            continue
        band = [c for c in chars if y0 <= c["top"] < y1]
        if band:
            bands.append((y0, band))
    return bands


def clean(s):
    s = s.strip()
    return "" if s in {"", "-"} else s
