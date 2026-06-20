// hashing בצד-לקוח להתאמת קלט המשתמש מול ה-hashes ב-owners.csv (ללא חשיפת PII).

/** נרמול שם זהה ללוגיקת ה-Python ב-scripts/extract_owners.py. */
export function normalizeName(name: string): string {
  return name
    .normalize('NFKC')
    .replace(/״/g, '"')
    .replace(/׳/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** נרמול מס׳ זהות: ספרות/אותיות בלבד. מחזיר '' אם אין. */
export function normalizeId(raw: string): string {
  return raw.replace(/[^0-9A-Za-z]/g, '');
}

/** SHA-256 hex של מחרוזת, באמצעות Web Crypto (זמין בכל דפדפן מודרני). */
export async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
