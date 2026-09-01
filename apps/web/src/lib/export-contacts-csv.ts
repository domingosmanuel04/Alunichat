/** Minimal CSV exporter for contacts (no external deps). */

export type CsvContactRow = {
  name: string;
  country: string;
  phone: string;
  source: string;
  email?: string;
};

function escapeCsvCell(value: string): string {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function downloadContactsCsv(
  rows: CsvContactRow[],
  filename = 'contatos-whatsapp.csv',
) {
  const header = ['Nome', 'País', 'Número', 'Origem', 'E-mail'];
  const lines = [
    header.join(','),
    ...rows.map((r) =>
      [
        escapeCsvCell(r.name),
        escapeCsvCell(r.country),
        escapeCsvCell(r.phone),
        escapeCsvCell(r.source),
        escapeCsvCell(r.email || ''),
      ].join(','),
    ),
  ];

  const blob = new Blob(['\uFEFF' + lines.join('\n')], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
