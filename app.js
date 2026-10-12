/**
 * PORTAL DATA NASABAH - CEK KELAYAKAN KREDIT MIKRO MANDIRI (KUR & KUM)
 * Versi 3.0 - Tracking Kunjungan Sales (Tertarik / Tidak Tertarik) & Live Cloud Team Sync
 */

// ================= GLOBAL STATE =================
let dbNasabah = [];
let visitRecords = {}; // Key: cifno atau id -> { status: 'tertarik'|'tidak_tertarik'|'belum', sales, waktu, catatan }
let currentFilter = 'all';
let currentSgpFilter = 'all';
let currentSearch = '';
let currentView = 'cards';
let currentPage = 1;
let pageSize = 24;
let activeSort = { column: 'nama', direction: 'asc' };
let currentActiveNasabah = null;
let currentVisitNasabah = null;
let pendingImportData = [];
let isSyncing = false;

const STORAGE_KEY = 'portal_nasabah_mandiri_pipeline_v2';
const VISIT_STORAGE_KEY = 'portal_mandiri_visits_v2';
const CLOUD_SYNC_URL = 'https://api.restful-api.dev/objects/ff808181a09d98f701a130130a5a4916';

// ================= INITIALIZATION =================
document.addEventListener('DOMContentLoaded', () => {
  loadDatabase();
  loadVisitRecords();
  setupEventListeners();
  populateSgpDropdown();
  updateUI();

  // Jalankan sinkronisasi cloud tim segera & ulangi berkala
  syncFromCloud(true);
  setInterval(() => syncFromCloud(false), 45000); // Sinkronisasi tim tiap 45 detik
});

// ================= STORAGE & SYNC FUNCTIONS =================
function loadDatabase() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      dbNasabah = JSON.parse(raw);
    } else if (window.MANDIRI_PIPELINE_DATA && window.MANDIRI_PIPELINE_DATA.length > 0) {
      dbNasabah = [...window.MANDIRI_PIPELINE_DATA];
      saveDatabase();
    }
  } catch (e) {
    console.error('Error loading database:', e);
    if (window.MANDIRI_PIPELINE_DATA) {
      dbNasabah = [...window.MANDIRI_PIPELINE_DATA];
    }
  }
}

function saveDatabase() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dbNasabah));
  } catch (e) {
    console.error('Error saving database:', e);
    showToast('Gagal menyimpan database ke peramban', 'error');
  }
}

function loadVisitRecords() {
  try {
    const raw = localStorage.getItem(VISIT_STORAGE_KEY);
    if (raw) {
      visitRecords = JSON.parse(raw);
    }
  } catch (e) {
    console.error('Error loading visit records:', e);
    visitRecords = {};
  }
}

function saveVisitRecordsLocally() {
  try {
    localStorage.setItem(VISIT_STORAGE_KEY, JSON.stringify(visitRecords));
  } catch (e) {
    console.error('Error saving visit records:', e);
  }
}

// Ambil data kunjungan untuk nasabah tertentu
function getVisitRecord(item) {
  const key = item.cifno || item.id;
  const rec = visitRecords[key];
  if (!rec || !rec.status || rec.status === 'belum') {
    return {
      status: 'belum',
      sales: item.sgp || '-',
      waktu: '-',
      catatan: ''
    };
  }
  return rec;
}

// ================= CLOUD TEAM SYNC =================
async function syncFromCloud(showFeedback = false) {
  if (isSyncing) return;
  isSyncing = true;
  const icon = document.getElementById('iconSyncSpinner');
  if (icon) icon.classList.add('animate-spin');

  try {
    const res = await fetch(CLOUD_SYNC_URL, { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      if (json && json.data) {
        // Gabungkan data dari cloud dengan local records
        let hasNew = false;
        Object.keys(json.data).forEach(key => {
          if (!visitRecords[key] || JSON.stringify(visitRecords[key]) !== JSON.stringify(json.data[key])) {
            visitRecords[key] = json.data[key];
            hasNew = true;
          }
        });

        if (hasNew) {
          saveVisitRecordsLocally();
          updateUI();
          if (showFeedback) showToast('Data kunjungan tim berhasil disinkronkan!', 'success');
        } else if (showFeedback) {
          showToast('Data tim sudah paling baru.', 'info');
        }
      }
    }
  } catch (err) {
    console.warn('Cloud sync offline or unavailable:', err.message);
  } finally {
    isSyncing = false;
    if (icon) icon.classList.remove('animate-spin');
  }
}

async function pushVisitToCloud(key, record) {
  // Simpan lokal terlebih dahulu (agar instan)
  visitRecords[key] = record;
  saveVisitRecordsLocally();
  updateUI();

  // Kirim ke shared cloud storage agar semua sales lain menerima
  try {
    const payload = {
      name: 'mandiri_mikro_progress_leads',
      data: visitRecords
    };
    await fetch(CLOUD_SYNC_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.warn('Gagal push ke cloud, data tetap tersimpan di lokal:', err.message);
  }
}

// ================= FORMATTERS & HELPERS =================
function formatRupiah(num) {
  if (isNaN(num) || num === null || num === undefined) return 'Rp 0';
  return 'Rp ' + Number(num).toLocaleString('id-ID');
}

function cleanNumber(val) {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const cleaned = String(val).replace(/[^0-9,-]/g, '').replace(',', '.');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

function cleanPhone(phone) {
  if (!phone) return '';
  let str = String(phone).replace(/[^0-9]/g, '');
  if (str === '0' || str.length < 5) return '';
  if (str.startsWith('0')) {
    str = '62' + str.substring(1);
  } else if (!str.startsWith('62')) {
    str = '62' + str;
  }
  return str;
}

function formatPhoneDisplay(phone) {
  if (!phone || phone === '0' || phone === 'NULL') return 'Tidak Ada';
  let str = String(phone).trim();
  if (str.startsWith('62')) {
    str = '0' + str.substring(2);
  }
  return str.replace(/(\d{4})(\d{4})(\d+)/, '$1-$2-$3');
}

function calculateInstallment(limit, tenorBulan, produk) {
  limit = Number(limit) || 0;
  tenorBulan = Number(tenorBulan) || 12;
  if (limit <= 0) return 0;

  const isKUR = String(produk).toUpperCase().includes('KUR');
  if (isKUR) {
    const annualRate = 0.06;
    const monthlyRate = annualRate / 12;
    const factor = Math.pow(1 + monthlyRate, tenorBulan);
    const angsuran = limit * (monthlyRate * factor) / (factor - 1);
    return Math.round(angsuran);
  } else {
    const flatRateMonthly = 0.0099;
    const pokok = limit / tenorBulan;
    const bunga = limit * flatRateMonthly;
    return Math.round(pokok + bunga);
  }
}

function isKawanLama(n) {
  const kat = String(n.kategori || '').toLowerCase();
  const elg = String(n.eligible || '').toLowerCase();
  const grp = String(n.leadsGroup || '').toLowerCase();
  return kat.includes('kawan lama') || kat.includes('kawanlama') || elg.includes('kawan lama') || grp === 'kl';
}

function isBothProducts(n) {
  const p = String(n.produk || '').toLowerCase();
  return p.includes('bisa kur & kum') || p.includes('both') || p.includes('pilihan ganda');
}

function isKUR(n) {
  const p = String(n.produk || '').toLowerCase();
  return p.includes('kur');
}

function isKUM(n) {
  const p = String(n.produk || '').toLowerCase();
  return p.includes('kum');
}

function hasConsent(n) {
  const c = String(n.consent || '').toLowerCase();
  return c.includes('ada consent') && !c.includes('belum');
}

// ================= UI RENDERING & FILTERING =================
function populateSgpDropdown() {
  const select = document.getElementById('selectSgpFilter');
  if (!select) return;

  const currentVal = select.value;
  const officers = Array.from(new Set(dbNasabah.map(n => n.sgp).filter(Boolean))).sort();

  select.innerHTML = '<option value="all">Semua Petugas SGP</option>';
  officers.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    if (name === currentVal) opt.selected = true;
    select.appendChild(opt);
  });
}

function getFilteredData() {
  let list = dbNasabah.filter(item => {
    const visit = getVisitRecord(item);

    // 1. Filter Petugas SGP
    if (currentSgpFilter !== 'all') {
      if (item.sgp !== currentSgpFilter) return false;
    }

    // 2. Search filter
    if (currentSearch) {
      const q = currentSearch.toLowerCase().trim();
      const nama = String(item.nama || '').toLowerCase();
      const cif = String(item.cifno || '').toLowerCase();
      const hp = String(item.hp || '').replace(/[^0-9]/g, '');
      const searchNum = q.replace(/[^0-9]/g, '');
      const produk = String(item.produk || '').toLowerCase();
      const kategori = String(item.kategori || '').toLowerCase();
      const alamat = String(item.alamat || '').toLowerCase();
      const eligible = String(item.eligible || '').toLowerCase();
      const sgp = String(item.sgp || '').toLowerCase();
      const salesVisit = String(visit.sales || '').toLowerCase();
      const catatanVisit = String(visit.catatan || '').toLowerCase();

      const matchText = nama.includes(q) || cif.includes(q) || produk.includes(q) || kategori.includes(q) || alamat.includes(q) || eligible.includes(q) || sgp.includes(q) || salesVisit.includes(q) || catatanVisit.includes(q);
      const matchNum = searchNum && searchNum.length >= 3 && (cif.includes(searchNum) || hp.includes(searchNum));

      if (!matchText && !matchNum) {
        return false;
      }
    }

    // 3. Chip filter (Termasuk Status Kunjungan Baru!)
    if (currentFilter === 'belum') {
      return visit.status === 'belum';
    } else if (currentFilter === 'tertarik') {
      return visit.status === 'tertarik';
    } else if (currentFilter === 'tidak_tertarik') {
      return visit.status === 'tidak_tertarik';
    } else if (currentFilter === 'kawan-lama') {
      return isKawanLama(item);
    } else if (currentFilter === 'both') {
      return isBothProducts(item);
    } else if (currentFilter === 'consent-yes') {
      return hasConsent(item);
    }

    return true;
  });

  // Sorting
  list.sort((a, b) => {
    let valA = a[activeSort.column];
    let valB = b[activeSort.column];

    if (activeSort.column === 'limit') {
      valA = Number(valA) || 0;
      valB = Number(valB) || 0;
    } else {
      valA = String(valA || '').toLowerCase();
      valB = String(valB || '').toLowerCase();
    }

    if (valA < valB) return activeSort.direction === 'asc' ? -1 : 1;
    if (valA > valB) return activeSort.direction === 'asc' ? 1 : -1;
    return 0;
  });

  return list;
}

function updateUI() {
  updateDashboardStats();
  renderContent();
}

function updateDashboardStats() {
  const total = dbNasabah.length;
  let countBelum = 0;
  let countTertarik = 0;
  let countTidakTertarik = 0;

  dbNasabah.forEach(n => {
    const v = getVisitRecord(n);
    if (v.status === 'tertarik') countTertarik++;
    else if (v.status === 'tidak_tertarik') countTidakTertarik++;
    else countBelum++;
  });

  const totalKawanLama = dbNasabah.filter(isKawanLama).length;
  const totalBoth = dbNasabah.filter(isBothProducts).length;
  const totalConsent = dbNasabah.filter(hasConsent).length;

  document.getElementById('statTotalNasabah').textContent = total.toLocaleString('id-ID');
  document.getElementById('statTotalBelumGarap').textContent = countBelum.toLocaleString('id-ID');
  document.getElementById('statTotalTertarik').textContent = countTertarik.toLocaleString('id-ID');
  document.getElementById('statTotalTidakTertarik').textContent = countTidakTertarik.toLocaleString('id-ID');
  document.getElementById('statTotalKawanLama').textContent = totalKawanLama.toLocaleString('id-ID');
  document.getElementById('statTotalBoth').textContent = totalBoth.toLocaleString('id-ID');

  document.getElementById('countAll').textContent = total;
  document.getElementById('countBelumGarap').textContent = countBelum;
  document.getElementById('countTertarik').textContent = countTertarik;
  document.getElementById('countTidakTertarik').textContent = countTidakTertarik;
  document.getElementById('countKawanLama').textContent = totalKawanLama;
  document.getElementById('countBoth').textContent = totalBoth;
  document.getElementById('countConsentYes').textContent = totalConsent;
}

function filterByGarap(status) {
  document.querySelectorAll('.filter-chip').forEach(b => {
    b.classList.remove('active', 'bg-mandiri-navy', 'text-white', 'border-mandiri-navy');
    b.classList.add('border-slate-200', 'bg-white', 'text-slate-700');
  });

  const targetChip = document.querySelector(`.filter-chip[data-filter="${status}"]`);
  if (targetChip) {
    targetChip.classList.add('active', 'bg-mandiri-navy', 'text-white', 'border-mandiri-navy');
    targetChip.classList.remove('border-slate-200', 'bg-white', 'text-slate-700');
  }

  currentFilter = status;
  currentPage = 1;
  renderContent();
  scrollToTop();
}

function renderContent() {
  const filtered = getFilteredData();
  const totalFiltered = filtered.length;

  if (dbNasabah.length === 0) {
    document.getElementById('emptyDataState').classList.remove('hidden');
    document.getElementById('noMatchSearchState').classList.add('hidden');
    document.getElementById('cardsViewContainer').classList.add('hidden');
    document.getElementById('tableViewContainer').classList.add('hidden');
    document.getElementById('cardsPaginationContainer').classList.add('hidden');
    document.getElementById('resultsHeading').textContent = 'Database Kosong';
    document.getElementById('badgeResultCount').textContent = '0 data';
    return;
  } else {
    document.getElementById('emptyDataState').classList.add('hidden');
  }

  if (totalFiltered === 0) {
    document.getElementById('noMatchSearchState').classList.remove('hidden');
    document.getElementById('searchedKeyword').textContent = currentSearch || 'Filter Terpilih';
    document.getElementById('cardsViewContainer').classList.add('hidden');
    document.getElementById('tableViewContainer').classList.add('hidden');
    document.getElementById('cardsPaginationContainer').classList.add('hidden');
    document.getElementById('resultsHeading').textContent = 'Tidak Ditemukan';
    document.getElementById('badgeResultCount').textContent = '0 data';
    return;
  } else {
    document.getElementById('noMatchSearchState').classList.add('hidden');
  }

  // Heading text
  if (currentSearch) {
    document.getElementById('resultsHeading').textContent = `Hasil Pencarian: "${currentSearch}"`;
  } else if (currentFilter === 'belum') {
    document.getElementById('resultsHeading').textContent = 'Nasabah Yang Belum Digarap (Tersedia)';
  } else if (currentFilter === 'tertarik') {
    document.getElementById('resultsHeading').textContent = 'Nasabah Sudah Digarap: TERTARIK (Terkunci)';
  } else if (currentFilter === 'tidak_tertarik') {
    document.getElementById('resultsHeading').textContent = 'Nasabah Sudah Digarap: TIDAK TERTARIK';
  } else if (currentFilter === 'kawan-lama') {
    document.getElementById('resultsHeading').textContent = 'Nasabah Prioritas ⭐ Kawan Lama';
  } else if (currentFilter === 'both') {
    document.getElementById('resultsHeading').textContent = 'Nasabah Eligible KUR & KUM (Pilihan Ganda)';
  } else {
    document.getElementById('resultsHeading').textContent = 'Menampilkan Seluruh Pipeline Debitur';
  }
  document.getElementById('badgeResultCount').textContent = `${totalFiltered} debitur`;

  const totalPages = Math.ceil(totalFiltered / pageSize) || 1;
  if (currentPage > totalPages) currentPage = totalPages;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalFiltered);
  const pageItems = filtered.slice(startIndex, endIndex);

  if (currentView === 'cards') {
    document.getElementById('cardsViewContainer').classList.remove('hidden');
    document.getElementById('tableViewContainer').classList.add('hidden');
    renderCards(pageItems);
    renderCardsPagination(totalFiltered, startIndex + 1, endIndex, totalPages);
  } else {
    document.getElementById('cardsViewContainer').classList.add('hidden');
    document.getElementById('tableViewContainer').classList.remove('hidden');
    document.getElementById('cardsPaginationContainer').classList.add('hidden');
    renderTable(pageItems, startIndex + 1);
    renderTablePagination(totalPages);
  }
}

// ================= RENDER CARDS VIEW =================
function renderCards(items) {
  const container = document.getElementById('cardsViewContainer');
  container.innerHTML = '';

  const avatarGradients = [
    'from-blue-600 to-indigo-600',
    'from-emerald-600 to-teal-700',
    'from-amber-500 to-orange-600',
    'from-indigo-600 to-purple-600',
    'from-sky-600 to-cyan-700'
  ];

  items.forEach((item, index) => {
    const isKawan = isKawanLama(item);
    const isBoth = isBothProducts(item);
    const isPrdKur = isKUR(item);
    const userConsent = hasConsent(item);
    const visit = getVisitRecord(item);

    const initials = item.nama
      ? item.nama.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
      : 'NS';
    const grad = avatarGradients[index % avatarGradients.length];

    const card = document.createElement('div');
    
    // Penyesuaian border kartu berdasarkan status garapan
    let cardBorderClass = 'border-slate-200 hover:border-blue-300';
    if (visit.status === 'tertarik') {
      cardBorderClass = 'border-emerald-400 ring-2 ring-emerald-200/80 bg-gradient-to-b from-emerald-50/50 via-white to-white';
    } else if (visit.status === 'tidak_tertarik') {
      cardBorderClass = 'border-red-300 bg-gradient-to-b from-red-50/30 via-white to-white opacity-95';
    } else if (isKawan) {
      cardBorderClass = 'border-amber-300 ring-1 ring-amber-200/60 bg-gradient-to-b from-amber-50/20 via-white to-white';
    }

    card.className = `group bg-white rounded-2xl p-5 border transition-all duration-200 shadow-card hover:shadow-card-hover flex flex-col justify-between ${cardBorderClass}`;

    // Tag Produk Styling
    let produkTagHtml = '';
    if (isBoth) {
      produkTagHtml = `
        <span class="both-badge px-2 py-0.5 rounded-lg text-[10px] font-extrabold text-indigo-900 uppercase tracking-wider flex items-center">
          <i class="fa-solid fa-shuffle text-indigo-600 mr-1"></i> BISA KUR & KUM
        </span>
      `;
    } else if (isPrdKur) {
      produkTagHtml = `
        <span class="bg-blue-100 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider">
          <i class="fa-solid fa-hand-holding-dollar mr-1"></i> ${escapeHtml(item.produk)}
        </span>
      `;
    } else {
      produkTagHtml = `
        <span class="bg-indigo-100 text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider">
          <i class="fa-solid fa-briefcase mr-1"></i> ${escapeHtml(item.produk)}
        </span>
      `;
    }

    // Banner Status Garapan (Paling Atas)
    let visitBannerHtml = '';
    if (visit.status === 'tertarik') {
      visitBannerHtml = `
        <div class="mb-3 p-2.5 rounded-xl bg-emerald-100/90 border border-emerald-300 text-emerald-950 text-xs shadow-2xs">
          <div class="flex items-center justify-between font-extrabold">
            <span class="flex items-center text-emerald-900">
              <i class="fa-solid fa-lock text-emerald-600 mr-1.5 text-sm"></i> SUDAH DIGARAP: TERTARIK
            </span>
            <span class="text-[10px] bg-emerald-200/80 px-2 py-0.5 rounded-md font-semibold text-emerald-900">
              Oleh: ${escapeHtml(visit.sales || 'Sales')}
            </span>
          </div>
          <div class="text-[11px] text-emerald-800 mt-1 flex items-center justify-between">
            <span><i class="fa-solid fa-triangle-exclamation text-emerald-700 mr-1"></i> Sales lain jangan garap ulang!</span>
            <span class="text-[10px] text-slate-500">${escapeHtml(visit.waktu || '')}</span>
          </div>
          ${visit.catatan ? `<div class="mt-1 text-[11px] bg-white/80 p-1.5 rounded-lg text-slate-700 border border-emerald-200"><strong>Catatan:</strong> ${escapeHtml(visit.catatan)}</div>` : ''}
        </div>
      `;
    } else if (visit.status === 'tidak_tertarik') {
      visitBannerHtml = `
        <div class="mb-3 p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-950 text-xs shadow-2xs">
          <div class="flex items-center justify-between font-bold">
            <span class="flex items-center text-red-700">
              <i class="fa-solid fa-ban text-red-500 mr-1.5 text-sm"></i> SUDAH DIGARAP: TIDAK TERTARIK
            </span>
            <span class="text-[10px] bg-red-100 px-2 py-0.5 rounded-md text-red-800 font-semibold">
              Oleh: ${escapeHtml(visit.sales || 'Sales')}
            </span>
          </div>
          ${visit.catatan ? `<div class="mt-1 text-[11px] bg-white p-1.5 rounded-lg text-slate-700 border border-red-100"><strong>Alasan:</strong> ${escapeHtml(visit.catatan)}</div>` : ''}
        </div>
      `;
    } else {
      visitBannerHtml = `
        <div class="mb-3 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 text-xs font-semibold flex items-center justify-between">
          <span class="flex items-center text-slate-600">
            <i class="fa-regular fa-circle-dot mr-1.5 text-slate-400"></i> Belum Digarap
          </span>
          <span class="text-[10px] text-emerald-700 bg-emerald-100/70 font-bold px-2 py-0.5 rounded">
            Tersedia (Bebas Digarap)
          </span>
        </div>
      `;
    }

    card.innerHTML = `
      <div>
        <!-- Visit Status Banner -->
        ${visitBannerHtml}

        <!-- Top Badges & Tag -->
        <div class="flex items-center justify-between gap-1.5 mb-3">
          <div class="flex items-center space-x-1.5 flex-wrap gap-y-1">
            ${produkTagHtml}

            ${isKawan ? `
              <span class="kawan-lama-badge px-2 py-0.5 rounded-lg text-[10px] font-extrabold text-amber-800 uppercase tracking-wider flex items-center">
                <i class="fa-solid fa-star text-amber-500 mr-1 text-[9px]"></i> KAWAN LAMA
              </span>
            ` : ''}
          </div>

          <!-- Consent Status -->
          <div class="text-[10px] font-bold flex items-center px-1.5 py-0.5 rounded ${
            userConsent ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800 border border-amber-200'
          }">
            <i class="fa-solid ${userConsent ? 'fa-circle-check text-emerald-500' : 'fa-triangle-exclamation text-amber-600'} mr-1"></i>
            ${userConsent ? 'Ada Consent' : 'Kunjungan'}
          </div>
        </div>

        <!-- Profil Header -->
        <div class="flex items-start space-x-3 mb-3">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br ${grad} text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
            ${initials}
          </div>
          <div class="min-w-0 flex-1">
            <h4 class="text-base font-bold text-slate-800 group-hover:text-mandiri-blue transition truncate cursor-pointer" onclick="openDetailModal('${item.id}')">
              ${escapeHtml(item.nama)}
            </h4>
            <div class="flex items-center space-x-2 text-xs text-slate-500 mt-0.5">
              <span class="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">CIF: ${escapeHtml(item.cifno || '-')}</span>
              <span class="text-slate-300">•</span>
              <span class="truncate">${escapeHtml(item.sgp ? 'SGP: ' + item.sgp : '')}</span>
            </div>
          </div>
        </div>

        <!-- Limit Box -->
        <div class="p-3 rounded-xl bg-slate-50 border border-slate-200/80 mb-3 group-hover:bg-blue-50/30 transition">
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Eligible Limit Plafon</span>
            <span class="text-[10px] font-bold text-mandiri-blue bg-blue-100/70 px-2 py-0.5 rounded">
              Plafon Utama
            </span>
          </div>
          <p class="text-xl font-extrabold text-mandiri-navy mt-1 tracking-tight">
            ${formatRupiah(item.limit)}
          </p>

          ${(item.limit2 > 0 && item.limit2 !== item.limit) ? `
            <div class="mt-1.5 pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-600">
              <span class="text-[11px]">Opsi Plafon 2:</span>
              <span class="font-bold text-indigo-700 text-xs">${formatRupiah(item.limit2)}</span>
            </div>
          ` : ''}
        </div>

        <!-- Program Kelayakan -->
        <div class="text-xs text-slate-600 mb-3 bg-white p-2.5 rounded-xl border border-slate-100">
          <div class="font-bold text-slate-700 flex items-center mb-0.5 text-[11px]">
            <i class="fa-solid fa-file-shield text-mandiri-blue mr-1"></i>
            <span>Program Kelayakan:</span>
          </div>
          <p class="text-slate-600 line-clamp-2 leading-relaxed text-[11px]">
            ${escapeHtml(item.eligible || 'Eligible fasilitas kredit Mikro.')}
          </p>
        </div>

        <!-- Lokasi Alamat -->
        <div class="text-xs text-slate-500 mb-3 pt-1 border-t border-slate-100">
          <div class="flex items-center truncate">
            <i class="fa-solid fa-location-dot w-3.5 text-slate-400 mr-1.5 shrink-0"></i>
            <span class="truncate" title="${escapeHtml(item.alamat)}">${escapeHtml(item.alamat || 'Wilayah Bandung')}</span>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="pt-3 border-t border-slate-100 flex items-center gap-1.5">
        <!-- Tombol Catat Kunjungan -->
        <button onclick="openVisitModal('${item.id}')" class="py-2 px-2.5 rounded-xl ${
          visit.status === 'tertarik' ? 'bg-emerald-600 text-white' : visit.status === 'tidak_tertarik' ? 'bg-red-600 text-white' : 'bg-amber-400 hover:bg-amber-500 text-mandiri-dark'
        } text-xs font-bold shadow-xs transition flex items-center justify-center space-x-1" title="Catat status kunjungan/garapan sales">
          <i class="fa-solid fa-clipboard-check text-xs"></i>
          <span>${visit.status !== 'belum' ? 'Ubah Status' : 'Catat Garapan'}</span>
        </button>

        <button onclick="openDetailModal('${item.id}')" class="flex-1 py-2 px-2 rounded-xl bg-mandiri-navy hover:bg-mandiri-blue text-white text-xs font-semibold shadow-xs transition flex items-center justify-center space-x-1">
          <i class="fa-solid fa-magnifying-glass text-xs"></i>
          <span>Rincian</span>
        </button>

        ${item.hp && item.hp !== '0' ? `
          <button onclick="directChatWA('${item.id}')" class="p-2 rounded-xl ${
            userConsent ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300'
          } text-xs font-semibold shadow-xs transition flex items-center justify-center" title="${userConsent ? 'Chat WhatsApp' : 'Perhatian: Belum ada consent'}">
            <i class="fa-brands fa-whatsapp text-sm"></i>
          </button>
        ` : ''}
      </div>
    `;

    container.appendChild(card);
  });
}

// ================= RENDER TABLE VIEW =================
function renderTable(items, startNo) {
  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = '';

  items.forEach((item, index) => {
    const isKawan = isKawanLama(item);
    const isBoth = isBothProducts(item);
    const isPrdKur = isKUR(item);
    const userConsent = hasConsent(item);
    const visit = getVisitRecord(item);

    const tr = document.createElement('tr');
    tr.className = `hover:bg-blue-50/40 transition cursor-pointer ${
      visit.status === 'tertarik' ? 'bg-emerald-50/30' : visit.status === 'tidak_tertarik' ? 'bg-red-50/20' : isKawan ? 'bg-amber-50/20' : ''
    }`;

    // Status Garapan Badge untuk Tabel
    let statusGarapHtml = '';
    if (visit.status === 'tertarik') {
      statusGarapHtml = `
        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
          <i class="fa-solid fa-lock mr-1 text-[9px] text-emerald-600"></i> TERTARIK (${escapeHtml(visit.sales || 'Sales')})
        </span>
      `;
    } else if (visit.status === 'tidak_tertarik') {
      statusGarapHtml = `
        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800 border border-red-200">
          <i class="fa-solid fa-ban mr-1 text-[9px] text-red-600"></i> TIDAK TERTARIK
        </span>
      `;
    } else {
      statusGarapHtml = `
        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600">
          ⚪ Belum Digarap
        </span>
      `;
    }

    tr.innerHTML = `
      <td class="py-3 px-4 text-center text-slate-400">${startNo + index}</td>
      <td class="py-3 px-4 font-bold text-slate-800" onclick="openDetailModal('${item.id}')">
        <div class="flex items-center space-x-1.5">
          <span>${escapeHtml(item.nama)}</span>
          ${isKawan ? '<i class="fa-solid fa-star text-amber-500 text-xs" title="Kawan Lama"></i>' : ''}
        </div>
        <div class="text-[10px] text-slate-400 font-normal">${escapeHtml(item.sgp ? 'SGP: ' + item.sgp : '')}</div>
      </td>
      <td class="py-3 px-4" onclick="openVisitModal('${item.id}')">
        ${statusGarapHtml}
      </td>
      <td class="py-3 px-4 font-mono text-slate-700 text-xs">${escapeHtml(item.cifno || '-')}</td>
      <td class="py-3 px-4 font-mono text-slate-600 text-xs">
        <div class="flex items-center space-x-1.5">
          <span>${formatPhoneDisplay(item.hp)}</span>
          ${item.hp && item.hp !== '0' ? `
            <a href="https://wa.me/${cleanPhone(item.hp)}" target="_blank" class="text-emerald-600 hover:text-emerald-700" title="Buka WhatsApp">
              <i class="fa-brands fa-whatsapp"></i>
            </a>
          ` : ''}
        </div>
      </td>
      <td class="py-3 px-4">
        ${isBoth ? `
          <span class="px-2 py-0.5 rounded text-[11px] font-extrabold bg-purple-100 text-purple-800 border border-purple-200">
            KUR & KUM
          </span>
        ` : isPrdKur ? `
          <span class="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800">
            ${escapeHtml(item.produk)}
          </span>
        ` : `
          <span class="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-100 text-indigo-800">
            ${escapeHtml(item.produk)}
          </span>
        `}
      </td>
      <td class="py-3 px-4">
        ${isKawan ? `
          <span class="kawan-lama-badge px-2 py-0.5 rounded text-[11px] font-bold text-amber-800">
            ⭐ ${escapeHtml(item.kategori || 'Kawan Lama')}
          </span>
        ` : `
          <span class="text-slate-600 text-xs">${escapeHtml(item.kategori || 'Eksisting')}</span>
        `}
      </td>
      <td class="py-3 px-4 text-right font-extrabold text-mandiri-navy">
        ${formatRupiah(item.limit)}
      </td>
      <td class="py-3 px-4 text-center">
        <span class="px-2 py-0.5 rounded text-[10px] font-bold ${
          userConsent ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800 border border-amber-200'
        }">
          ${userConsent ? 'Ada Consent' : 'Kunjungan'}
        </span>
      </td>
      <td class="py-3 px-4 text-center">
        <div class="flex items-center justify-center space-x-1.5">
          <button onclick="openVisitModal('${item.id}')" class="p-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 transition" title="Catat Kunjungan">
            <i class="fa-solid fa-clipboard-check text-xs"></i>
          </button>
          <button onclick="openDetailModal('${item.id}')" class="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-mandiri-blue transition" title="Lihat Detail">
            <i class="fa-solid fa-eye text-xs"></i>
          </button>
          <button onclick="deleteNasabah('${item.id}')" class="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition" title="Hapus">
            <i class="fa-solid fa-trash-can text-xs"></i>
          </button>
        </div>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

// ================= MODAL CATAT KUNJUNGAN & GARAPAN =================
function openVisitModal(id) {
  const item = dbNasabah.find(n => String(n.id) === String(id));
  if (!item) return;

  currentVisitNasabah = item;
  const visit = getVisitRecord(item);

  document.getElementById('visitDebiturId').value = item.id;
  document.getElementById('visitDebiturCIF').value = item.cifno || item.id;
  document.getElementById('modalVisitDebiturNama').textContent = `${item.nama} (CIF: ${item.cifno || '-'})`;

  // Set radio button status
  const radios = document.querySelectorAll('input[name="radioVisitStatus"]');
  radios.forEach(r => {
    r.checked = (r.value === (visit.status || 'belum'));
  });

  // Nama sales: ambil dari visit sebelumnya, atau nama sales yang tersimpan di localStorage, atau SGP debitur
  const savedSalesName = localStorage.getItem('last_sales_name');
  document.getElementById('visitSalesName').value = visit.sales && visit.sales !== '-' ? visit.sales : (savedSalesName || item.sgp || '');
  document.getElementById('visitNotes').value = visit.catatan || '';

  document.getElementById('modalCatatKunjungan').classList.remove('hidden');
}

function closeVisitModal() {
  document.getElementById('modalCatatKunjungan').classList.add('hidden');
  currentVisitNasabah = null;
}

function handleVisitSubmit(e) {
  e.preventDefault();
  if (!currentVisitNasabah) return;

  const key = currentVisitNasabah.cifno || currentVisitNasabah.id;
  const selectedRadio = document.querySelector('input[name="radioVisitStatus"]:checked');
  const status = selectedRadio ? selectedRadio.value : 'belum';
  const sales = document.getElementById('visitSalesName').value.trim();
  const catatan = document.getElementById('visitNotes').value.trim();

  // Simpan nama sales untuk penggunaan berikutnya di HP/browser ini
  if (sales) {
    localStorage.setItem('last_sales_name', sales);
  }

  const now = new Date();
  const waktuFormatted = now.toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric'
  }) + ', ' + now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';

  const record = {
    status: status,
    sales: sales || 'Sales',
    waktu: waktuFormatted,
    catatan: catatan
  };

  // Push ke cloud dan simpan lokal
  pushVisitToCloud(key, record);

  closeVisitModal();

  if (status === 'tertarik') {
    showToast(`Status "${currentVisitNasabah.nama}" diset TERTARIK (Terkunci oleh ${sales})!`, 'success');
  } else if (status === 'tidak_tertarik') {
    showToast(`Status "${currentVisitNasabah.nama}" diset TIDAK TERTARIK.`, 'warning');
  } else {
    showToast(`Status "${currentVisitNasabah.nama}" di-reset ke Belum Digarap.`, 'info');
  }

  // Jika modal detail sedang terbuka untuk nasabah ini, perbarui tampilannya
  if (currentActiveNasabah && (currentActiveNasabah.id === currentVisitNasabah.id)) {
    updateModalDetailVisitSection(currentActiveNasabah);
  }
}

// ================= MODAL DETAIL NASABAH & SIMULASI =================
function updateModalDetailVisitSection(nasabah) {
  const visitSection = document.getElementById('modalDetailVisitSection');
  if (!visitSection) return;

  const visit = getVisitRecord(nasabah);

  if (visit.status === 'tertarik') {
    visitSection.className = 'p-4 rounded-2xl border-2 border-emerald-400 bg-emerald-50 text-emerald-950 space-y-2';
    visitSection.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="text-sm font-extrabold text-emerald-800 flex items-center">
          <i class="fa-solid fa-lock text-emerald-600 mr-2 text-base"></i> SUDAH DIGARAP: TERTARIK
        </span>
        <span class="text-xs font-bold bg-emerald-200 px-2.5 py-1 rounded-lg text-emerald-900">
          Oleh: ${escapeHtml(visit.sales)}
        </span>
      </div>
      <div class="p-2.5 bg-emerald-100/70 border border-emerald-200 rounded-xl text-xs text-emerald-900">
        <strong>⚠️ PEMBERITAHUAN UNTUK SALES LAIN:</strong><br>
        Nasabah ini telah dikunjungi/dihubungi oleh rekan Anda (<strong>${escapeHtml(visit.sales)}</strong>) pada <strong>${escapeHtml(visit.waktu)}</strong> dan menyatakan <strong>TERTARIK</strong>. Harap TIDAK menggarap nasabah ini untuk menghindari duplikasi penawaran!
      </div>
      ${visit.catatan ? `<div class="text-xs bg-white p-2.5 rounded-xl border border-emerald-200 text-slate-700"><strong>Catatan Prospek:</strong> ${escapeHtml(visit.catatan)}</div>` : ''}
    `;
  } else if (visit.status === 'tidak_tertarik') {
    visitSection.className = 'p-4 rounded-2xl border-2 border-red-300 bg-red-50 text-red-950 space-y-2';
    visitSection.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="text-sm font-extrabold text-red-700 flex items-center">
          <i class="fa-solid fa-ban text-red-600 mr-2 text-base"></i> SUDAH DIGARAP: TIDAK TERTARIK
        </span>
        <span class="text-xs font-bold bg-red-100 px-2.5 py-1 rounded-lg text-red-800">
          Oleh: ${escapeHtml(visit.sales)} (${escapeHtml(visit.waktu)})
        </span>
      </div>
      ${visit.catatan ? `<div class="text-xs bg-white p-2.5 rounded-xl border border-red-200 text-slate-700"><strong>Alasan Menolak / Tidak Tertarik:</strong> ${escapeHtml(visit.catatan)}</div>` : ''}
    `;
  } else {
    visitSection.className = 'p-3.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-700 flex items-center justify-between';
    visitSection.innerHTML = `
      <div class="flex items-center space-x-2">
        <i class="fa-regular fa-circle-dot text-slate-400 text-base"></i>
        <div>
          <span class="text-xs font-bold text-slate-800 block">Status: Belum Digarap</span>
          <span class="text-[11px] text-slate-500">Nasabah ini masih tersedia bebas untuk diprospek.</span>
        </div>
      </div>
      <span class="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
        Tersedia
      </span>
    `;
  }
}

function openDetailModal(id) {
  const nasabah = dbNasabah.find(n => String(n.id) === String(id));
  if (!nasabah) return;

  currentActiveNasabah = nasabah;
  const isKawan = isKawanLama(nasabah);
  const isBoth = isBothProducts(nasabah);
  const isPrdKur = isKUR(nasabah);
  const userConsent = hasConsent(nasabah);

  // Set Profile Fields
  document.getElementById('modalDetailNama').textContent = nasabah.nama || '-';
  document.getElementById('modalDetailCIF').textContent = nasabah.cifno || 'Tidak Ada';
  document.getElementById('modalDetailHP').textContent = formatPhoneDisplay(nasabah.hp);
  document.getElementById('modalDetailSGP').textContent = nasabah.sgp || '-';
  document.getElementById('modalDetailTindakan').textContent = nasabah.tindakan || (userConsent ? 'Boleh WA, SMS, Telepon, Kunjungan' : 'Hanya Boleh Kunjungan Langsung');
  document.getElementById('modalDetailAlamat').textContent = nasabah.alamat || 'Wilayah Bandung';

  // Perbarui Section Status Kunjungan
  updateModalDetailVisitSection(nasabah);

  // Badges
  const prdBadge = document.getElementById('modalDetailProdukBadge');
  if (isBoth) {
    prdBadge.className = 'both-badge px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider text-indigo-950';
    prdBadge.innerHTML = '<i class="fa-solid fa-shuffle text-indigo-600 mr-1"></i> BISA KUR & KUM (PILIHAN GANDA)';
  } else if (isPrdKur) {
    prdBadge.className = 'px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-100 text-blue-800';
    prdBadge.textContent = nasabah.produk;
  } else {
    prdBadge.className = 'px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-100 text-indigo-800';
    prdBadge.textContent = nasabah.produk;
  }

  const katBadge = document.getElementById('modalDetailKategoriBadge');
  if (isKawan) {
    katBadge.className = 'kawan-lama-badge px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-amber-800 flex items-center';
    katBadge.innerHTML = `<i class="fa-solid fa-star text-amber-500 mr-1 text-[11px]"></i> ⭐ ${escapeHtml(nasabah.kategori || 'KAWAN LAMA')}`;
  } else {
    katBadge.className = 'px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-100 text-slate-700';
    katBadge.textContent = nasabah.kategori || 'NASABAH REGULER';
  }

  const consentBadge = document.getElementById('modalDetailConsentBadge');
  if (userConsent) {
    consentBadge.className = 'text-xs px-2.5 py-1 rounded-lg font-bold bg-emerald-100 text-emerald-800 flex items-center';
    consentBadge.innerHTML = '<i class="fa-solid fa-circle-check mr-1 text-emerald-600"></i> Ada Consent WA/Telp';
  } else {
    consentBadge.className = 'text-xs px-2.5 py-1 rounded-lg font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center';
    consentBadge.innerHTML = '<i class="fa-solid fa-triangle-exclamation mr-1 text-amber-600"></i> Belum Ada Consent (Kunjungan Saja)';
  }

  // Limit & Multi-Limits Display
  document.getElementById('modalDetailLimit').textContent = formatRupiah(nasabah.limit);
  const multiContainer = document.getElementById('modalMultiLimitContainer');

  if (nasabah.limit2 > 0 && nasabah.limit2 !== nasabah.limit) {
    multiContainer.classList.remove('hidden');
    document.getElementById('modalLabelLimit1').textContent = nasabah.eligible1 ? `Plafon ${nasabah.eligible1}` : 'Plafon Pilihan 1';
    document.getElementById('modalValLimit1').textContent = formatRupiah(nasabah.limit1 || nasabah.limit);

    document.getElementById('modalLabelLimit2').textContent = nasabah.eligible2 ? `Plafon ${nasabah.eligible2}` : 'Plafon Pilihan 2';
    document.getElementById('modalValLimit2').textContent = formatRupiah(nasabah.limit2);
  } else {
    multiContainer.classList.add('hidden');
  }

  // Catatan Eligible
  document.getElementById('modalDetailEligibleNote').textContent = 
    nasabah.eligible || 'Memenuhi kriteria kelayakan pengajuan kredit.';

  // Simulasi Cicilan Angsuran (Limit Utama)
  const limit = Number(nasabah.limit) || 0;
  document.getElementById('simTenor12').textContent = formatRupiah(calculateInstallment(limit, 12, nasabah.produk));
  document.getElementById('simTenor24').textContent = formatRupiah(calculateInstallment(limit, 24, nasabah.produk));
  document.getElementById('simTenor36').textContent = formatRupiah(calculateInstallment(limit, 36, nasabah.produk));
  document.getElementById('simTenor48').textContent = formatRupiah(calculateInstallment(limit, 48, nasabah.produk));

  // WhatsApp Link
  const phoneClean = cleanPhone(nasabah.hp);
  const linkWA = document.getElementById('linkWA');
  const btnSendWA = document.getElementById('btnSendWA');

  if (phoneClean) {
    linkWA.href = `https://wa.me/${phoneClean}`;
    linkWA.classList.remove('hidden');
    btnSendWA.disabled = false;
  } else {
    linkWA.classList.add('hidden');
    btnSendWA.disabled = true;
  }

  updateWhatsAppPreview();
  document.getElementById('modalDetailNasabah').classList.remove('hidden');
}

function closeDetailModal() {
  document.getElementById('modalDetailNasabah').classList.add('hidden');
  currentActiveNasabah = null;
}

function updateWhatsAppPreview() {
  if (!currentActiveNasabah) return;
  const templateType = document.getElementById('selectWaTemplate').value;
  const n = currentActiveNasabah;
  const limitStr = formatRupiah(n.limit);
  const cicilan36 = formatRupiah(calculateInstallment(n.limit, 36, n.produk));
  const namaSgp = n.sgp ? ` (${n.sgp})` : '';

  let msg = '';
  if (templateType === 'kawanlama') {
    msg = `Halo Selamat Pagi/Siang Bapak/Ibu ${n.nama},\n\nKami dari Bank Mandiri Unit Mikro${namaSgp}. Berdasarkan data fasilitas sebelumnya, Bapak/Ibu merupakan nasabah prioritas *Kawan Lama* kami yang berhak mendapatkan fasilitas tambahan modal usaha *${n.produk}* dengan eligible limit plafon hingga *${limitStr}*.\n\nEstimasi angsuran ringan mulai dari ${cicilan36}/bulan (tenor 3 tahun). Apakah ada rencana penambahan modal usaha dalam waktu dekat? Kami siap membantu prosesnya secara cepat. Terima kasih.`;
  } else if (templateType === 'singkat') {
    msg = `Halo Bapak/Ibu ${n.nama}, kami dari Bank Mandiri Mikro${namaSgp}. Fasilitas kredit modal usaha Bapak/Ibu (*${n.produk}*) terkonfirmasi eligible dengan limit plafon *${limitStr}*. Jika tertarik, silakan balas pesan ini ya. Salam sukses selalu!`;
  } else {
    msg = `Yth. Bapak/Ibu ${n.nama},\n\nPerkenankan kami dari Bank Mandiri Unit Mikro${namaSgp} menyampaikan informasi kelayakan fasilitas kredit usaha Anda:\n• Nama: ${n.nama}\n• No CIF: ${n.cifno || '-'}\n• Produk Kredit: ${n.produk}\n• Kategori: ${n.kategori}\n• Eligible Limit Plafon: ${limitStr}\n• Estimasi Angsuran (36 bln): ${cicilan36}/bln\n\nPersyaratan cukup KTP, KK, dan SKU. Silakan hubungi kami untuk informasi lebih lanjut. Terima kasih.`;
  }

  document.getElementById('textWaPreview').value = msg;
}

function directChatWA(id) {
  const nasabah = dbNasabah.find(n => String(n.id) === String(id));
  if (!nasabah || !nasabah.hp || nasabah.hp === '0') {
    showToast('Nomor HP debitur tidak tersedia', 'warning');
    return;
  }
  openDetailModal(id);
  sendWhatsAppMessage();
}

function sendWhatsAppMessage() {
  if (!currentActiveNasabah || !currentActiveNasabah.hp) {
    showToast('Nomor HP debitur tidak valid', 'warning');
    return;
  }

  const visit = getVisitRecord(currentActiveNasabah);
  if (visit.status === 'tertarik') {
    if (!confirm(`PERHATIAN KOORDINASI SALES:\nNasabah ini sudah digarap oleh "${visit.sales}" dengan status TERTARIK.\n\nApakah Anda yakin ingin tetap membuka WhatsApp nasabah ini?`)) {
      return;
    }
  }

  if (!hasConsent(currentActiveNasabah)) {
    if (!confirm('PERINGATAN KEPATUHAN:\nData menunjukkan debitur ini "Belum Ada Consent" untuk pesan instan (hanya boleh kunjungan langsung).\n\nApakah Anda tetap ingin membuka WhatsApp?')) {
      return;
    }
  }

  const clean = cleanPhone(currentActiveNasabah.hp);
  const text = encodeURIComponent(document.getElementById('textWaPreview').value);
  const url = `https://api.whatsapp.com/send?phone=${clean}&text=${text}`;
  window.open(url, '_blank');
}

function copySummaryToClipboard() {
  if (!currentActiveNasabah) return;
  const n = currentActiveNasabah;
  const visit = getVisitRecord(n);

  const text = `HASIL KELAYAKAN KREDIT MIKRO MANDIRI\nNama: ${n.nama}\nCIF: ${n.cifno || '-'}\nNo HP: ${n.hp || '-'}\nProduk: ${n.produk}\nKategori: ${n.kategori}\nEligible Limit: ${formatRupiah(n.limit)}\nStatus Kunjungan: ${visit.status.toUpperCase()} (Oleh: ${visit.sales})\nProgram: ${n.eligible || '-'}\nPetugas SGP: ${n.sgp || '-'}\nSimulasi Cicilan (36 bln): ${formatRupiah(calculateInstallment(n.limit, 36, n.produk))}/bln`;

  navigator.clipboard.writeText(text).then(() => {
    showToast('Ringkasan kelayakan berhasil disalin ke clipboard!', 'success');
  }).catch(() => {
    showToast('Gagal menyalin text', 'error');
  });
}

function printScreeningSlip() {
  if (!currentActiveNasabah) return;
  const n = currentActiveNasabah;
  const visit = getVisitRecord(n);
  const now = new Date();
  const dateFormatted = now.toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric'
  });

  document.getElementById('printDate').textContent = dateFormatted;
  document.getElementById('printNama').textContent = n.nama || '-';
  document.getElementById('printCIF').textContent = n.cifno || '-';
  document.getElementById('printHP').textContent = formatPhoneDisplay(n.hp);
  document.getElementById('printAlamat').textContent = n.alamat || '-';
  document.getElementById('printSGP').textContent = `${n.sgp || '-'} (Status Garapan: ${visit.status.toUpperCase()})`;
  document.getElementById('printKategori').textContent = n.kategori || 'Kawan Lama';
  document.getElementById('printProduk').textContent = n.produk || 'Kredit Mikro';
  document.getElementById('printLimit').textContent = formatRupiah(n.limit);
  document.getElementById('printEligibleNote').textContent = n.eligible || 'Memenuhi kriteria kelayakan kredit.';

  const limit = Number(n.limit) || 0;
  document.getElementById('printSim12').textContent = formatRupiah(calculateInstallment(limit, 12, n.produk));
  document.getElementById('printSim24').textContent = formatRupiah(calculateInstallment(limit, 24, n.produk));
  document.getElementById('printSim36').textContent = formatRupiah(calculateInstallment(limit, 36, n.produk));
  document.getElementById('printSim48').textContent = formatRupiah(calculateInstallment(limit, 48, n.produk));

  window.print();
}

// ================= EKSPOR LAPORAN KUNJUNGAN SALES (EXCEL) =================
function exportLaporanKunjunganExcel() {
  if (dbNasabah.length === 0) {
    showToast('Tidak ada data untuk diekspor', 'warning');
    return;
  }

  const exportList = dbNasabah.map((item, idx) => {
    const v = getVisitRecord(item);
    let statusText = 'Belum Digarap';
    if (v.status === 'tertarik') statusText = 'TERTARIK (Minat Kredit)';
    else if (v.status === 'tidak_tertarik') statusText = 'TIDAK TERTARIK';

    return {
      'No': idx + 1,
      'Nama Debitur': item.nama,
      'No CIF': item.cifno,
      'No WhatsApp / HP': item.hp,
      'Status Kunjungan': statusText,
      'Sales yang Menggarap': v.sales !== '-' ? v.sales : '',
      'Waktu Kunjungan': v.waktu !== '-' ? v.waktu : '',
      'Catatan Hasil Prospek': v.catatan || '',
      'Petugas SGP Asal': item.sgp,
      'Produk Kredit': item.produk,
      'Kategori': item.kategori,
      'Eligible Limit Utama (Rp)': item.limit,
      'Limit Opsi 2 (Rp)': item.limit2 || '',
      'Program Kelayakan': item.eligible,
      'Consent': item.consent,
      'Alamat': item.alamat
    };
  });

  const ws = XLSX.utils.json_to_sheet(exportList);
  ws['!cols'] = [
    { wch: 6 },
    { wch: 26 },
    { wch: 16 },
    { wch: 18 },
    { wch: 26 },
    { wch: 25 },
    { wch: 22 },
    { wch: 35 },
    { wch: 25 },
    { wch: 28 },
    { wch: 22 },
    { wch: 22 },
    { wch: 18 },
    { wch: 45 },
    { wch: 16 },
    { wch: 40 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Laporan Kunjungan');
  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `Laporan_Kunjungan_Sales_Mandiri_${dateStr}.xlsx`);
  showToast('Laporan Kunjungan Tim berhasil diekspor ke Excel!', 'success');
}

// ================= EXCEL & CSV SMART PARSER =================
function handleExcelUpload(file) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      if (!rawRows || rawRows.length === 0) {
        showToast('File Excel kosong atau tidak memiliki data', 'error');
        return;
      }

      const mappedRows = mapExcelRows(rawRows);
      pendingImportData = mappedRows;

      document.getElementById('previewFileName').textContent = file.name;
      document.getElementById('previewRowCount').textContent = `${mappedRows.length} baris debitur ditemukan`;
      renderPreviewTable(mappedRows.slice(0, 3));

      document.getElementById('uploadPreviewSection').classList.remove('hidden');
      document.getElementById('btnProcessImport').disabled = false;

    } catch (err) {
      console.error(err);
      showToast('Gagal membaca file Excel. Pastikan format valid (.xlsx, .xls, .csv)', 'error');
    }
  };

  reader.readAsArrayBuffer(file);
}

function mapExcelRows(rawRows) {
  if (rawRows.length === 0) return [];
  const headers = Object.keys(rawRows[0]);

  const isMandiriLeadsFormat = headers.some(h => h.toLowerCase().includes('cifno') || h.toLowerCase().includes('max limit eligible'));

  if (isMandiriLeadsFormat) {
    return rawRows.map((r, i) => {
      const lim1 = cleanNumber(r['Max Limit Eligible_1'] || r['max limit eligible_1'] || 0);
      const lim2 = cleanNumber(r['Max Limit Eligible_2'] || r['max limit eligible_2'] || 0);
      const lim3 = cleanNumber(r['Max Limit Eligible_3'] || r['max limit eligible_3'] || 0);
      const primaryLimit = Math.max(lim1, lim2, lim3);

      const p1 = String(r.prod_1 || r.PROD_1 || '').toUpperCase();
      const p2 = String(r.prod_2 || r.PROD_2 || '').toUpperCase();
      const p3 = String(r.prod_3 || r.PROD_3 || '').toUpperCase();
      const leadsKur = String(r['Leads KUR Mikro'] || '');
      const el1 = String(r.Eligible_1 || '');

      const canKur = p1.includes('KUR') || p2.includes('KUR') || p3.includes('KUR') || p1.includes('BOTH') || p2.includes('BOTH') || el1.includes('KUR') || leadsKur.includes('KUR');
      const canKum = p1.includes('KUM') || p2.includes('KUM') || p3.includes('KUM') || p1.includes('BOTH') || p2.includes('BOTH') || el1.includes('KUM') || el1.includes('AMUNISI') || el1.includes('MADU');

      let produk = 'Kredit Mikro';
      if (canKur && canKum) produk = 'Bisa KUR & KUM (Pilihan Ganda)';
      else if (canKur) produk = (leadsKur ? 'KUR (' + leadsKur.replace('Leads ', '') + ')' : 'KUR Mikro / Kecil');
      else if (canKum) produk = 'KUM Mikro';

      const lg = String(r['Leads Group'] || '').toUpperCase();
      const tierKl = String(r['Tier Usia Lunas Kawan Lama'] || '');
      const irisan = String(r['Ketr. Irisan Leads KUM Eligible_1'] || '');

      let kategori = lg || 'Eksisting';
      if (lg === 'KL' || tierKl || el1.includes('KawanLama') || el1.includes('KL') || irisan.includes('Kawan Lama')) {
        let sub = '';
        if (tierKl.includes('s.d 3bln')) sub = ' (Lunas ≤ 3 Bln)';
        else if (tierKl.includes('3bln s.d 12bln')) sub = ' (Lunas 3-12 Bln)';
        else if (tierKl.includes('>12bln')) sub = ' (Lunas > 12 Bln)';
        kategori = 'Kawan Lama' + sub;
      } else if (lg.includes('ETB') || el1.includes('Ex-KUR') || el1.includes('Top Up')) {
        const tierBade = String(r['Tier Sisa Bade'] || '');
        kategori = 'ETB / Suplesi' + (tierBade ? ' (' + tierBade.replace('03. ', '').replace('02. ', '').replace('01. ', '') + ')' : '');
      } else if (lg === 'ULTIMA' || el1.includes('Ultima')) {
        kategori = 'KUR Ultima';
      }

      const elgParts = [];
      if (r.Eligible_1) elgParts.push('Program: ' + r.Eligible_1);
      if (r.Eligible_2) elgParts.push('Opsi 2: ' + r.Eligible_2);
      if (r.Eligible_3) elgParts.push('Opsi 3: ' + r.Eligible_3);
      if (r['Ketr. Irisan Leads KUM Eligible_1']) elgParts.push(r['Ketr. Irisan Leads KUM Eligible_1']);
      if (r['Leads KUR Mikro']) elgParts.push(r['Leads KUR Mikro']);
      if (r['Tier Sisa Bade']) elgParts.push(r['Tier Sisa Bade']);

      let hp = String(r['No HP'] || r['no hp'] || '').trim();
      if (hp === '0' || hp === 'NULL') hp = '';

      return {
        id: 'cif-' + (r.cifno || (1000 + i)),
        cifno: String(r.cifno || ''),
        nama: String(r['Nama Debitur'] || r['nama debitur'] || r.Nama || `Debitur ${i + 1}`).trim(),
        hp: hp,
        sgp: String(r.sgp_nama || r['SGP Nama'] || '').trim(),
        alamat: [r.Alamat, r.Kelurahan, r.Kecamatan, r['Kode Pos']].filter(Boolean).join(', '),
        rt_rw: (r.RT && r.RW) ? 'RT ' + r.RT + ' / RW ' + r.RW : '',
        produk: produk,
        kategori: kategori,
        limit: primaryLimit,
        limit1: lim1,
        limit2: lim2,
        limit3: lim3,
        eligible: elgParts.join(' • ') || 'Eligible untuk pengajuan fasilitas kredit.',
        eligible1: r.Eligible_1 || '',
        eligible2: r.Eligible_2 || '',
        eligible3: r.Eligible_3 || '',
        consent: r.Consent || 'Ada Consent',
        tindakan: r.Tindakan || 'Pesan Instan (WA,dll), Telepon, SMS, Kunjungan Langsung',
        tanggal: new Date().toISOString().split('T')[0]
      };
    });
  }

  const findKey = (keywords) => {
    for (const h of headers) {
      const norm = h.toLowerCase().replace(/[^a-z0-9]/g, '');
      for (const kw of keywords) {
        if (norm.includes(kw)) return h;
      }
    }
    return null;
  };

  const keyNama = findKey(['nama', 'debitur', 'nasabah', 'pemohon']);
  const keyCIF = findKey(['cif', 'cifno', 'nocif']);
  const keyHP = findKey(['hp', 'nohp', 'telp', 'wa', 'whatsapp', 'phone']);
  const keyProduk = findKey(['produk', 'product', 'jenis', 'kredit', 'program']);
  const keyKategori = findKey(['kategori', 'kawanlama', 'segmen']);
  const keyLimit = findKey(['limit', 'plafon', 'nominal', 'maksimal']);
  const keyEligible = findKey(['eligible', 'kelayakan', 'keterangan']);
  const keyAlamat = findKey(['alamat', 'kota', 'wilayah']);
  const keySgp = findKey(['sgp', 'petugas', 'rm', 'mantri']);

  return rawRows.map((row, idx) => {
    let limit = 0;
    if (keyLimit && row[keyLimit] !== undefined) {
      limit = cleanNumber(row[keyLimit]);
    }

    return {
      id: 'imp-' + Date.now() + '-' + idx,
      cifno: keyCIF ? String(row[keyCIF] || '').trim() : '',
      nama: keyNama ? String(row[keyNama] || '').trim() : `Debitur ${idx + 1}`,
      hp: keyHP ? String(row[keyHP] || '').trim() : '',
      sgp: keySgp ? String(row[keySgp] || '').trim() : '',
      produk: keyProduk ? String(row[keyProduk] || '').trim() : 'KUR Mikro',
      kategori: keyKategori ? String(row[keyKategori] || '').trim() : 'Kawan Lama',
      limit: limit,
      limit1: limit,
      limit2: 0,
      limit3: 0,
      eligible: keyEligible ? String(row[keyEligible] || '').trim() : 'Memenuhi syarat kelayakan kredit.',
      alamat: keyAlamat ? String(row[keyAlamat] || '').trim() : 'Wilayah Bandung',
      consent: 'Ada Consent',
      tindakan: 'Pesan Instan (WA,dll), Telepon, SMS, Kunjungan Langsung',
      tanggal: new Date().toISOString().split('T')[0]
    };
  });
}

function renderPreviewTable(rows) {
  const table = document.getElementById('previewTable');
  table.innerHTML = `
    <thead class="bg-slate-100 text-slate-700 font-bold">
      <tr>
        <th class="p-2">Nama Debitur</th>
        <th class="p-2">No CIF</th>
        <th class="p-2">No HP</th>
        <th class="p-2">Produk</th>
        <th class="p-2">Kategori</th>
        <th class="p-2">Plafon Limit</th>
      </tr>
    </thead>
    <tbody class="divide-y divide-slate-100">
      ${rows.map(r => `
        <tr>
          <td class="p-2 font-bold text-slate-800">${escapeHtml(r.nama)}</td>
          <td class="p-2 font-mono">${escapeHtml(r.cifno || '-')}</td>
          <td class="p-2 font-mono">${escapeHtml(r.hp || '-')}</td>
          <td class="p-2">${escapeHtml(r.produk)}</td>
          <td class="p-2">${escapeHtml(r.kategori)}</td>
          <td class="p-2 font-bold text-mandiri-navy">${formatRupiah(r.limit)}</td>
        </tr>
      `).join('')}
    </tbody>
  `;
}

function processFinalImport() {
  if (!pendingImportData || pendingImportData.length === 0) return;

  const mode = document.querySelector('input[name="importMode"]:checked').value;
  if (mode === 'replace') {
    dbNasabah = [...pendingImportData];
  } else {
    dbNasabah = [...dbNasabah, ...pendingImportData];
  }

  saveDatabase();
  populateSgpDropdown();
  updateUI();
  closeUploadModal();
  showToast(`Sukses memuat ${pendingImportData.length} data debitur ke sistem!`, 'success');
  pendingImportData = [];
}

function downloadTemplateExcel() {
  window.open('contoh_data_nasabah.xlsx', '_blank');
  showToast('File Excel pipeline berhasil diunduh!', 'success');
}

function exportDatabaseToExcel() {
  if (dbNasabah.length === 0) {
    showToast('Tidak ada data untuk diekspor', 'warning');
    return;
  }

  const exportList = dbNasabah.map((item, idx) => ({
    'No': idx + 1,
    'Nama Debitur': item.nama,
    'No CIF': item.cifno,
    'No WhatsApp / HP': item.hp,
    'Petugas SGP / RM': item.sgp,
    'Produk Kredit': item.produk,
    'Kategori': item.kategori,
    'Eligible Limit Utama (Rp)': item.limit,
    'Limit Opsi 2 (Rp)': item.limit2 || '',
    'Program & Kelayakan': item.eligible,
    'Consent Status': item.consent,
    'Alamat': item.alamat
  }));

  const ws = XLSX.utils.json_to_sheet(exportList);
  ws['!cols'] = [
    { wch: 6 },
    { wch: 26 },
    { wch: 16 },
    { wch: 18 },
    { wch: 25 },
    { wch: 28 },
    { wch: 22 },
    { wch: 22 },
    { wch: 18 },
    { wch: 50 },
    { wch: 16 },
    { wch: 40 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Pipeline Debitur');
  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `Pipeline_Debitur_Mandiri_${dateStr}.xlsx`);
  showToast('Database berhasil diekspor ke file Excel!', 'success');
}

// ================= CRUD MANUAL =================
function openAddModal() {
  document.getElementById('modalFormTitle').textContent = 'Tambah Debitur Baru';
  document.getElementById('formNasabahId').value = '';
  document.getElementById('nasabahForm').reset();
  document.getElementById('modalNasabahForm').classList.remove('hidden');
}

function openEditModal(id) {
  const item = dbNasabah.find(n => String(n.id) === String(id));
  if (!item) return;

  document.getElementById('modalFormTitle').textContent = 'Edit Data Debitur';
  document.getElementById('formNasabahId').value = item.id;
  document.getElementById('formNama').value = item.nama || '';
  document.getElementById('formCIF').value = item.cifno || '';
  document.getElementById('formHP').value = item.hp || '';
  document.getElementById('formProduk').value = item.produk || 'Bisa KUR & KUM (Pilihan Ganda)';
  document.getElementById('formKategori').value = item.kategori || 'Kawan Lama';
  document.getElementById('formLimit').value = item.limit || 0;
  document.getElementById('formSGP').value = item.sgp || '';
  document.getElementById('formEligibleNote').value = item.eligible || '';
  document.getElementById('formAlamat').value = item.alamat || '';

  document.getElementById('modalNasabahForm').classList.remove('hidden');
}

function closeFormModal() {
  document.getElementById('modalNasabahForm').classList.add('hidden');
}

function handleFormSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('formNasabahId').value;
  const nama = document.getElementById('formNama').value.trim();
  const cifno = document.getElementById('formCIF').value.trim();
  const hp = document.getElementById('formHP').value.trim();
  const produk = document.getElementById('formProduk').value;
  const kategori = document.getElementById('formKategori').value;
  const limit = cleanNumber(document.getElementById('formLimit').value);
  const sgp = document.getElementById('formSGP').value.trim();
  const eligible = document.getElementById('formEligibleNote').value.trim();
  const alamat = document.getElementById('formAlamat').value.trim();

  if (id) {
    const idx = dbNasabah.findIndex(n => String(n.id) === String(id));
    if (idx !== -1) {
      dbNasabah[idx] = {
        ...dbNasabah[idx],
        nama, cifno, hp, produk, kategori, limit, sgp, eligible, alamat
      };
      showToast('Data debitur berhasil diperbarui!', 'success');
    }
  } else {
    const newNasabah = {
      id: 'manual-' + Date.now(),
      cifno, nama, hp, produk, kategori, limit, limit1: limit, limit2: 0,
      sgp, eligible, alamat, consent: 'Ada Consent',
      tindakan: 'Pesan Instan (WA,dll), Telepon, SMS, Kunjungan Langsung',
      tanggal: new Date().toISOString().split('T')[0]
    };
    dbNasabah.unshift(newNasabah);
    showToast('Debitur baru berhasil ditambahkan!', 'success');
  }

  saveDatabase();
  closeFormModal();
  populateSgpDropdown();
  updateUI();
}

function deleteNasabah(id) {
  const item = dbNasabah.find(n => String(n.id) === String(id));
  if (!item) return;

  if (confirm(`Apakah Anda yakin ingin menghapus data "${item.nama}"?`)) {
    dbNasabah = dbNasabah.filter(n => String(n.id) !== String(id));
    saveDatabase();
    populateSgpDropdown();
    updateUI();
    showToast(`Data ${item.nama} telah dihapus.`, 'info');
  }
}

function resetAllDatabase() {
  if (confirm('Apakah Anda yakin ingin MENGHAPUS SEMUA DATA pipeline?')) {
    dbNasabah = [];
    saveDatabase();
    populateSgpDropdown();
    updateUI();
    showToast('Database pipeline berhasil dikosongkan.', 'info');
  }
}

// ================= MODAL UPLOAD =================
function openUploadModal() {
  document.getElementById('excelFileInput').value = '';
  document.getElementById('uploadPreviewSection').classList.add('hidden');
  document.getElementById('btnProcessImport').disabled = true;
  document.getElementById('modalUpload').classList.remove('hidden');
}

function closeUploadModal() {
  document.getElementById('modalUpload').classList.add('hidden');
}

// ================= TOAST NOTIFICATION =================
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  
  let bg = 'bg-slate-800 text-white';
  let icon = '<i class="fa-solid fa-circle-info mr-2 text-blue-400"></i>';
  if (type === 'success') {
    bg = 'bg-emerald-600 text-white';
    icon = '<i class="fa-solid fa-circle-check mr-2"></i>';
  } else if (type === 'warning') {
    bg = 'bg-amber-600 text-white';
    icon = '<i class="fa-solid fa-triangle-exclamation mr-2"></i>';
  } else if (type === 'error') {
    bg = 'bg-red-600 text-white';
    icon = '<i class="fa-solid fa-circle-xmark mr-2"></i>';
  }

  toast.className = `${bg} px-4 py-3 rounded-2xl shadow-xl flex items-center text-xs sm:text-sm font-semibold pointer-events-auto transform transition-all duration-300 animate-in slide-in-from-bottom`;
  toast.innerHTML = `${icon} <span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ================= EVENT LISTENERS =================
function setupEventListeners() {
  const searchInput = document.getElementById('searchInput');
  const btnClearSearch = document.getElementById('btnClearSearch');

  let debounceTimer = null;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    const val = e.target.value;
    currentSearch = val;
    currentPage = 1;

    if (val) {
      btnClearSearch.classList.remove('hidden');
    } else {
      btnClearSearch.classList.add('hidden');
    }

    debounceTimer = setTimeout(() => {
      renderContent();
    }, 150);
  });

  btnClearSearch.addEventListener('click', () => {
    searchInput.value = '';
    currentSearch = '';
    btnClearSearch.classList.add('hidden');
    currentPage = 1;
    renderContent();
    searchInput.focus();
  });

  // Global Keyboard Shortcuts
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey && e.key === 'k') || (e.key === '/' && document.activeElement !== searchInput && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA')) {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    } else if (e.key === 'Escape') {
      closeDetailModal();
      closeVisitModal();
      closeUploadModal();
      closeFormModal();
    }
  });

  // Filter Chips
  document.querySelectorAll('.filter-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(b => {
        b.classList.remove('active', 'bg-mandiri-navy', 'text-white', 'border-mandiri-navy');
        b.classList.add('border-slate-200', 'bg-white', 'text-slate-700');
      });

      btn.classList.add('active', 'bg-mandiri-navy', 'text-white', 'border-mandiri-navy');
      btn.classList.remove('border-slate-200', 'bg-white', 'text-slate-700');

      currentFilter = btn.dataset.filter;
      currentPage = 1;
      renderContent();
    });
  });

  // Dropdown Petugas SGP Filter
  document.getElementById('selectSgpFilter').addEventListener('change', (e) => {
    currentSgpFilter = e.target.value;
    currentPage = 1;
    renderContent();
  });

  // View Switcher (Cards vs Table)
  const btnViewCards = document.getElementById('btnViewCards');
  const btnViewTable = document.getElementById('btnViewTable');

  btnViewCards.addEventListener('click', () => {
    currentView = 'cards';
    btnViewCards.classList.add('bg-white', 'text-mandiri-navy', 'shadow-xs');
    btnViewCards.classList.remove('text-slate-600');
    btnViewTable.classList.remove('bg-white', 'text-mandiri-navy', 'shadow-xs');
    btnViewTable.classList.add('text-slate-600');
    renderContent();
  });

  btnViewTable.addEventListener('click', () => {
    currentView = 'table';
    btnViewTable.classList.add('bg-white', 'text-mandiri-navy', 'shadow-xs');
    btnViewTable.classList.remove('text-slate-600');
    btnViewCards.classList.remove('bg-white', 'text-mandiri-navy', 'shadow-xs');
    btnViewCards.classList.add('text-slate-600');
    renderContent();
  });

  // Table Page Size
  document.getElementById('selectPageSize').addEventListener('change', (e) => {
    pageSize = Number(e.target.value);
    currentPage = 1;
    renderContent();
  });

  // Table Headers Sort
  document.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.sort;
      if (activeSort.column === col) {
        activeSort.direction = activeSort.direction === 'asc' ? 'desc' : 'asc';
      } else {
        activeSort.column = col;
        activeSort.direction = 'asc';
      }
      renderContent();
    });
  });

  // Reset Search Match
  document.getElementById('btnResetSearchMatch').addEventListener('click', () => {
    searchInput.value = '';
    currentSearch = '';
    btnClearSearch.classList.add('hidden');
    currentFilter = 'all';
    currentPage = 1;
    renderContent();
  });

  document.getElementById('btnDirectAddNasabah').addEventListener('click', () => {
    openAddModal();
    if (currentSearch) {
      document.getElementById('formNama').value = currentSearch;
    }
  });

  // Top Buttons
  document.getElementById('btnSyncTeam').addEventListener('click', () => syncFromCloud(true));
  document.getElementById('btnExportLaporanKunjungan').addEventListener('click', exportLaporanKunjunganExcel);
  document.getElementById('btnOpenUploadModal').addEventListener('click', openUploadModal);
  document.getElementById('btnEmptyUpload').addEventListener('click', openUploadModal);
  document.getElementById('btnCloseModalUpload').addEventListener('click', closeUploadModal);
  document.getElementById('btnCancelUpload').addEventListener('click', closeUploadModal);

  document.getElementById('btnDownloadTemplateFromModal').addEventListener('click', downloadTemplateExcel);

  document.getElementById('btnExportExcel').addEventListener('click', exportDatabaseToExcel);
  document.getElementById('btnResetDatabase').addEventListener('click', resetAllDatabase);

  document.getElementById('btnOpenAddModal').addEventListener('click', openAddModal);
  document.getElementById('btnCloseModalForm').addEventListener('click', closeFormModal);
  document.getElementById('btnCancelForm').addEventListener('click', closeFormModal);
  document.getElementById('nasabahForm').addEventListener('submit', handleFormSubmit);

  // Modal Catat Kunjungan
  document.getElementById('btnCloseModalVisit').addEventListener('click', closeVisitModal);
  document.getElementById('btnCancelVisit').addEventListener('click', closeVisitModal);
  document.getElementById('formVisitStatus').addEventListener('submit', handleVisitSubmit);
  document.getElementById('btnOpenVisitFromDetail').addEventListener('click', () => {
    if (currentActiveNasabah) {
      openVisitModal(currentActiveNasabah.id);
    }
  });

  // Modal Detail Close
  document.getElementById('btnCloseModalDetail').addEventListener('click', closeDetailModal);

  // Copy CIF
  document.getElementById('btnCopyCIF').addEventListener('click', () => {
    if (!currentActiveNasabah) return;
    navigator.clipboard.writeText(currentActiveNasabah.cifno || '').then(() => {
      showToast('Nomor CIF berhasil disalin!', 'success');
    });
  });

  // WhatsApp actions
  document.getElementById('selectWaTemplate').addEventListener('change', updateWhatsAppPreview);
  document.getElementById('btnSendWA').addEventListener('click', sendWhatsAppMessage);
  document.getElementById('btnCopySummary').addEventListener('click', copySummaryToClipboard);
  document.getElementById('btnPrintSlip').addEventListener('click', printScreeningSlip);

  // Upload Drag & Drop & File Input
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('excelFileInput');

  dropZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleExcelUpload(e.target.files[0]);
    }
  });

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('border-mandiri-blue', 'bg-blue-50/60');
  });

  dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.classList.remove('border-mandiri-blue', 'bg-blue-50/60');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('border-mandiri-blue', 'bg-blue-50/60');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleExcelUpload(e.dataTransfer.files[0]);
    }
  });

  document.getElementById('btnProcessImport').addEventListener('click', processFinalImport);
}
