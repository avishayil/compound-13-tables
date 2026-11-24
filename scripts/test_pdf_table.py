"""בדיקות ל-pdf_table.parse_number. הרצה: python3 -I scripts/test_pdf_table.py"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pdf_table import parse_number  # noqa: E402

CASES = {
    "1,234,567          ₪": 1234567,
    "3,789,413 ₪": 3789413,
    "1,566": 1566,
    "953": 953,
    "1": 1,
    "-": None,
    "": None,
}

# כל פורמט אחר אינו צפוי בטבלאות (נבדק מול כל התאים בפועל) ונכשל עם הקשר
UNEXPECTED = ["1,234,\n567", "12.5", "-1,234", "(1,234)", "1,200,000 35,000", "12, 34", "1,23"]


def main():
    failures = {k: (parse_number(k, "test"), v) for k, v in CASES.items() if parse_number(k, "test") != v}
    for text in UNEXPECTED:
        try:
            parse_number(text, "test")
            failures[text] = "accepted"
        except SystemExit as e:
            if "test" not in str(e):
                failures[text] = f"no context: {e}"
    if failures:
        print("FAIL", failures)
        sys.exit(1)
    print(f"OK — {len(CASES) + len(UNEXPECTED)} parse_number cases")


if __name__ == "__main__":
    main()
