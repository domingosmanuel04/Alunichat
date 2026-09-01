/** Minimal PDF exporter for contacts (no external deps). */

export type PdfContactRow = {
  name: string;
  country: string;
  phone: string;
  source: string;
};

function escapePdfText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[^\x20-\x7E]/g, (ch) => {
      const map: Record<string, string> = {
        á: 'a',
        à: 'a',
        ã: 'a',
        â: 'a',
        ä: 'a',
        Á: 'A',
        À: 'A',
        Ã: 'A',
        Â: 'A',
        é: 'e',
        è: 'e',
        ê: 'e',
        É: 'E',
        í: 'i',
        ì: 'i',
        Í: 'I',
        ó: 'o',
        ò: 'o',
        õ: 'o',
        ô: 'o',
        Ó: 'O',
        Õ: 'O',
        ú: 'u',
        ù: 'u',
        ü: 'u',
        Ú: 'U',
        ç: 'c',
        Ç: 'C',
        ñ: 'n',
        Ñ: 'N',
      };
      return map[ch] ?? '';
    });
}

function byteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

function buildPageContent(
  rows: PdfContactRow[],
  pageIndex: number,
  totalPages: number,
  generatedAt: string,
): string {
  const lines: string[] = [
    'BT',
    '/F1 16 Tf',
    '50 800 Td',
    `(${escapePdfText('Alurichat - Contatos WhatsApp')}) Tj`,
    '/F1 9 Tf',
    '0 -18 Td',
    `(${escapePdfText(`Gerado em ${generatedAt}  |  Pagina ${pageIndex + 1}/${totalPages}`)}) Tj`,
    '0 -22 Td',
    '/F1 10 Tf',
    '(Nome) Tj',
    '200 0 Td',
    '(Pais) Tj',
    '90 0 Td',
    '(Numero) Tj',
    '140 0 Td',
    '(Origem) Tj',
    '-430 -14 Td',
  ];

  for (const row of rows) {
    lines.push(`(${escapePdfText(row.name.slice(0, 36))}) Tj`);
    lines.push('200 0 Td');
    lines.push(`(${escapePdfText(row.country.slice(0, 18))}) Tj`);
    lines.push('90 0 Td');
    lines.push(`(${escapePdfText(row.phone.slice(0, 22))}) Tj`);
    lines.push('140 0 Td');
    lines.push(`(${escapePdfText(row.source.slice(0, 14))}) Tj`);
    lines.push('-430 -14 Td');
  }

  lines.push('ET');
  return lines.join('\n');
}

export function downloadContactsPdf(
  rows: PdfContactRow[],
  filename = 'contatos-whatsapp.pdf',
) {
  const perPage = 45;
  const pages: PdfContactRow[][] = [];
  for (let i = 0; i < rows.length; i += perPage) {
    pages.push(rows.slice(i, i + perPage));
  }
  if (pages.length === 0) pages.push([]);

  const generatedAt = new Date().toLocaleString('pt-PT');
  const fontObj = 3;
  let nextObj = 4;
  const contentObjs: number[] = [];
  const pageObjs: number[] = [];

  for (let i = 0; i < pages.length; i++) {
    contentObjs.push(nextObj++);
    pageObjs.push(nextObj++);
  }

  const offsets: number[] = [0];
  let pdf = '%PDF-1.4\n';

  const writeObj = (num: number, body: string) => {
    offsets[num] = byteLength(pdf);
    pdf += `${num} 0 obj\n${body}\nendobj\n`;
  };

  writeObj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  writeObj(
    2,
    `<< /Type /Pages /Kids [${pageObjs.map((n) => `${n} 0 R`).join(' ')}] /Count ${pageObjs.length} >>`,
  );
  writeObj(fontObj, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

  for (let i = 0; i < pages.length; i++) {
    const content = buildPageContent(pages[i], i, pages.length, generatedAt);
    const contentObj = contentObjs[i];
    const pageObj = pageObjs[i];
    writeObj(
      contentObj,
      `<< /Length ${byteLength(content)} >>\nstream\n${content}\nendstream`,
    );
    writeObj(
      pageObj,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${contentObj} 0 R /Resources << /Font << /F1 ${fontObj} 0 R >> >> >>`,
    );
  }

  const xrefStart = byteLength(pdf);
  const maxObj = nextObj - 1;
  pdf += `xref\n0 ${maxObj + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= maxObj; i++) {
    pdf += `${String(offsets[i] ?? 0).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${maxObj + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  const blob = new Blob([pdf], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
