"""נרמול ו-hashing משותפים לכל סקריפטי החילוץ (v1, v2).

חייב להישאר זהה ללוגיקה ב-src/lib/hash.ts — אחרת החיפוש בצד-לקוח לא ימצא התאמות.
"""
import hashlib
import re
import unicodedata


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
