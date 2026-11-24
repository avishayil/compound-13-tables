"""בדיקות ל-pdf_table.parse_number. הרצה: python3 -I scripts/test_pdf_table.py"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pdf_table import parse_number  # noqa: E402

CASES = {
    "1,234,567          ₪": 1234567,
    "1,234,\n567": 1234567,  # מספר שנשבר אחרי פסיק
    "12.5": 13,  # חצי כלפי מעלה
    "13.5": 14,
    "-1,234": -1234,
    "(1,234)": -1234,
    "-": None,
    "": None,
    "₪ 3,789,413": 3789413,
    "9,220מ''ר": 9220,
    'סה"כ - 1,234': 1234,  # מקף מפריד, לא סימן שלילי
    "- ₪ 5": 5,
}


def main():
    failures = {k: (parse_number(k), v) for k, v in CASES.items() if parse_number(k) != v}
    try:
        parse_number("1,200,000\n35,000")
        failures["two numbers"] = "no ValueError"
    except ValueError:
        pass
    if failures:
        print("FAIL", failures)
        sys.exit(1)
    print(f"OK — {len(CASES) + 1} parse_number cases")


if __name__ == "__main__":
    main()
