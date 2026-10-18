import type { EquipmentRecord } from './db.js';

function escapePdf(str: string): string {
  return String(str || '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

const ALL_COLS = [
  'name',
  'condition',
  'quantity',
  'updated_at',
  'updated_by',
] as const;

type ExportCol = (typeof ALL_COLS)[number];

const COL_WEIGHTS: Record<ExportCol, number> = {
  name: 190,
  condition: 85,
  quantity: 45,
  updated_at: 90,
  updated_by: 92,
};

const COL_HEADERS: Record<ExportCol, string> = {
  name: 'ITEM NAME',
  condition: 'CONDITION',
  quantity: 'QTY',
  updated_at: 'LAST UPDATED',
  updated_by: 'UPDATED BY',
};

export function generateInventoryPdf(
  items: EquipmentRecord[],
  requestedCols?: string[],
): Buffer {
  const dateStr = new Date().toISOString().split('T')[0];
  const totalQty = items.reduce((sum, i) => sum + (Number(i.quantity) || 1), 0);

  let activeCols: ExportCol[] = [];
  if (Array.isArray(requestedCols) && requestedCols.length > 0) {
    const filtered = requestedCols.filter((c): c is ExportCol =>
      ALL_COLS.includes(c as ExportCol),
    );
    if (!filtered.includes('name')) {
      filtered.unshift('name');
    }
    activeCols = filtered;
  }
  if (activeCols.length === 0) {
    activeCols = [...ALL_COLS];
  }

  const totalWeight = activeCols.reduce(
    (acc, col) => acc + COL_WEIGHTS[col],
    0,
  );
  const colLayout: { key: ExportCol; x: number; width: number }[] = [];
  let curX = 70;
  for (let i = 0; i < activeCols.length; i++) {
    const key = activeCols[i];
    const isLast = i === activeCols.length - 1;
    const width = isLast
      ? 572 - curX
      : Math.floor((COL_WEIGHTS[key] / totalWeight) * 502);
    colLayout.push({ key, x: curX, width });
    curX += width;
  }

  let stream = '';

  stream += 'q\n';
  stream += '0.086 0.396 0.204 rg\n';
  stream += '40 705 532 55 re f\n';

  stream += '1 1 1 rg\n';
  stream += 'BT /F2 16 Tf 55 738 Td (AHMADU BELLO UNIVERSITY, ZARIA) Tj ET\n';
  stream +=
    'BT /F1 10 Tf 55 718 Td (Department of Computer Engineering - Smart Classroom Inventory) Tj ET\n';
  stream += 'Q\n';

  stream += 'q\n';
  stream += '0.96 0.96 0.96 rg\n';
  stream += '40 668 532 26 re f\n';
  stream += '0.85 0.85 0.85 RG 0.5 w\n';
  stream += '40 668 532 26 re S\n';
  stream += '0.2 0.2 0.2 rg\n';
  stream +=
    'BT /F2 8.5 Tf 50 677 Td (REPORT DATE: ) Tj /F1 8.5 Tf (' +
    dateStr +
    ') Tj ET\n';
  stream +=
    'BT /F2 8.5 Tf 220 677 Td (REGISTERED ITEMS: ) Tj /F1 8.5 Tf (' +
    items.length +
    ') Tj ET\n';
  stream +=
    'BT /F2 8.5 Tf 390 677 Td (TOTAL EQUIPMENT UNITS: ) Tj /F1 8.5 Tf (' +
    totalQty +
    ') Tj ET\n';
  stream += 'Q\n';

  let y = 635;
  stream += 'q\n';
  stream += '0.12 0.12 0.12 rg\n';
  stream += '40 ' + y + ' 532 22 re f\n';
  stream += '1 1 1 rg\n';
  stream += 'BT /F2 8.5 Tf 45 ' + (y + 6) + ' Td (#) Tj ET\n';
  for (const col of colLayout) {
    stream +=
      'BT /F2 8.5 Tf ' +
      col.x +
      ' ' +
      (y + 6) +
      ' Td (' +
      COL_HEADERS[col.key] +
      ') Tj ET\n';
  }
  stream += 'Q\n';

  y -= 22;
  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    const isEven = idx % 2 === 0;

    stream += 'q\n';
    if (isEven) {
      stream += '0.98 0.98 0.98 rg\n';
      stream += '40 ' + y + ' 532 22 re f\n';
    }
    stream += '0.9 0.9 0.9 RG 0.5 w\n';
    stream += '40 ' + y + ' m 572 ' + y + ' l S\n';

    stream += '0.15 0.15 0.15 rg\n';
    stream += 'BT /F1 8 Tf 45 ' + (y + 7) + ' Td (' + (idx + 1) + ') Tj ET\n';

    for (const col of colLayout) {
      if (col.key === 'name') {
        const maxChars = Math.max(20, Math.floor(col.width / 5.2));
        const nameStr = escapePdf((item.name || '').substring(0, maxChars));
        stream += '0.15 0.15 0.15 rg\n';
        stream +=
          'BT /F2 8 Tf ' +
          col.x +
          ' ' +
          (y + 7) +
          ' Td (' +
          nameStr +
          ') Tj ET\n';
      } else if (col.key === 'condition') {
        const condStr = escapePdf(item.condition || 'Unknown');
        if (item.condition === 'Working') {
          stream += '0.08 0.45 0.2 rg\n';
        } else if (item.condition === 'Faulty') {
          stream += '0.7 0.15 0.15 rg\n';
        } else {
          stream += '0.5 0.4 0.1 rg\n';
        }
        stream +=
          'BT /F2 8 Tf ' +
          col.x +
          ' ' +
          (y + 7) +
          ' Td (' +
          condStr +
          ') Tj ET\n';
      } else if (col.key === 'quantity') {
        stream += '0.15 0.15 0.15 rg\n';
        stream +=
          'BT /F1 8 Tf ' +
          col.x +
          ' ' +
          (y + 7) +
          ' Td (' +
          (item.quantity ?? 1) +
          ') Tj ET\n';
      } else if (col.key === 'updated_at') {
        const updDate = escapePdf((item.updated_at || dateStr).split('T')[0]);
        stream += '0.15 0.15 0.15 rg\n';
        stream +=
          'BT /F1 8 Tf ' +
          col.x +
          ' ' +
          (y + 7) +
          ' Td (' +
          updDate +
          ') Tj ET\n';
      } else if (col.key === 'updated_by') {
        const updBy = escapePdf(
          (item.updated_by || 'Admin').split('@')[0].substring(0, 16),
        );
        stream += '0.15 0.15 0.15 rg\n';
        stream +=
          'BT /F1 8 Tf ' +
          col.x +
          ' ' +
          (y + 7) +
          ' Td (' +
          updBy +
          ') Tj ET\n';
      }
    }

    stream += 'Q\n';
    y -= 22;
  }

  stream += 'q\n';
  stream += '0.8 0.8 0.8 RG 0.5 w\n';
  stream += '40 50 m 572 50 l S\n';
  stream += '0.45 0.45 0.45 rg\n';
  stream +=
    'BT /F1 7.5 Tf 40 38 Td (Ahmadu Bello University, Zaria - Smart Classroom Official Inventory Register) Tj ET\n';
  stream += 'BT /F1 7.5 Tf 525 38 Td (Page 1 of 1) Tj ET\n';
  stream += 'Q\n';

  const streamBytes = Buffer.from(stream, 'utf8');
  const streamLen = streamBytes.length;

  let header = '%PDF-1.4\n';
  const offsets: number[] = [];

  function appendChunk(chunk: string) {
    offsets.push(Buffer.byteLength(header, 'utf8'));
    header += chunk + '\n';
  }

  appendChunk('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj');
  appendChunk('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj');
  appendChunk(
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources 4 0 R /Contents 7 0 R >>\nendobj',
  );
  appendChunk('4 0 obj\n<< /Font << /F1 5 0 R /F2 6 0 R >> >>\nendobj');
  appendChunk(
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj',
  );
  appendChunk(
    '6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj',
  );
  appendChunk(
    '7 0 obj\n<< /Length ' +
      streamLen +
      ' >>\nstream\n' +
      stream +
      '\nendstream\nendobj',
  );

  const startxref = Buffer.byteLength(header, 'utf8');
  let xref = 'xref\n';
  xref += '0 ' + (offsets.length + 1) + '\n';
  xref += '0000000000 65535 f \n';
  for (const o of offsets) {
    xref += String(o).padStart(10, '0') + ' 00000 n \n';
  }
  xref +=
    'trailer\n<< /Size ' +
    (offsets.length + 1) +
    ' /Root 1 0 R >>\nstartxref\n' +
    startxref +
    '\n%%EOF\n';

  return Buffer.from(header + xref, 'utf8');
}
