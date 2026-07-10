function escapeCsvField(field: string): string {
  if (/[",\n\r]/.test(field)) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

/**
 * Serializes rows of string cells to CSV text (RFC 4180-ish): commas,
 * quotes, and embedded newlines get quoted/escaped, rows end with CRLF.
 */
export function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map(escapeCsvField).join(",")).join("\r\n") + "\r\n";
}
