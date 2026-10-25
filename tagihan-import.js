/* Shared raw-report and legacy-template reader. No customer data is bundled. */
(function (root) {
  'use strict';
  function number(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    let text = String(value ?? '').trim().replace(/Rp\s*/gi, '').replace(/\s/g, '');
    if (!text) return 0;
    if (/^[+-]?\d+(?:\.\d+)?e[+-]?\d+$/i.test(text)) return Number(text);
    if (text.includes(',')) text = text.replace(/\./g, '').replace(',', '.');
    else if (/^-?\d{1,3}(?:\.\d{3})+$/.test(text)) text = text.replace(/\./g, '');
    const result = Number(text);
    if (!Number.isFinite(result)) throw Error('Nominal tidak valid: ' + value);
    return result;
  }
  function identifier(value) {
    if (typeof value === 'number') {
      if (!Number.isSafeInteger(value) || value < 0) throw Error('Nomor rekening/CIF tidak valid atau melewati ketelitian Excel.');
      return String(value);
    }
    const text = String(value ?? '').trim();
    if (!text) return '';
    if (/^\d+(?:\.\d+)?e\+?\d+$/i.test(text)) return identifier(Number(text));
    return text.replace(/\.0$/, '');
  }
  function parse(workbook, XLSX) {
    let selected;
    for (const name of workbook.SheetNames) {
      const grid = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: '' });
      const headerIndex = grid.findIndex(row => {
        const keys = row.map(v => String(v).trim().toUpperCase());
        return keys.some(k => ['ACCTNO', 'REKENING', 'NO REKENING'].includes(k)) && keys.some(k => ['NAMA', 'NASABAH', 'NAMA NASABAH'].includes(k));
      });
      if (headerIndex >= 0) { selected = { name, grid, headerIndex }; break; }
    }
    if (!selected) throw Error('Kolom rekening dan nama nasabah tidak ditemukan. Gunakan laporan Detail1 atau template tagihan.');
    const { name, grid, headerIndex } = selected;
    const headers = grid[headerIndex].map(v => String(v).trim().toUpperCase());
    const rawReport = headers.includes('ACCTNO');
    const required = rawReport ? ['ACCTNO','NAMA','LIMIT','BADE','KOL_IS','PRODUK','TGL_JT_ANGS','HR_TGG','ANGSURAN','TGGPOKOK','TGGBUNGA','TGGDENDA','TOTAL_TGG','AGF1','SALDO_AGF1','NAMA_MKS','CIF'] : [];
    const missing = required.filter(k => !headers.includes(k));
    if (missing.length) throw Error('Kolom laporan belum lengkap: ' + missing.join(', '));
    const seen = new Set(), items = [];
    for (let index = headerIndex + 1; index < grid.length; index++) {
      const row = grid[index];
      const get = (...names) => {
        for (const key of names) { const column = headers.indexOf(key); if (column >= 0 && row[column] !== '' && row[column] != null) return row[column]; }
        return '';
      };
      const rekening = identifier(get('ACCTNO','REKENING','NO REKENING'));
      const nama = String(get('NAMA','NASABAH','NAMA NASABAH')).trim();
      if (!rekening && !nama) continue;
      if (!rekening || !nama || !/^\d+$/.test(rekening)) throw Error('Rekening/nama tidak lengkap pada baris ' + (index + 1));
      if (seen.has(rekening)) throw Error('Rekening ganda pada baris ' + (index + 1) + '. Impor dibatalkan.');
      seen.add(rekening);
      const money = (...names) => Math.round(number(get(...names)));
      const million = (...names) => {
        const value = number(get(...names));
        const source = names.find(k => headers.includes(k));
        const scale = rawReport || (source && source.includes('(JUTA)')) || (source !== 'LIMIT PLAFON' && value < 1000) ? 1000000 : 1;
        return Math.round(value * scale);
      };
      const tgl = get('TGLCAIR','TGL CAIR','TGL_CAIR','TANGGAL CAIR');
      const date = typeof tgl === 'number' ? XLSX.SSF.parse_date_code(tgl) : null;
      const totalKewajiban = money('TOTAL_TGG','TOTAL KEWAJIBAN','TUNGGAKAN','TUNGGAKAN (RP)');
      const saldoAgf = money('SALDO_AGF1','SALDO AGF','SALDO_AGF','SALDO AGF (RP)');
      const kol = String(get('KOL_IS','KOL')).trim().replace(/\.0$/, '') || '1';
      items.push({
        id: 'tagihan-' + rekening, rekening, nama, cif: identifier(get('CIF')),
        cabang: String(get('KOCAB','CABANG')).trim(), unit: String(get('MBU')).trim(),
        petugas: String(get('NAMA_MKS','PETUGAS')).trim(), produk: String(get('PRODUK','PROD')).trim() || 'KUR',
        limit: million('LIMIT','LIMIT PLAFON','LIMIT (JUTA)'), bakiDebet: million('BADE','BAKI DEBET','BAKI DEBET (JUTA)'),
        kol, kolPrev: String(get('KOL_WAS','KOL-1','KOL_1','KOL 1','KOL LALU')).trim() || kol,
        tglCair: date ? `${date.d}/${date.m}/${date.y}` : String(tgl),
        jt: Math.trunc(number(get('TGL_JT_ANGS','JT','TGL JT'))) || 10,
        ht: Math.trunc(number(get('HR_TGG','HT','HARI TUNGGAKAN (HT)'))),
        angsuran: money('ANGSURAN','ANGSURAN BULANAN (RP)'),
        tunggakanPokok: money('TGGPOKOK','TUNGGAKAN POKOK'),
        tunggakanBunga: money('TGGBUNGA','TUNGGAKAN BUNGA'),
        tunggakanDenda: money('TGGDENDA','TUNGGAKAN DENDA'),
        tunggakanLain: money('TGGLAIN','TUNGGAKAN LAIN'),
        tunggakan: totalKewajiban, totalKewajiban,
        rekAgf: identifier(get('AGF1','REK AGF','REK_AGF','REKENING AGF')), saldoAgf,
        saldoCukup: saldoAgf >= totalKewajiban, kurangSaldo: Math.max(0, totalKewajiban - saldoAgf)
      });
    }
    if (!items.length) throw Error('Tidak ada rekening tagihan yang dapat dibaca.');
    return { items, sheet: name, headerRow: headerIndex + 1, rawReport, branches: new Set(items.map(r => r.cabang)).size };
  }
  root.PortalTagihanImport = { parse, identifier, number };
  if (typeof module !== 'undefined') module.exports = root.PortalTagihanImport;
})(typeof window === 'undefined' ? globalThis : window);
