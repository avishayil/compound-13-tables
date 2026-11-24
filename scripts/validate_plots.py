#!/usr/bin/env python3
"""אימות plots.csv של כל גרסה מול שורת הסיכום המודפסת בטבלת השמאי.

v1 — מופקדת (יוני 2026): עמ׳ 67 במסמך העקרונות (public/data/v1/plots.pdf).
v2 — עדכון לפי סעיף 106(ב) (נובמבר 2026): עמ׳ 98–100 (public/data/v2/plots.pdf).
     נתוני v2 הוקלדו ידנית מתמונות הטבלה, ולכן האימות הזה הוא רשת הביטחון העיקרית.
     הצלבה נוספת (שטח/ייעוד/שווי מול טבלת ההקצאה) נעשית ב-extract_owners_v2.py.

שימוש: python3 -I scripts/validate_plots.py   (יוצא עם קוד 1 אם יש אי-התאמה)
"""
import csv
import sys

# עמודות: 3 מגורים, 4 יח״ד, 5 מסחר בק. קרקע, 6 מסחר/תעסוקה בקומות עליונות, 7 מב״צ, 8 שווי
EXPECTED = {
    "v1": {"count": 52, 3: 330_635, 4: 3_000, 5: 24_150, 6: 55_117, 7: 1_950, 8: 1_510_100_000},
    "v2": {"count": 58, 3: 353_323, 4: 3_216, 5: 16_947, 6: 53_587, 7: 1_950, 8: 1_467_770_000},
}
NAMES = {3: "מגורים", 4: "יח״ד", 5: "מסחר בק. קרקע", 6: "קומות עליונות", 7: "מב״צ", 8: "שווי"}

# עמודות שטח: הסיכום המודפס מחושב באקסל מערכים לא מעוגלים, בעוד שהתאים מוצגים מעוגלים
# למ״ר שלם — ולכן סכום התאים עשוי לסטות במעט (ב-v1, שתואם את ה-PDF תא-תא, הסטייה עד 3 מ״ר;
# המסמך עצמו כותב "כ-16,947 מ״ר"). יח״ד ושווי הם מספרים שלמים — נדרשת התאמה מדויקת.
AREA_TOLERANCE = {3: 5, 5: 5, 6: 5}


def main():
    ok = True
    for version, exp in EXPECTED.items():
        path = f"public/data/{version}/plots.csv"
        with open(path, encoding="utf-8-sig", newline="") as f:
            rows = list(csv.reader(f))[1:]
        ids = [r[0] for r in rows]
        if len(rows) != exp["count"]:
            print(f"{version}: expected {exp['count']} lots, got {len(rows)}")
            ok = False
        if len(set(ids)) != len(ids):
            print(f"{version}: duplicate lot ids")
            ok = False
        for col, name in NAMES.items():
            total = sum(int(r[col]) for r in rows)
            diff = total - exp[col]
            if abs(diff) > AREA_TOLERANCE.get(col, 0):
                print(f"{version}: {name} sum {total:,} != printed {exp[col]:,}")
                ok = False
            elif diff:
                print(f"{version}: {name} sum {total:,} vs printed {exp[col]:,} (rounding, {diff:+})")
        print(f"{version}: {len(rows)} lots checked")
    if not ok:
        sys.exit(1)
    print("OK — all column sums match the printed totals (within display rounding)")


if __name__ == "__main__":
    main()
