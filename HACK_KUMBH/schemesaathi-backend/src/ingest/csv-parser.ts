/**
 * RFC 4180 compliant streaming / string CSV parser.
 * Supports multiline quoted fields, escaped quotes, and BOM headers.
 */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++; // skip next quote
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        currentRow.push(currentField);
        currentField = "";
      } else if (char === "\r") {
        // ignore CR
      } else if (char === "\n") {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = "";
      } else {
        currentField += char;
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  if (rows.length === 0) return [];
  const header = rows[0]!.map((h) => h.replace(/^\uFEFF/, "").trim());
  const result: Record<string, string>[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]!;
    if (row.length === 1 && row[0] === "") continue;
    const obj: Record<string, string> = {};
    for (let j = 0; j < header.length; j++) {
      const colName = header[j];
      if (colName) {
        obj[colName] = row[j] ?? "";
      }
    }
    result.push(obj);
  }

  return result;
}
