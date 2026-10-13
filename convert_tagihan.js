const fs = require('fs');
const XLSX = require('./lib/xlsx.full.min.js');

function excelSerialToDate(serial) {
  if (!serial || isNaN(serial)) return '-';
  const num = parseFloat(serial);
  const utcDays = Math.floor(num - 25569);
  const date = new Date(utcDays * 86400 * 1000);
  if (isNaN(date.getTime())) return '-';
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

function cleanKol(k) {
  if (!k) return '1';
  let str = String(k).trim().replace(/\.0$/, '');
  return str;
}

const raw = fs.readFileSync('data_tagihan_mandiri.csv', 'utf8');
const lines = raw.trim().split(/\r?\n/);
const header = lines[0].split(',');

const parsed = [];

for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  if (!line || !line.trim()) continue;
  const cols = line.split(',');

  const cabang = cols[0] ? cols[0].trim() : '-';
  const cif = cols[1] ? cols[1].trim().replace(/\.0$/, '') : '';
  const petugas = cols[2] ? cols[2].trim() : '-';
  const produk = cols[3] ? cols[3].trim() : 'KUR';
  const rekening = cols[4] ? cols[4].trim().replace(/\.0$/, '') : '';
  const nama = cols[5] ? cols[5].trim() : 'Debitur';
  
  const limitJuta = parseFloat(cols[6]) || 0;
  const limit = Math.round(limitJuta * 1000000);

  const badeJuta = parseFloat(cols[7]) || 0;
  const bakiDebet = Math.round(badeJuta * 1000000);

  const kol = cleanKol(cols[8]);
  const kolPrev = cleanKol(cols[9]);
  const tglCair = excelSerialToDate(cols[10]);
  
  const jt = parseInt(parseFloat(cols[11])) || 1;
  const ht = parseInt(parseFloat(cols[12])) || 0;
  const angsuran = Math.round(parseFloat(cols[13]) || 0);
  const tunggakan = Math.round(parseFloat(cols[14]) || 0);

  const rekAgf = cols[15] ? cols[15].trim().replace(/\.0$/, '') : '-';
  const saldoAgf = Math.round(parseFloat(cols[16]) || 0);

  const totalKewajiban = tunggakan > 0 ? (angsuran + tunggakan) : angsuran;
  const saldoCukup = saldoAgf >= totalKewajiban;
  const kurangSaldo = saldoCukup ? 0 : (totalKewajiban - saldoAgf);

  parsed.push({
    id: `tagihan-${rekening || i}`,
    cabang,
    cif,
    petugas,
    produk,
    rekening,
    nama,
    limit,
    limitJuta,
    bakiDebet,
    badeJuta,
    kol,
    kolPrev,
    tglCair,
    jt,
    ht,
    angsuran,
    tunggakan,
    totalKewajiban,
    rekAgf,
    saldoAgf,
    saldoCukup,
    kurangSaldo
  });
}

console.log('Parsed total:', parsed.length);
console.log('Sample record:', parsed[0]);

// Write data_tagihan.js
const jsContent = '/**\n * DATA TAGIHAN BULANAN & KOLEKTIBILITAS MIKRO MANDIRI\n * Total Data: ' + parsed.length + ' Rekening\n */\nwindow.MANDIRI_TAGIHAN_DATA = ' + JSON.stringify(parsed, null, 2) + ';\n';
fs.writeFileSync('data_tagihan.js', jsContent, 'utf8');

// Generate Excel file
const exportExcelData = parsed.map(r => ({
  'CABANG': r.cabang,
  'CIF': r.cif,
  'PETUGAS': r.petugas,
  'PROD': r.produk,
  'REKENING': r.rekening,
  'NASABAH': r.nama,
  'LIMIT (JUTA)': r.limitJuta,
  'BAKI DEBET (JUTA)': r.badeJuta,
  'KOL': r.kol,
  'KOL-1': r.kolPrev,
  'TGL CAIR': r.tglCair,
  'TGL JT': r.jt,
  'HARI TUNGGAKAN (HT)': r.ht,
  'ANGSURAN BULANAN (RP)': r.angsuran,
  'TUNGGAKAN (RP)': r.tunggakan,
  'REKENING AGF': r.rekAgf,
  'SALDO AGF (RP)': r.saldoAgf,
  'STATUS SALDO AGF': r.saldoCukup ? 'CUKUP' : 'KURANG'
}));

const ws = XLSX.utils.json_to_sheet(exportExcelData);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Data Tagihan Mandiri');
const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
fs.writeFileSync('contoh_data_tagihan.xlsx', buf);
console.log('Successfully created data_tagihan.js and contoh_data_tagihan.xlsx');
