function escapeFormulaField(field: string): string {
  return /^[=+\-@\t\r]/.test(field) ? `'${field}` : field;
}

function escapeCsvField(field: string): string {
  const safeField = escapeFormulaField(field);
  if (/[",\n\r]/.test(safeField)) {
    return `"${safeField.replace(/"/g, '""')}"`;
  }
  return safeField;
}

/**
 * Serializes rows of string cells to CSV text (RFC 4180-ish): commas,
 * quotes, and embedded newlines get quoted/escaped, rows end with CRLF.
 */
export function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map(escapeCsvField).join(",")).join("\r\n") + "\r\n";
}
