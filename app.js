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
  loadTagihanDatabase();
  loadTagihanFollowupRecords();
  loadBookingDatabase();
  setupEventListeners();
  setupTagihanEventListeners();
  setupBookingEventListeners();
  populateSgpDropdown();
  populateTagihanPetugasDropdown();
  updateUI();
  updateTagihanUI();
  updateTagihanTabBadge();
  updateBookingTabBadge();
});

// ================= STORAGE & SYNC FUNCTIONS =================
function loadDatabase() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && Array.isArray(parsed) && parsed.length > 0) {
      dbNasabah = parsed;
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

function updateLastSyncTime() {
  const lbl = document.getElementById('lblLastSync');
  if (lbl) {
    const now = new Date();
    lbl.textContent = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
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

// ================= CLOUD TEAM SYNC (DISABLED / LOCAL ONLY) =================
async function syncFromCloud(showFeedback = false) {
  // Cloud sync disabled for data privacy and security
  if (showFeedback) {
    showToast('Mode offline aktif - data hanya disimpan di browser lokal.', 'info');
  }
}

async function pushVisitToCloud(key, record) {
  // Simpan lokal saja (tidak mengirim data ke server publik pihak ketiga)
  visitRecords[key] = record;
  saveVisitRecordsLocally();
  updateUI();
  return { success: true };
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

  const tabBadgePipe = document.getElementById('tabBadgePipelineCount');
  if (tabBadgePipe) tabBadgePipe.textContent = total;
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

// ================= PAGINATION HANDLERS =================
function renderCardsPagination(totalItems, start, end, totalPages) {
  const container = document.getElementById('cardsPaginationContainer');
  if (!container) return;
  if (totalPages <= 1) {
    container.classList.add('hidden');
    return;
  }
  container.classList.remove('hidden');

  const infoEl = document.getElementById('cardsPaginationInfo');
  if (infoEl) {
    infoEl.textContent = `Menampilkan ${start} - ${end} dari ${totalItems} nasabah`;
  }

  const btnsContainer = document.getElementById('cardsPaginationButtons');
  if (!btnsContainer) return;
  btnsContainer.innerHTML = '';

  // Prev Button
  const prevBtn = document.createElement('button');
  prevBtn.className = `px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold transition ${
    currentPage === 1 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-100'
  }`;
  prevBtn.innerHTML = '<i class="fa-solid fa-chevron-left mr-1"></i> Sebelumnya';
  prevBtn.disabled = currentPage === 1;
  prevBtn.onclick = () => { if (currentPage > 1) { currentPage--; renderContent(); scrollToTop(); } };
  btnsContainer.appendChild(prevBtn);

  // Page Numbers
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
      const pageBtn = document.createElement('button');
      pageBtn.className = `w-8 h-8 rounded-lg font-bold text-xs transition ${
        currentPage === i 
          ? 'bg-mandiri-navy text-white shadow-xs' 
          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
      }`;
      pageBtn.textContent = i;
      pageBtn.onclick = () => { currentPage = i; renderContent(); scrollToTop(); };
      btnsContainer.appendChild(pageBtn);
    } else if (i === currentPage - 2 || i === currentPage + 2) {
      const dots = document.createElement('span');
      dots.className = 'px-1 text-slate-400';
      dots.textContent = '...';
      btnsContainer.appendChild(dots);
    }
  }

  // Next Button
  const nextBtn = document.createElement('button');
  nextBtn.className = `px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold transition ${
    currentPage === totalPages ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-100'
  }`;
  nextBtn.innerHTML = 'Selanjutnya <i class="fa-solid fa-chevron-right ml-1"></i>';
  nextBtn.disabled = currentPage === totalPages;
  nextBtn.onclick = () => { if (currentPage < totalPages) { currentPage++; renderContent(); scrollToTop(); } };
  btnsContainer.appendChild(nextBtn);
}

function renderTablePagination(totalPages) {
  const container = document.getElementById('paginationControls');
  if (!container) return;
  container.innerHTML = '';

  const prev = document.createElement('button');
  prev.className = 'px-2 py-1 border rounded bg-white disabled:opacity-40';
  prev.disabled = currentPage === 1;
  prev.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
  prev.onclick = () => { if (currentPage > 1) { currentPage--; renderContent(); } };
  container.appendChild(prev);

  const span = document.createElement('span');
  span.className = 'px-3 py-1 font-semibold text-slate-700';
  span.textContent = `Hal ${currentPage} / ${totalPages}`;
  container.appendChild(span);

  const next = document.createElement('button');
  next.className = 'px-2 py-1 border rounded bg-white disabled:opacity-40';
  next.disabled = currentPage === totalPages;
  next.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
  next.onclick = () => { if (currentPage < totalPages) { currentPage++; renderContent(); } };
  container.appendChild(next);
}

function scrollToTop() {
  window.scrollTo({ top: 350, behavior: 'smooth' });
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

async function handleVisitSubmit(e) {
  e.preventDefault();
  if (!currentVisitNasabah) return;

  const btnSubmit = document.getElementById('btnSubmitVisit');
  const textSubmit = document.getElementById('textSubmitVisit');
  const iconSubmit = document.getElementById('iconSubmitVisit');

  if (btnSubmit) {
    btnSubmit.disabled = true;
    if (textSubmit) textSubmit.textContent = 'Menyimpan ke Cloud...';
    if (iconSubmit) iconSubmit.className = 'fa-solid fa-spinner animate-spin';
  }

  try {
    const debtorName = currentVisitNasabah.nama || 'Debitur';
    const debtorId = currentVisitNasabah.id;
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

    // Push ke cloud dan tunggu konfirmasi
    const syncRes = await pushVisitToCloud(key, record);

    closeVisitModal();

    if (syncRes && syncRes.success) {
      if (status === 'tertarik') {
        showToast(`✅ Status "${debtorName}" diset TERTARIK & TERKUNCI untuk seluruh tim!`, 'success');
      } else if (status === 'tidak_tertarik') {
        showToast(`✅ Status "${debtorName}" diset TIDAK TERTARIK (Tersinkron ke tim).`, 'warning');
      } else {
        showToast(`✅ Status "${debtorName}" di-reset ke Belum Digarap.`, 'info');
      }
    } else {
      showToast(`⚠️ Tersimpan lokal di HP ini. Sinyal cloud tersendat, klik 'Sync Tim' saat internet stabil.`, 'warning');
    }

    // Jika modal detail sedang terbuka untuk nasabah ini, perbarui tampilannya
    if (currentActiveNasabah && (currentActiveNasabah.id === debtorId)) {
      updateModalDetailVisitSection(currentActiveNasabah);
    }
  } catch (err) {
    console.error('Error saat simpan kunjungan:', err);
    showToast('Terjadi kesalahan: ' + err.message, 'error');
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      if (textSubmit) textSubmit.textContent = 'Simpan Status';
      if (iconSubmit) iconSubmit.className = 'fa-solid fa-floppy-disk';
    }
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

  const addListenerSafe = (id, event, handler) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, handler);
  };

  addListenerSafe('btnDirectAddNasabah', 'click', () => {
    openAddModal();
    if (currentSearch) {
      const fn = document.getElementById('formNama');
      if (fn) fn.value = currentSearch;
    }
  });

  // Top Buttons & Modals
  addListenerSafe('btnSyncTeam', 'click', () => syncFromCloud(true));
  addListenerSafe('btnExportLaporanKunjungan', 'click', exportLaporanKunjunganExcel);
  addListenerSafe('btnOpenUploadModal', 'click', openUploadModal);
  addListenerSafe('btnEmptyUpload', 'click', openUploadModal);
  addListenerSafe('btnCloseModalUpload', 'click', closeUploadModal);
  addListenerSafe('btnCancelUpload', 'click', closeUploadModal);

  addListenerSafe('btnDownloadTemplateFromModal', 'click', downloadTemplateExcel);
  addListenerSafe('btnExportExcel', 'click', exportDatabaseToExcel);
  addListenerSafe('btnResetDatabase', 'click', resetAllDatabase);

  addListenerSafe('btnOpenAddModal', 'click', openAddModal);
  addListenerSafe('btnCloseModalForm', 'click', closeFormModal);
  addListenerSafe('btnCancelForm', 'click', closeFormModal);
  addListenerSafe('nasabahForm', 'submit', handleFormSubmit);

  // Modal Catat Kunjungan
  addListenerSafe('btnCloseModalVisit', 'click', closeVisitModal);
  addListenerSafe('btnCancelVisit', 'click', closeVisitModal);
  addListenerSafe('formVisitStatus', 'submit', handleVisitSubmit);
  addListenerSafe('btnOpenVisitFromDetail', 'click', () => {
    if (currentActiveNasabah) {
      openVisitModal(currentActiveNasabah.id);
    }
  });

  // Modal Detail Close & Copy
  addListenerSafe('btnCloseModalDetail', 'click', closeDetailModal);
  addListenerSafe('btnCopyCIF', 'click', () => {
    if (!currentActiveNasabah) return;
    navigator.clipboard.writeText(currentActiveNasabah.cifno || '').then(() => {
      showToast('Nomor CIF berhasil disalin!', 'success');
    });
  });

  // WhatsApp actions
  addListenerSafe('selectWaTemplate', 'change', updateWhatsAppPreview);
  addListenerSafe('btnSendWA', 'click', sendWhatsAppMessage);
  addListenerSafe('btnCopySummary', 'click', copySummaryToClipboard);
  addListenerSafe('btnPrintSlip', 'click', printScreeningSlip);

  // Upload Drag & Drop & File Input
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('excelFileInput');

  if (dropZone && fileInput) {
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
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleExcelUpload(e.dataTransfer.files[0]);
      }
    });
  }

  addListenerSafe('btnProcessImport', 'click', processFinalImport);
}

// =========================================================================
// ================= TAB 2: MONITORING TAGIHAN BULANAN & KOLEKTIBILITAS =====
// =========================================================================

// Global State Tagihan
let dbTagihan = [];
let tagihanFollowupRecords = {}; // Key: rekening atau id -> { status, ptpDate, petugas, catatan, updatedAt }
let currentTagihanFilterKol = 'all';
let currentTagihanFilterJT = 'all';
let currentTagihanFilterSaldo = 'all';
let currentTagihanFilterPetugas = 'all';
let currentTagihanFilterCabang = 'all';
function tagihanCabangLabel(item) {
  return [item.unit, item.cabang].filter(Boolean).join(' · ') || 'Cabang belum tersedia';
}
let currentTagihanFilterProduk = 'all';
let currentTagihanFilterFollowup = 'all';
let currentTagihanFilterTunggakanOnly = false;
let currentTagihanSearch = '';
let currentTagihanView = 'cards';
let currentTagihanPage = 1;
const tagihanPageSize = 24;
let currentActiveTagihan = null;
let currentWaTemplateType = 'reminder';
let pendingImportTagihanData = [];
let selectedTagihanIds = new Set();
let currentAdvisNominalMap = {};
let currentAdvisActiveTab = 'form';

const TAGIHAN_STORAGE_KEY = 'portal_mandiri_tagihan_v2';
const TAGIHAN_FOLLOWUP_STORAGE_KEY = 'portal_mandiri_tagihan_followup_v2';

function loadTagihanDatabase() {
  try {
    const raw = localStorage.getItem(TAGIHAN_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && Array.isArray(parsed) && parsed.length > 0) {
      dbTagihan = parsed;
      // Migrasi/sinkronisasi: Pastikan totalKewajiban sama dengan tunggakan
      let needsSave = false;
      dbTagihan.forEach(item => {
        const expectedTotal = Number(item.tunggakan) || 0;
        if (item.totalKewajiban !== expectedTotal) {
          item.totalKewajiban = expectedTotal;
          item.saldoCukup = (Number(item.saldoAgf) || 0) >= expectedTotal;
          item.kurangSaldo = item.saldoCukup ? 0 : (expectedTotal - (Number(item.saldoAgf) || 0));
          needsSave = true;
        }
      });
      if (needsSave) {
        saveTagihanDatabase();
      }
    } else if (window.MANDIRI_TAGIHAN_DATA && window.MANDIRI_TAGIHAN_DATA.length > 0) {
      dbTagihan = [...window.MANDIRI_TAGIHAN_DATA];
      saveTagihanDatabase();
    }
  } catch (e) {
    console.error('Error loading tagihan database:', e);
    if (window.MANDIRI_TAGIHAN_DATA) {
      dbTagihan = [...window.MANDIRI_TAGIHAN_DATA];
    }
  }
}

function saveTagihanDatabase() {
  try {
    localStorage.setItem(TAGIHAN_STORAGE_KEY, JSON.stringify(dbTagihan));
    updateTagihanTabBadge();
  } catch (e) {
    console.error('Error saving tagihan database:', e);
    showToast('Gagal menyimpan database tagihan ke peramban', 'error');
  }
}

function updateTagihanTabBadge() {
  const badge = document.getElementById('tabBadgeTagihanCount');
  if (badge) {
    badge.textContent = dbTagihan.length;
  }
}

function loadTagihanFollowupRecords() {
  try {
    const raw = localStorage.getItem(TAGIHAN_FOLLOWUP_STORAGE_KEY);
    if (raw) {
      tagihanFollowupRecords = JSON.parse(raw);
    }
  } catch (e) {
    console.error('Error loading tagihan followup records:', e);
    tagihanFollowupRecords = {};
  }
}

function saveTagihanFollowupRecords() {
  try {
    localStorage.setItem(TAGIHAN_FOLLOWUP_STORAGE_KEY, JSON.stringify(tagihanFollowupRecords));
  } catch (e) {
    console.error('Error saving tagihan followup records:', e);
  }
}

function getTagihanFollowup(item) {
  if (!item) return { status: 'belum', ptpDate: '', petugas: '-', catatan: '', updatedAt: '' };
  const key = item.rekening || item.id;
  const rec = tagihanFollowupRecords[key];
  if (!rec || !rec.status || rec.status === 'belum') {
    return {
      status: 'belum',
      ptpDate: '',
      petugas: item.petugas || '-',
      catatan: '',
      updatedAt: ''
    };
  }
  return rec;
}

// ================= MAIN NAVIGATION CONTROLLER (3 TABS) =================
function switchMainTab(tab) {
  const tabBtnPipeline = document.getElementById('tabBtnPipeline');
  const tabBtnTagihan = document.getElementById('tabBtnTagihan');
  const tabBtnBooking = document.getElementById('tabBtnBooking');
  const viewPipelineTab = document.getElementById('viewPipelineTab');
  const viewTagihanTab = document.getElementById('viewTagihanTab');
  const viewBookingTab = document.getElementById('viewBookingTab');
  const headerActionsPipeline = document.getElementById('headerActionsPipeline');
  const headerActionsTagihan = document.getElementById('headerActionsTagihan');
  const headerActionsBooking = document.getElementById('headerActionsBooking');

  const activeBtnClass = 'flex items-center space-x-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm bg-white text-mandiri-navy shrink-0';
  const inactiveBtnClass = 'flex items-center space-x-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all text-blue-200 hover:text-white hover:bg-white/10 shrink-0';

  [['pipeline', tabBtnPipeline], ['tagihan', tabBtnTagihan], ['booking', tabBtnBooking]].forEach(([name, button]) => { if (button) button.setAttribute('aria-pressed', String(tab === name)); });

  if (tabBtnPipeline) tabBtnPipeline.className = tab === 'pipeline' ? activeBtnClass : inactiveBtnClass;
  if (tabBtnTagihan) tabBtnTagihan.className = tab === 'tagihan' ? activeBtnClass : inactiveBtnClass;
  if (tabBtnBooking) tabBtnBooking.className = tab === 'booking' ? activeBtnClass : inactiveBtnClass;

  // View containers toggle
  if (viewPipelineTab) {
    if (tab === 'pipeline') {
      viewPipelineTab.classList.remove('hidden');
      viewPipelineTab.classList.add('flex', 'flex-col');
    } else {
      viewPipelineTab.classList.add('hidden');
      viewPipelineTab.classList.remove('flex');
    }
  }

  if (viewTagihanTab) {
    if (tab === 'tagihan') {
      viewTagihanTab.classList.remove('hidden');
      viewTagihanTab.classList.add('flex', 'flex-col');
    } else {
      viewTagihanTab.classList.add('hidden');
      viewTagihanTab.classList.remove('flex');
    }
  }

  if (viewBookingTab) {
    if (tab === 'booking') {
      viewBookingTab.classList.remove('hidden');
      viewBookingTab.classList.add('flex', 'flex-col');
    } else {
      viewBookingTab.classList.add('hidden');
      viewBookingTab.classList.remove('flex');
    }
  }

  // Header actions toggle
  if (headerActionsPipeline) {
    if (tab === 'pipeline') {
      headerActionsPipeline.classList.remove('hidden');
      headerActionsPipeline.classList.add('flex');
    } else {
      headerActionsPipeline.classList.add('hidden');
      headerActionsPipeline.classList.remove('flex');
    }
  }

  if (headerActionsTagihan) {
    if (tab === 'tagihan') {
      headerActionsTagihan.classList.remove('hidden');
      headerActionsTagihan.classList.add('flex');
    } else {
      headerActionsTagihan.classList.add('hidden');
      headerActionsTagihan.classList.remove('flex');
    }
  }

  if (headerActionsBooking) {
    if (tab === 'booking') {
      headerActionsBooking.classList.remove('hidden');
      headerActionsBooking.classList.add('flex');
    } else {
      headerActionsBooking.classList.add('hidden');
      headerActionsBooking.classList.remove('flex');
    }
  }

  window.scrollTo({ top: 0, behavior: 'instant' });

  if (tab === 'pipeline') {
    updateUI();
  } else if (tab === 'tagihan') {
    updateTagihanUI();
  } else if (tab === 'booking') {
    updateBookingUI();
  }
}
window.switchMainTab = switchMainTab;

// ================= DROPDOWN POPULATOR =================
function populateTagihanPetugasDropdown() {
  const cabangSelect = document.getElementById('filterTagihanCabang');
  if (cabangSelect) {
    const groups = new Map();
    dbTagihan.forEach(item => {
      const code = String(item.cabang || '').trim();
      if (!code) return;
      if (!groups.has(code)) groups.set(code, { names: new Set(), count: 0 });
      const group = groups.get(code); group.count++;
      if (item.unit) group.names.add(item.unit);
    });
    cabangSelect.replaceChildren(new Option('Semua cabang', 'all'));
    [...groups].sort(([a],[b]) => a.localeCompare(b)).forEach(([code, group]) => {
      const names = [...group.names].sort().join(' / ');
      cabangSelect.add(new Option((names ? names + ' · ' : '') + code + ' (' + group.count + ')', code));
    });
    if (!groups.has(currentTagihanFilterCabang)) currentTagihanFilterCabang = 'all';
    cabangSelect.value = currentTagihanFilterCabang;
  }
  const select = document.getElementById('filterTagihanPetugas');
  if (!select) return;
  const currentVal = select.value;
  const petugasSet = new Set();
  dbTagihan.forEach(item => {
    if (item.petugas && item.petugas.trim() !== '') {
      petugasSet.add(item.petugas.trim());
    }
  });

  const sortedList = Array.from(petugasSet).sort();
  select.innerHTML = '<option value="all">Semua Petugas</option>';
  sortedList.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p;
    opt.textContent = p;
    select.appendChild(opt);
  });
  if (sortedList.includes(currentVal)) {
    select.value = currentVal;
  }
}

// ================= TAGIHAN UI UPDATE & FILTERING =================
function updateTagihanUI() {
  updateTagihanTabBadge();

  // 1. Calculate Global Overview Stats
  const branchRows = dbTagihan.filter(item => currentTagihanFilterCabang === 'all' || String(item.cabang || '').trim() === currentTagihanFilterCabang);
  const totalRek = branchRows.length;
  let totalBade = 0;
  let totalAngsuran = 0;
  let totalTunggakan = 0;
  let saldoKurangCount = 0;
  let saldoCukupCount = 0;
  let kol1Count = 0;
  let kol2Count = 0;
  let kol3Count = 0;
  let kol5Count = 0;

  branchRows.forEach(item => {
    totalBade += Number(item.bakiDebet) || 0;
    totalAngsuran += Number(item.angsuran) || 0;
    totalTunggakan += Number(item.tunggakan) || 0;
    if (item.saldoCukup) {
      saldoCukupCount++;
    } else {
      saldoKurangCount++;
    }

    const kolStr = String(item.kol || '').toUpperCase();
    if (kolStr.startsWith('1')) kol1Count++;
    else if (kolStr.startsWith('2')) kol2Count++;
    else if (kolStr.startsWith('3')) kol3Count++;
    else if (kolStr.startsWith('5')) kol5Count++;
  });

  const elTotalRek = document.getElementById('statTagihanTotalRek');
  if (elTotalRek) elTotalRek.textContent = totalRek.toLocaleString('id-ID');

  const elTotalBade = document.getElementById('statTagihanTotalBade');
  if (elTotalBade) elTotalBade.textContent = formatRupiah(totalBade);

  const elTotalAngsuran = document.getElementById('statTagihanTotalAngsuran');
  if (elTotalAngsuran) elTotalAngsuran.textContent = formatRupiah(totalAngsuran);

  const elTotalTunggakan = document.getElementById('statTagihanTotalTunggakan');
  if (elTotalTunggakan) elTotalTunggakan.textContent = formatRupiah(totalTunggakan);

  const elSaldoKurang = document.getElementById('statTagihanSaldoKurangCount');
  if (elSaldoKurang) elSaldoKurang.textContent = `${saldoKurangCount} rek`;

  const elSaldoCukup = document.getElementById('statTagihanSaldoCukupCount');
  if (elSaldoCukup) elSaldoCukup.textContent = `${saldoCukupCount} rek`;

  const elBadgeKolAll = document.getElementById('badgeKolAllCount');
  if (elBadgeKolAll) elBadgeKolAll.textContent = totalRek;
  const elBadgeKol1 = document.getElementById('badgeKol1Count');
  if (elBadgeKol1) elBadgeKol1.textContent = kol1Count;
  const elBadgeKol2 = document.getElementById('badgeKol2Count');
  if (elBadgeKol2) elBadgeKol2.textContent = kol2Count;
  const elBadgeKol3 = document.getElementById('badgeKol3Count');
  if (elBadgeKol3) elBadgeKol3.textContent = kol3Count;
  const elBadgeKol5 = document.getElementById('badgeKol5Count');
  if (elBadgeKol5) elBadgeKol5.textContent = kol5Count;

  // Highlight active Kol pill
  updateKolPillStyles();

  // 2. Filter data
  const q = currentTagihanSearch.trim().toLowerCase();
  const todayDate = new Date().getDate();

  const filtered = dbTagihan.filter(item => {
    if (currentTagihanFilterCabang !== 'all' && String(item.cabang || '').trim() !== currentTagihanFilterCabang) return false;
    // Search
    if (q) {
      const matchName = String(item.nama || '').toLowerCase().includes(q);
      const matchRek = String(item.rekening || '').toLowerCase().includes(q);
      const matchCif = String(item.cif || '').toLowerCase().includes(q);
      const matchPetugas = String(item.petugas || '').toLowerCase().includes(q);
      const matchAgf = String(item.rekAgf || '').toLowerCase().includes(q);
      if (!matchName && !matchRek && !matchCif && !matchPetugas && !matchAgf) {
        return false;
      }
    }

    // JT Filter
    if (currentTagihanFilterJT === 'today') {
      if (Number(item.jt) !== todayDate) return false;
    } else if (currentTagihanFilterJT === 'jt_1_10') {
      const jt = Number(item.jt);
      if (jt < 1 || jt > 10) return false;
    } else if (currentTagihanFilterJT === 'jt_11_20') {
      const jt = Number(item.jt);
      if (jt < 11 || jt > 20) return false;
    } else if (currentTagihanFilterJT === 'jt_21_31') {
      const jt = Number(item.jt);
      if (jt < 21 || jt > 31) return false;
    }

    // Kol Filter
    if (currentTagihanFilterKol !== 'all') {
      const kStr = String(item.kol || '').toUpperCase();
      if (!kStr.startsWith(currentTagihanFilterKol)) return false;
    }

    // Saldo Filter
    if (currentTagihanFilterSaldo === 'kurang') {
      if (item.saldoCukup) return false;
    } else if (currentTagihanFilterSaldo === 'cukup') {
      if (!item.saldoCukup) return false;
    } else if (currentTagihanFilterSaldo === 'nol') {
      if (Number(item.saldoAgf) >= 25000) return false;
    }

    // Tunggakan Only
    if (currentTagihanFilterTunggakanOnly) {
      if (Number(item.tunggakan) <= 0) return false;
    }

    // Petugas Filter
    if (currentTagihanFilterPetugas !== 'all') {
      if (item.petugas !== currentTagihanFilterPetugas) return false;
    }

    // Produk Filter
    if (currentTagihanFilterProduk !== 'all') {
      const pStr = String(item.produk || '').toUpperCase();
      if (!pStr.includes(currentTagihanFilterProduk)) return false;
    }

    // Follow-up Filter
    if (currentTagihanFilterFollowup !== 'all') {
      const fu = getTagihanFollowup(item);
      if (fu.status !== currentTagihanFilterFollowup) return false;
    }

    return true;
  });

  // 3. Update Result Badge
  const elBadgeCount = document.getElementById('badgeTagihanCount');
  if (elBadgeCount) {
    elBadgeCount.textContent = `${filtered.length} rekening`;
  }

  // 4. Pagination & Rendering
  const totalPages = Math.ceil(filtered.length / tagihanPageSize) || 1;
  if (currentTagihanPage > totalPages) currentTagihanPage = totalPages;
  if (currentTagihanPage < 1) currentTagihanPage = 1;

  const start = (currentTagihanPage - 1) * tagihanPageSize;
  const paged = filtered.slice(start, start + tagihanPageSize);

  const containerCards = document.getElementById('tagihanCardsContainer');
  const containerTable = document.getElementById('tagihanTableContainer');

  if (currentTagihanView === 'cards') {
    if (containerCards) {
      containerCards.classList.remove('hidden');
      renderTagihanCards(paged);
    }
    if (containerTable) containerTable.classList.add('hidden');
  } else {
    if (containerCards) containerCards.classList.add('hidden');
    if (containerTable) {
      containerTable.classList.remove('hidden');
      renderTagihanTable(paged, start);
    }
  }

  renderTagihanPagination(filtered.length, start, start + paged.length, totalPages);
  if (typeof updateTagihanSelectionUI === 'function') {
    updateTagihanSelectionUI();
  }
}

function updateKolPillStyles() {
  const pills = {
    'all': document.getElementById('pillKolAll'),
    '1': document.getElementById('pillKol1'),
    '2': document.getElementById('pillKol2'),
    '3': document.getElementById('pillKol3'),
    '5': document.getElementById('pillKol5')
  };

  Object.entries(pills).forEach(([key, btn]) => {
    if (!btn) return;
    if (currentTagihanFilterKol === key) {
      btn.className = 'px-2.5 py-1 rounded-lg bg-mandiri-navy text-white font-bold text-[11px] transition shadow-xs ring-2 ring-mandiri-blue';
    } else {
      btn.className = 'px-2.5 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-[11px] transition flex items-center';
    }
  });
}

function updateTagihanViewButtons() {
  const btnCards = document.getElementById('btnTagihanViewCards');
  const btnTable = document.getElementById('btnTagihanViewTable');
  if (currentTagihanView === 'cards') {
    if (btnCards) btnCards.className = 'p-2 rounded-lg bg-mandiri-navy text-white text-xs shadow-xs';
    if (btnTable) btnTable.className = 'p-2 rounded-lg bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 text-xs shadow-xs';
  } else {
    if (btnCards) btnCards.className = 'p-2 rounded-lg bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 text-xs shadow-xs';
    if (btnTable) btnTable.className = 'p-2 rounded-lg bg-mandiri-navy text-white text-xs shadow-xs';
  }
}

// Quick Filter Helpers
function filterTagihanByKol(kol) {
  currentTagihanFilterKol = kol;
  const sel = document.getElementById('filterTagihanKol');
  if (sel) sel.value = kol;
  currentTagihanPage = 1;
  updateTagihanUI();
}
window.filterTagihanByKol = filterTagihanByKol;

function filterTagihanBySaldo(saldo) {
  currentTagihanFilterSaldo = saldo;
  const sel = document.getElementById('filterTagihanSaldo');
  if (sel) sel.value = saldo;
  currentTagihanPage = 1;
  updateTagihanUI();
}
window.filterTagihanBySaldo = filterTagihanBySaldo;

function filterTagihanByTunggakan(val) {
  currentTagihanFilterTunggakanOnly = !!val;
  currentTagihanPage = 1;
  updateTagihanUI();
}
window.filterTagihanByTunggakan = filterTagihanByTunggakan;

function setTagihanView(view) {
  currentTagihanView = view;
  updateTagihanViewButtons();
  updateTagihanUI();
}
window.setTagihanView = setTagihanView;

function changeTagihanPage(page) {
  currentTagihanPage = page;
  updateTagihanUI();
  const el = document.getElementById('viewTagihanTab');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
window.changeTagihanPage = changeTagihanPage;

function copyToClipboard(text, label = 'Teks') {
  if (!text) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(`${label} berhasil disalin!`, 'success');
    }).catch(() => {
      fallbackCopyText(text, label);
    });
  } else {
    fallbackCopyText(text, label);
  }
}
window.copyToClipboard = copyToClipboard;

function fallbackCopyText(text, label) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    showToast(`${label} berhasil disalin!`, 'success');
  } catch (e) {
    showToast(`Gagal menyalin ${label}`, 'error');
  }
  document.body.removeChild(ta);
}

// ================= RENDER CARDS TAGIHAN =================
function renderTagihanCards(items) {
  const container = document.getElementById('tagihanCardsContainer');
  if (!container) return;

  if (items.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-16 text-center bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
        <div class="w-16 h-16 mx-auto rounded-2xl bg-amber-50 text-mandiri-navy flex items-center justify-center mb-4 text-2xl border border-amber-200">
          <i class="fa-solid fa-file-circle-question"></i>
        </div>
        <h3 class="text-base font-bold text-slate-800">Tidak Ada Data Tagihan yang Cocok</h3>
        <p class="text-xs text-slate-500 mt-1 max-w-md mx-auto">
          Coba sesuaikan kata kunci pencarian, filter tanggal jatuh tempo, kolektibilitas, atau kondisi saldo AGF.
        </p>
      </div>
    `;
    return;
  }

  container.innerHTML = items.map(item => {
    const followup = getTagihanFollowup(item);

    // Kol Badge
    const kolStr = String(item.kol || '').toUpperCase();
    let kolBadgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-300';
    let kolLabel = `Kol 1 (Lancar)`;
    if (kolStr.startsWith('2')) {
      kolBadgeClass = 'bg-amber-100 text-amber-900 border-amber-300';
      kolLabel = `Kol ${escapeHtml(item.kol)} (DPK)`;
    } else if (kolStr.startsWith('3')) {
      kolBadgeClass = 'bg-orange-100 text-orange-900 border-orange-300';
      kolLabel = `Kol 3 (Kurang Lancar)`;
    } else if (kolStr.startsWith('5')) {
      kolBadgeClass = 'bg-red-100 text-red-900 border-red-300';
      kolLabel = `Kol 5 (Macet)`;
    }

    // Saldo AGF alert
    let saldoBoxHtml = '';
    if (item.saldoCukup) {
      saldoBoxHtml = `
        <div class="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-emerald-800 flex items-center justify-between text-xs">
          <span class="flex items-center"><i class="fa-solid fa-circle-check text-emerald-600 mr-1.5"></i> Saldo AGF Cukup</span>
          <span class="font-extrabold">${formatRupiah(item.saldoAgf)}</span>
        </div>
      `;
    } else {
      saldoBoxHtml = `
        <div class="p-2.5 rounded-xl bg-amber-50/80 border border-amber-300 text-amber-900 text-xs">
          <div class="flex items-center justify-between font-bold">
            <span class="flex items-center"><i class="fa-solid fa-triangle-exclamation text-amber-600 mr-1.5"></i> Saldo Kurang:</span>
            <span class="text-red-700 font-black">- Rp ${Number(item.kurangSaldo).toLocaleString('id-ID')}</span>
          </div>
          <div class="text-[11px] text-slate-600 mt-1 flex items-center justify-between">
            <span>Saldo saat ini: <strong>${formatRupiah(item.saldoAgf)}</strong></span>
            <span>Tagihan: <strong>${formatRupiah(item.totalKewajiban)}</strong></span>
          </div>
        </div>
      `;
    }

    // Follow-up status pill
    let followupBadge = '';
    if (followup.status === 'sudah_bayar') {
      followupBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200"><i class="fa-solid fa-circle-check mr-1"></i>Sudah Bayar</span>`;
    } else if (followup.status === 'janji_bayar') {
      followupBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300"><i class="fa-solid fa-calendar-day mr-1"></i>Janji Bayar: ${escapeHtml(followup.ptpDate || '-')}</span>`;
    } else if (followup.status === 'belum_ada_dana') {
      followupBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-900 border border-orange-200"><i class="fa-solid fa-hourglass-half mr-1"></i>Belum Ada Dana</span>`;
    } else if (followup.status === 'kendala') {
      followupBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-900 border border-red-200"><i class="fa-solid fa-triangle-exclamation mr-1"></i>Kendala</span>`;
    } else {
      followupBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200"><i class="fa-solid fa-clock mr-1"></i>Belum Ditagih</span>`;
    }

    const hasTunggakan = Number(item.tunggakan) > 0;
    const isSelected = selectedTagihanIds.has(item.id);

    return `
      <div class="tagihan-card-item bg-white rounded-2xl border ${isSelected ? 'ring-2 ring-mandiri-blue border-mandiri-blue bg-blue-50/10' : 'border-slate-200/90'} shadow-card hover:shadow-card-hover transition-all duration-200 flex flex-col justify-between overflow-hidden">
        
        <!-- Card Top Bar -->
        <div class="p-4 sm:p-5 space-y-3 flex-1">
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-center">
              <input type="checkbox" class="tagihan-select-cb w-4 h-4 rounded border-slate-300 text-mandiri-blue focus:ring-mandiri-blue cursor-pointer mr-2.5 shrink-0" data-id="${escapeHtml(item.id)}" ${isSelected ? 'checked' : ''} onchange="toggleSelectTagihan('${escapeHtml(item.id)}', this.checked)" title="Pilih untuk cetak Advis LMAP">
              <div>
                <span class="px-2.5 py-0.5 rounded-md text-[10px] font-extrabold border ${kolBadgeClass}">
                  ${kolLabel}
                </span>
                <span class="ml-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-mandiri-blue border border-blue-200">
                  ${escapeHtml(item.produk)}
                </span>
              </div>
            </div>
            ${followupBadge}
          </div>

          <!-- Debitur Name & Rekening -->
          <div>
            <h4 class="font-extrabold text-slate-800 text-sm sm:text-base leading-snug line-clamp-1" title="${escapeHtml(item.nama)}">
              ${escapeHtml(item.nama)}
            </h4>
            <div class="flex items-center space-x-1.5 mt-1 text-xs text-slate-500 font-mono">
              <span>Rek: <strong>${escapeHtml(item.rekening)}</strong></span>
              <button onclick="copyToClipboard('${escapeHtml(item.rekening)}', 'Nomor Rekening')" class="text-slate-400 hover:text-mandiri-blue p-0.5" title="Salin No Rekening">
                <i class="fa-regular fa-copy"></i>
              </button>
            </div>
          </div>

          <!-- Jatuh Tempo & HT -->
          <div class="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200/70">
            <div>
              <span class="text-[10px] text-slate-500 block">Jatuh Tempo (JT)</span>
              <strong class="text-slate-800 text-xs">Tgl ${escapeHtml(item.jt)} tiap bln</strong>
            </div>
            <div>
              <span class="text-[10px] text-slate-500 block">Hari Tunggakan (HT)</span>
              <strong class="${item.ht > 0 ? 'text-red-700 font-black' : 'text-slate-800'} text-xs">${escapeHtml(item.ht)} Hari</strong>
            </div>
          </div>

          <!-- Financial Details -->
          <div class="space-y-1 text-xs">
            <div class="flex justify-between items-center">
              <span class="text-slate-500">Angsuran Pokok+Bunga:</span>
              <strong class="text-slate-800">${formatRupiah(item.angsuran)}</strong>
            </div>
            ${hasTunggakan ? `
              <div class="flex justify-between items-center text-red-700 font-bold">
                <span class="flex items-center"><i class="fa-solid fa-triangle-exclamation mr-1"></i> Tunggakan:</span>
                <span>${formatRupiah(item.tunggakan)}</span>
              </div>
            ` : ''}
            <div class="flex justify-between items-center pt-1 border-t border-slate-100 font-extrabold text-slate-900">
              <span>Total Kewajiban:</span>
              <span class="text-mandiri-navy text-sm">${formatRupiah(item.totalKewajiban)}</span>
            </div>
          </div>

          <!-- Saldo Tabungan AGF Alert Box -->
          ${saldoBoxHtml}

          <!-- Petugas Mantri -->
          <div class="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span class="truncate max-w-[170px]"><i class="fa-solid fa-user-tie text-mandiri-blue mr-1"></i>${escapeHtml(item.petugas || '-')}</span>
            <span class="font-mono text-slate-400">${escapeHtml(tagihanCabangLabel(item))}</span>
          </div>

        </div>

        <!-- Card Footer Actions -->
        <div class="bg-slate-50/80 px-4 py-3 border-t border-slate-200 flex items-center justify-between gap-1.5">
          <button onclick="openDetailTagihan('${escapeHtml(item.id)}')" class="px-2.5 py-1.5 rounded-xl border border-slate-300 hover:bg-slate-200/80 text-slate-700 text-xs font-semibold transition flex items-center space-x-1" title="Lihat Detail Fasilitas Pinjaman">
            <i class="fa-solid fa-eye text-mandiri-blue"></i>
            <span>Detail</span>
          </button>
          <div class="flex items-center space-x-1.5">
            <button onclick="cetakAdvisSingle('${escapeHtml(item.id)}')" class="px-2.5 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-xs font-bold transition flex items-center space-x-1 shadow-xs" title="Cetak Surat Advis LMAP untuk nasabah ini">
              <i class="fa-solid fa-file-invoice text-xs"></i>
              <span>Advis</span>
            </button>
            <button onclick="openFollowupTagihan('${escapeHtml(item.id)}')" class="px-3 py-1.5 rounded-xl bg-mandiri-navy hover:bg-mandiri-blue text-white text-xs font-bold transition flex items-center space-x-1 shadow-xs" title="Catat Hasil Penagihan">
              <i class="fa-solid fa-pen-to-square"></i>
              <span>Tagih</span>
            </button>
            <button onclick="openWaTagihan('${escapeHtml(item.id)}')" class="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center space-x-1 shadow-xs" title="Kirim Pengingat WhatsApp">
              <i class="fa-brands fa-whatsapp text-sm"></i>
              <span>WA</span>
            </button>
          </div>
        </div>

      </div>
    `;
  }).join('');
}

// ================= RENDER TABLE TAGIHAN =================
function renderTagihanTable(items, start) {
  const tbody = document.getElementById('tagihanTableBody');
  if (!tbody) return;

  if (items.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="13" class="p-8 text-center text-slate-500">
          Tidak ada data tagihan yang sesuai dengan filter.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = items.map((item, idx) => {
    const followup = getTagihanFollowup(item);
    const kolStr = String(item.kol || '').toUpperCase();
    let kolBadgeClass = 'bg-emerald-100 text-emerald-800';
    if (kolStr.startsWith('2')) kolBadgeClass = 'bg-amber-100 text-amber-900';
    else if (kolStr.startsWith('3')) kolBadgeClass = 'bg-orange-100 text-orange-900';
    else if (kolStr.startsWith('5')) kolBadgeClass = 'bg-red-100 text-red-900';

    let saldoBadge = item.saldoCukup
      ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">Cukup</span>`
      : `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800" title="Kurang Rp ${Number(item.kurangSaldo).toLocaleString('id-ID')}">Kurang</span>`;

    let followupBadge = '';
    if (followup.status === 'sudah_bayar') {
      followupBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">Sudah Bayar</span>`;
    } else if (followup.status === 'janji_bayar') {
      followupBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900">PTP: ${escapeHtml(followup.ptpDate || '-')}</span>`;
    } else if (followup.status === 'belum_ada_dana') {
      followupBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-900">Belum Ada Dana</span>`;
    } else if (followup.status === 'kendala') {
      followupBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-900">Kendala</span>`;
    } else {
      followupBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">Belum Ditagih</span>`;
    }

    const isSelected = selectedTagihanIds.has(item.id);

    return `
      <tr class="hover:bg-slate-50 transition border-b border-slate-100 ${isSelected ? 'bg-blue-50/50' : ''}">
        <td class="p-3 text-center">
          <input type="checkbox" class="tagihan-select-cb w-4 h-4 rounded border-slate-300 text-mandiri-blue focus:ring-mandiri-blue cursor-pointer" data-id="${escapeHtml(item.id)}" ${isSelected ? 'checked' : ''} onchange="toggleSelectTagihan('${escapeHtml(item.id)}', this.checked)">
        </td>
        <td class="p-3 text-slate-400 font-mono text-[11px]">${start + idx + 1}</td>
        <td class="p-3">
          <div class="font-bold text-slate-800 leading-tight">${escapeHtml(item.nama)}</div>
          <div class="text-[11px] text-slate-500 mt-1">${escapeHtml(tagihanCabangLabel(item))}</div>
          <div class="text-[11px] text-slate-500 font-mono flex items-center space-x-1 mt-0.5">
            <span>Rek: ${escapeHtml(item.rekening)}</span>
            <button onclick="copyToClipboard('${escapeHtml(item.rekening)}', 'Nomor Rekening')" class="text-slate-400 hover:text-mandiri-blue">
              <i class="fa-regular fa-copy text-[10px]"></i>
            </button>
          </div>
        </td>
        <td class="p-3 text-[11px] text-slate-600 truncate max-w-[120px]">${escapeHtml(item.petugas || '-')}</td>
        <td class="p-3">
          <span class="px-2 py-0.5 rounded font-bold text-[10px] bg-blue-50 text-mandiri-blue border border-blue-200">
            ${escapeHtml(item.produk)}
          </span>
        </td>
        <td class="p-3">
          <span class="px-2 py-0.5 rounded text-[10px] font-extrabold ${kolBadgeClass}">
            Kol ${escapeHtml(item.kol)}
          </span>
          <div class="text-[10px] text-slate-400 mt-0.5">HT: ${escapeHtml(item.ht)} hr</div>
        </td>
        <td class="p-3 font-semibold text-slate-800 text-center">Tgl ${escapeHtml(item.jt)}</td>
        <td class="p-3 font-bold text-slate-800">${formatRupiah(item.angsuran)}</td>
        <td class="p-3 font-bold ${item.tunggakan > 0 ? 'text-red-700' : 'text-slate-500'}">${formatRupiah(item.tunggakan)}</td>
        <td class="p-3">
          <div class="font-mono text-[11px] text-slate-700">${escapeHtml(item.rekAgf)}</div>
          <div class="font-bold text-[11px] text-slate-900">${formatRupiah(item.saldoAgf)}</div>
        </td>
        <td class="p-3">${saldoBadge}</td>
        <td class="p-3">${followupBadge}</td>
        <td class="p-3 text-center">
          <div class="flex items-center justify-center space-x-1">
            <button onclick="cetakAdvisSingle('${escapeHtml(item.id)}')" class="p-1.5 rounded-lg text-amber-700 hover:bg-amber-100 transition" title="Cetak Advis LMAP">
              <i class="fa-solid fa-file-invoice text-sm"></i>
            </button>
            <button onclick="openDetailTagihan('${escapeHtml(item.id)}')" class="p-1.5 rounded-lg text-slate-600 hover:bg-slate-200 transition" title="Detail">
              <i class="fa-solid fa-eye text-mandiri-blue"></i>
            </button>
            <button onclick="openFollowupTagihan('${escapeHtml(item.id)}')" class="p-1.5 rounded-lg text-mandiri-navy hover:bg-blue-100 transition" title="Catat Penagihan">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            <button onclick="openWaTagihan('${escapeHtml(item.id)}')" class="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-100 transition" title="Kirim WA">
              <i class="fa-brands fa-whatsapp text-sm"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// ================= RENDER PAGINATION TAGIHAN =================
function renderTagihanPagination(totalItems, start, end, totalPages) {
  const infoEl = document.getElementById('tagihanPaginationInfo');
  if (infoEl) {
    infoEl.textContent = `Menampilkan ${totalItems === 0 ? 0 : start + 1} - ${end} dari ${totalItems} rekening`;
  }

  const btnContainer = document.getElementById('tagihanPaginationButtons');
  if (!btnContainer) return;

  if (totalPages <= 1) {
    btnContainer.innerHTML = '';
    return;
  }

  let html = '';
  // Prev button
  html += `
    <button onclick="changeTagihanPage(${currentTagihanPage - 1})" ${currentTagihanPage === 1 ? 'disabled' : ''} class="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition">
      <i class="fa-solid fa-chevron-left"></i>
    </button>
  `;

  // Page numbers (smart window)
  const maxButtons = 5;
  let startPage = Math.max(1, currentTagihanPage - 2);
  let endPage = Math.min(totalPages, startPage + maxButtons - 1);
  if (endPage - startPage < maxButtons - 1) {
    startPage = Math.max(1, endPage - maxButtons + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    const isActive = i === currentTagihanPage;
    html += `
      <button onclick="changeTagihanPage(${i})" class="px-3 py-1.5 rounded-lg text-xs font-bold transition ${isActive ? 'bg-mandiri-navy text-white shadow-xs' : 'border border-slate-300 text-slate-700 hover:bg-slate-100'}">
        ${i}
      </button>
    `;
  }

  // Next button
  html += `
    <button onclick="changeTagihanPage(${currentTagihanPage + 1})" ${currentTagihanPage === totalPages ? 'disabled' : ''} class="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition">
      <i class="fa-solid fa-chevron-right"></i>
    </button>
  `;

  btnContainer.innerHTML = html;
}

// ================= MODAL DETAIL TAGIHAN =================
function findTagihanItemById(id) {
  return dbTagihan.find(x => x.id === id || String(x.rekening) === String(id));
}

function openDetailTagihan(id) {
  const item = findTagihanItemById(id);
  if (!item) {
    showToast('Data rekening tagihan tidak ditemukan', 'error');
    return;
  }

  currentActiveTagihan = item;
  const followup = getTagihanFollowup(item);

  // Fill Header
  const elNama = document.getElementById('modalDetailTagihanNama');
  if (elNama) elNama.textContent = item.nama;
  const elRek = document.getElementById('modalDetailTagihanRekening');
  if (elRek) elRek.textContent = `No. Rek: ${item.rekening} | CIF: ${item.cif}`;

  // Kol & JT Banner
  const kolBadge = document.getElementById('modalDetailTagihanKolBadge');
  const kolPrevBadge = document.getElementById('modalDetailTagihanKolPrevBadge');
  const banner = document.getElementById('modalDetailTagihanBanner');

  const kolStr = String(item.kol || '').toUpperCase();
  if (kolBadge) {
    kolBadge.textContent = `Kol ${item.kol} (${kolStr.startsWith('1') ? 'Lancar' : kolStr.startsWith('2') ? 'DPK' : kolStr.startsWith('3') ? 'Kurang Lancar' : 'Macet'})`;
    if (kolStr.startsWith('1')) {
      kolBadge.className = 'px-3 py-1 rounded-full text-xs font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300';
      if (banner) banner.className = 'p-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3';
    } else if (kolStr.startsWith('2')) {
      kolBadge.className = 'px-3 py-1 rounded-full text-xs font-black uppercase bg-amber-100 text-amber-900 border border-amber-300';
      if (banner) banner.className = 'p-4 rounded-2xl border border-amber-200 bg-amber-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3';
    } else {
      kolBadge.className = 'px-3 py-1 rounded-full text-xs font-black uppercase bg-red-100 text-red-900 border border-red-300';
      if (banner) banner.className = 'p-4 rounded-2xl border border-red-200 bg-red-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3';
    }
  }

  if (kolPrevBadge) {
    kolPrevBadge.textContent = `(Bulan lalu: Kol ${item.kolPrev || item.kol})`;
  }

  const elJT = document.getElementById('modalDetailTagihanJT');
  if (elJT) elJT.textContent = `Tanggal ${item.jt} setiap bulan`;

  const elHT = document.getElementById('modalDetailTagihanHT');
  if (elHT) {
    elHT.textContent = `${item.ht} Hari`;
    elHT.className = item.ht > 0 ? 'text-base font-extrabold text-red-700' : 'text-base font-extrabold text-slate-800';
  }

  // Financials
  const elAngsuran = document.getElementById('modalDetailTagihanAngsuran');
  if (elAngsuran) elAngsuran.textContent = formatRupiah(item.angsuran);

  const elTunggakan = document.getElementById('modalDetailTagihanTunggakan');
  if (elTunggakan) elTunggakan.textContent = formatRupiah(item.tunggakan);

  const elTotalKewajiban = document.getElementById('modalDetailTagihanTotalKewajiban');
  if (elTotalKewajiban) elTotalKewajiban.textContent = formatRupiah(item.totalKewajiban);

  for (const [suffix, key] of [['Pokok','tunggakanPokok'],['Bunga','tunggakanBunga'],['Denda','tunggakanDenda']]) {
    const field = document.getElementById('modalDetailTagihan' + suffix);
    if (field) field.textContent = item[key] == null ? 'Belum tersedia' : formatRupiah(item[key]);
  }

  // AGF Tabungan Box
  const agfBox = document.getElementById('modalDetailTagihanAgfBox');
  const agfBadge = document.getElementById('modalDetailTagihanAgfStatusBadge');
  const elNoAgf = document.getElementById('modalDetailTagihanNoAgf');
  if (elNoAgf) elNoAgf.textContent = item.rekAgf || '-';
  const elSaldoAgf = document.getElementById('modalDetailTagihanSaldoAgf');
  if (elSaldoAgf) elSaldoAgf.textContent = formatRupiah(item.saldoAgf);

  const agfNote = document.getElementById('modalDetailTagihanAgfNote');
  if (item.saldoCukup) {
    if (agfBox) agfBox.className = 'p-4 rounded-2xl border border-emerald-300 bg-emerald-50/50';
    if (agfBadge) {
      agfBadge.textContent = 'Saldo Cukup';
      agfBadge.className = 'px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800';
    }
    if (agfNote) {
      agfNote.className = 'p-2.5 rounded-xl text-xs font-semibold bg-emerald-100 text-emerald-900 border border-emerald-200';
      agfNote.innerHTML = `<i class="fa-solid fa-circle-check text-emerald-600 mr-1.5"></i> Saldo tabungan nasabah mencukupi untuk autodebet angsuran bulan ini.`;
    }
  } else {
    if (agfBox) agfBox.className = 'p-4 rounded-2xl border border-amber-300 bg-amber-50/60';
    if (agfBadge) {
      agfBadge.textContent = 'Saldo Kurang';
      agfBadge.className = 'px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800';
    }
    if (agfNote) {
      agfNote.className = 'p-2.5 rounded-xl text-xs font-semibold bg-red-50 text-red-900 border border-red-200';
      agfNote.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-red-600 mr-1.5"></i> Saldo tabungan kurang <strong>Rp ${Number(item.kurangSaldo).toLocaleString('id-ID')}</strong>. Segera ingatkan nasabah untuk menyetor dana agar tidak gagal debet!`;
    }
  }

  // Facility Info
  const elProd = document.getElementById('modalDetailTagihanProduk');
  if (elProd) elProd.textContent = `${item.produk} Mikro`;
  const elCair = document.getElementById('modalDetailTagihanTglCair');
  if (elCair) elCair.textContent = item.tglCair || '-';
  const elLimit = document.getElementById('modalDetailTagihanLimit');
  if (elLimit) elLimit.textContent = formatRupiah(item.limit);
  const elBade = document.getElementById('modalDetailTagihanBade');
  if (elBade) elBade.textContent = formatRupiah(item.bakiDebet);
  const elPetugas = document.getElementById('modalDetailTagihanPetugas');
  if (elPetugas) elPetugas.textContent = item.petugas || '-';
  const elCabang = document.getElementById('modalDetailTagihanCabang');
  if (elCabang) elCabang.textContent = tagihanCabangLabel(item);

  // Follow-up Info
  const elFuStatus = document.getElementById('modalDetailTagihanFollowupStatus');
  const elFuDetail = document.getElementById('modalDetailTagihanFollowupDetail');
  if (followup.status === 'sudah_bayar') {
    if (elFuStatus) {
      elFuStatus.textContent = 'Sudah Bayar / Setor';
      elFuStatus.className = 'px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800';
    }
    if (elFuDetail) elFuDetail.innerHTML = `Dicatat oleh <strong>${escapeHtml(followup.petugas)}</strong> pada ${escapeHtml(followup.updatedAt || '-')}.<br>${escapeHtml(followup.catatan ? 'Catatan: ' + followup.catatan : '')}`;
  } else if (followup.status === 'janji_bayar') {
    if (elFuStatus) {
      elFuStatus.textContent = `Janji Bayar (PTP: ${followup.ptpDate || '-'})`;
      elFuStatus.className = 'px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900';
    }
    if (elFuDetail) elFuDetail.innerHTML = `Janji bayar tanggal <strong>${escapeHtml(followup.ptpDate)}</strong> dicatat oleh <strong>${escapeHtml(followup.petugas)}</strong>.<br>${escapeHtml(followup.catatan ? 'Catatan: ' + followup.catatan : '')}`;
  } else if (followup.status === 'belum_ada_dana') {
    if (elFuStatus) {
      elFuStatus.textContent = 'Belum Ada Dana / Minta Tempo';
      elFuStatus.className = 'px-2 py-0.5 rounded-full text-[11px] font-bold bg-orange-100 text-orange-900';
    }
    if (elFuDetail) elFuDetail.innerHTML = `Dicatat oleh <strong>${escapeHtml(followup.petugas)}</strong>.<br>${escapeHtml(followup.catatan ? 'Catatan: ' + followup.catatan : '')}`;
  } else if (followup.status === 'kendala') {
    if (elFuStatus) {
      elFuStatus.textContent = 'Kendala / Macet';
      elFuStatus.className = 'px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-900';
    }
    if (elFuDetail) elFuDetail.innerHTML = `Dicatat oleh <strong>${escapeHtml(followup.petugas)}</strong>.<br>${escapeHtml(followup.catatan ? 'Catatan: ' + followup.catatan : '')}`;
  } else {
    if (elFuStatus) {
      elFuStatus.textContent = 'Belum Ditagih';
      elFuStatus.className = 'px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-200 text-slate-700';
    }
    if (elFuDetail) elFuDetail.textContent = 'Belum ada catatan progres penagihan untuk rekening ini.';
  }

  const modal = document.getElementById('modalDetailTagihan');
  if (modal) modal.classList.remove('hidden');
}
window.openDetailTagihan = openDetailTagihan;

function closeDetailTagihan() {
  const modal = document.getElementById('modalDetailTagihan');
  if (modal) modal.classList.add('hidden');
}
window.closeDetailTagihan = closeDetailTagihan;

// ================= MODAL FOLLOW-UP TAGIHAN =================
function openFollowupTagihan(id) {
  const item = findTagihanItemById(id);
  if (!item) {
    showToast('Data rekening tidak ditemukan', 'error');
    return;
  }

  currentActiveTagihan = item;
  const followup = getTagihanFollowup(item);

  const titleEl = document.getElementById('modalFollowupDebiturName');
  if (titleEl) titleEl.textContent = `${item.nama} (Rek: ${item.rekening})`;

  const idEl = document.getElementById('followupTagihanId');
  if (idEl) idEl.value = item.id || item.rekening;

  // Set Radio
  const radios = document.querySelectorAll('input[name="radioTagihanStatus"]');
  radios.forEach(r => {
    r.checked = (r.value === followup.status);
  });
  if (![...radios].some(r => r.checked)) {
    const defaultRadio = document.querySelector('input[name="radioTagihanStatus"][value="sudah_bayar"]');
    if (defaultRadio) defaultRadio.checked = true;
  }

  // PTP Box
  const ptpBox = document.getElementById('boxPtpDate');
  const ptpInput = document.getElementById('followupPtpDate');
  if (ptpInput) ptpInput.value = followup.ptpDate || '';
  if (followup.status === 'janji_bayar') {
    if (ptpBox) ptpBox.classList.remove('hidden');
  } else {
    if (ptpBox) ptpBox.classList.add('hidden');
  }

  // Petugas & Catatan
  const petEl = document.getElementById('followupPetugasName');
  if (petEl) petEl.value = followup.petugas && followup.petugas !== '-' ? followup.petugas : (item.petugas || '');

  const notesEl = document.getElementById('followupNotes');
  if (notesEl) notesEl.value = followup.catatan || '';

  const modal = document.getElementById('modalFollowupTagihan');
  if (modal) modal.classList.remove('hidden');
}
window.openFollowupTagihan = openFollowupTagihan;

function closeFollowupTagihan() {
  const modal = document.getElementById('modalFollowupTagihan');
  if (modal) modal.classList.add('hidden');
}
window.closeFollowupTagihan = closeFollowupTagihan;

function handleFollowupTagihanSubmit(e) {
  e.preventDefault();
  if (!currentActiveTagihan) return;

  const key = currentActiveTagihan.rekening || currentActiveTagihan.id;
  const statusEl = document.querySelector('input[name="radioTagihanStatus"]:checked');
  const status = statusEl ? statusEl.value : 'belum';
  const ptpDate = document.getElementById('followupPtpDate')?.value || '';
  const petugas = document.getElementById('followupPetugasName')?.value?.trim() || currentActiveTagihan.petugas || '-';
  const catatan = document.getElementById('followupNotes')?.value?.trim() || '';

  if (status === 'janji_bayar' && !ptpDate) {
    showToast('Harap pilih tanggal janji bayar (PTP)!', 'warning');
    return;
  }

  tagihanFollowupRecords[key] = {
    status,
    ptpDate: status === 'janji_bayar' ? ptpDate : '',
    petugas,
    catatan,
    updatedAt: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
  };

  saveTagihanFollowupRecords();
  updateTagihanUI();
  closeFollowupTagihan();

  // If detail modal is also open, refresh it
  const modalDetail = document.getElementById('modalDetailTagihan');
  if (modalDetail && !modalDetail.classList.contains('hidden')) {
    openDetailTagihan(key);
  }

  showToast(`Progres penagihan untuk ${currentActiveTagihan.nama} berhasil disimpan!`, 'success');
}

// ================= MODAL WA REMINDER TAGIHAN =================
function openWaTagihan(id) {
  const item = findTagihanItemById(id);
  if (!item) {
    showToast('Data rekening tidak ditemukan', 'error');
    return;
  }

  currentActiveTagihan = item;

  const titleEl = document.getElementById('modalWaDebiturName');
  if (titleEl) titleEl.textContent = `${item.nama} (Rek: ${item.rekening})`;

  const phoneInput = document.getElementById('inputWaTagihanPhone');
  if (phoneInput) phoneInput.value = '';

  selectWaTagihanTemplate('reminder');

  const modal = document.getElementById('modalWaTagihan');
  if (modal) modal.classList.remove('hidden');
}
window.openWaTagihan = openWaTagihan;

function closeWaTagihan() {
  const modal = document.getElementById('modalWaTagihan');
  if (modal) modal.classList.add('hidden');
}
window.closeWaTagihan = closeWaTagihan;

function selectWaTagihanTemplate(type) {
  currentWaTemplateType = type;
  if (!currentActiveTagihan) return;

  const btnRem = document.getElementById('btnTemplateReminder');
  const btnSal = document.getElementById('btnTemplateSaldo');
  const btnTung = document.getElementById('btnTemplateTunggakan');

  [btnRem, btnSal, btnTung].forEach(b => {
    if (b) b.className = 'p-2 rounded-xl border-2 border-slate-200 bg-white text-slate-700 font-bold text-center hover:bg-slate-50 transition';
  });

  if (type === 'reminder' && btnRem) {
    btnRem.className = 'p-2 rounded-xl border-2 border-emerald-500 bg-emerald-50 text-emerald-900 font-bold text-center transition';
  } else if (type === 'saldo_kurang' && btnSal) {
    btnSal.className = 'p-2 rounded-xl border-2 border-emerald-500 bg-emerald-50 text-emerald-900 font-bold text-center transition';
  } else if (type === 'tunggakan' && btnTung) {
    btnTung.className = 'p-2 rounded-xl border-2 border-emerald-500 bg-emerald-50 text-emerald-900 font-bold text-center transition';
  }

  const item = currentActiveTagihan;
  const area = document.getElementById('previewWaTagihanMessage');
  if (!area) return;

  if (type === 'reminder') {
    area.value = `Selamat pagi/siang Bapak/Ibu ${item.nama},

Kami dari Bank Mandiri menginfokan perihal angsuran pinjaman ${item.produk} Anda (No. Rek: ${item.rekening}) sebesar ${formatRupiah(item.angsuran)} dengan tanggal jatuh tempo setiap tanggal ${item.jt}.

Mohon pastikan saldo di rekening tabungan autodebet Anda (${item.rekAgf}) mencukupi sebelum tanggal jatuh tempo agar proses autodebet berjalan lancar dan riwayat pinjaman tetap lancar (Kol 1).

Terima kasih atas kerja sama dan kepercayaannya kepada Bank Mandiri.`;
  } else if (type === 'saldo_kurang') {
    area.value = `Selamat pagi/siang Bapak/Ibu ${item.nama},

Kami dari Bank Mandiri mengingatkan bahwa tagihan angsuran pinjaman ${item.produk} Anda (No. Rek: ${item.rekening}) adalah sebesar ${formatRupiah(item.angsuran)}.

Berdasarkan catatan sistem kami, saldo pada rekening autodebet (${item.rekAgf}) saat ini adalah ${formatRupiah(item.saldoAgf)}, terdapat kekurangan saldo sebesar Rp ${Number(item.kurangSaldo).toLocaleString('id-ID')}.

Mohon kesediaannya untuk segera melakukan penyetoran atau transfer ke rekening tabungan Anda sebelum tanggal ${item.jt} agar pembayaran angsuran tidak tertunda.

Terima kasih atas perhatian Bapak/Ibu.`;
  } else if (type === 'tunggakan') {
    area.value = `*PEMBERITAHUAN BANK MANDIRI*

Yth. Bapak/Ibu ${item.nama},
Terkait fasilitas pinjaman ${item.produk} Anda (No. Rek: ${item.rekening}), terdapat kewajiban pembayaran yang belum terselesaikan dengan rincian:
- Angsuran Bulanan: ${formatRupiah(item.angsuran)}
- Tunggakan: ${formatRupiah(item.tunggakan)}
- Total Kewajiban: ${formatRupiah(item.totalKewajiban)}
- Hari Tunggakan: ${item.ht} Hari (Kolektibilitas ${item.kol})

Mohon segera melakukan pembayaran/penyetoran melalui rekening ${item.rekAgf} atau menghubungi petugas kami (${item.petugas || 'Petugas Mandiri'}).

Terima kasih atas kerja samanya.`;
  }
}
window.selectWaTagihanTemplate = selectWaTagihanTemplate;

function sendWaTagihanNow() {
  const phoneInput = document.getElementById('inputWaTagihanPhone');
  const msgArea = document.getElementById('previewWaTagihanMessage');
  let phone = phoneInput ? phoneInput.value.trim() : '';
  const message = msgArea ? msgArea.value.trim() : '';

  if (!phone) {
    showToast('Harap masukkan nomor WhatsApp debitur terlebih dahulu!', 'warning');
    if (phoneInput) phoneInput.focus();
    return;
  }

  let formatted = cleanPhone(phone);
  if (!formatted) {
    showToast('Format nomor WhatsApp tidak valid!', 'error');
    return;
  }

  const url = `https://api.whatsapp.com/send?phone=${formatted}&text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
  showToast('Membuka WhatsApp...', 'success');
}

function copyWaTagihanText() {
  const msgArea = document.getElementById('previewWaTagihanMessage');
  if (msgArea && msgArea.value) {
    copyToClipboard(msgArea.value, 'Pesan WhatsApp');
  }
}

// ================= MODAL UPLOAD EXCEL TAGIHAN =================
function openUploadTagihanModal() {
  const modal = document.getElementById('modalUploadTagihan');
  if (modal) modal.classList.remove('hidden');
  resetTagihanUploadState();
}

function closeUploadTagihanModal() {
  const modal = document.getElementById('modalUploadTagihan');
  if (modal) modal.classList.add('hidden');
  resetTagihanUploadState();
}

function resetTagihanUploadState() {
  pendingImportTagihanData = [];
  const previewBox = document.getElementById('previewTagihanContainer');
  if (previewBox) previewBox.classList.add('hidden');
  const tbody = document.getElementById('previewTagihanTableBody');
  if (tbody) tbody.innerHTML = '';
  const btnProcess = document.getElementById('btnProcessImportTagihan');
  if (btnProcess) btnProcess.disabled = true;
  const fileInput = document.getElementById('excelFileTagihanInput');
  if (fileInput) fileInput.value = '';
}

function handleTagihanExcelUpload(file) {
  if (!file) return;

  const validExts = ['.xlsx', '.xls', '.csv'];
  const fileName = file.name.toLowerCase();
  const isValid = validExts.some(ext => fileName.endsWith(ext));

  if (!isValid) {
    showToast('Format file tidak didukung. Harap upload .xlsx, .xls, atau .csv', 'error');
    return;
  }

  showToast('Membaca file data tagihan...', 'info');

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const importResult = PortalTagihanImport.parse(workbook, XLSX);
      const parsedItems = importResult.items;

      if (parsedItems.length === 0) {
        showToast('Tidak ada data valid yang dapat dikenali dalam file', 'error');
        return;
      }

      pendingImportTagihanData = parsedItems;

      // Render Preview
      const previewBox = document.getElementById('previewTagihanContainer');
      const countEl = document.getElementById('previewTagihanRowCount');
      const tbody = document.getElementById('previewTagihanTableBody');
      const btnProcess = document.getElementById('btnProcessImportTagihan');

      if (previewBox) previewBox.classList.remove('hidden');
      if (countEl) countEl.textContent = `${parsedItems.length} rekening · ${importResult.branches} kode cabang · ${importResult.sheet}, header baris ${importResult.headerRow}`;

      if (tbody) {
        const previewRows = parsedItems.slice(0, 5);
        tbody.innerHTML = previewRows.map(r => `
          <tr>
            <td class="p-2 font-bold">${escapeHtml(r.nama)}</td>
            <td class="p-2 font-mono">${escapeHtml(r.rekening)}</td>
            <td class="p-2">${escapeHtml(r.produk)}</td>
            <td class="p-2 font-bold">Kol ${escapeHtml(r.kol)}</td>
            <td class="p-2">Tgl ${escapeHtml(r.jt)}</td>
            <td class="p-2">${formatRupiah(r.angsuran)}</td>
            <td class="p-2 font-bold ${r.saldoCukup ? 'text-emerald-700' : 'text-red-700'}">${formatRupiah(r.saldoAgf)}</td>
          </tr>
        `).join('');
      }

      if (btnProcess) btnProcess.disabled = false;
      showToast(`Berhasil membaca ${parsedItems.length} baris data tagihan. Silakan klik simpan!`, 'success');

    } catch (err) {
      console.error('Error parsing tagihan excel:', err);
      showToast('Gagal memproses file Excel: ' + err.message, 'error');
    }
  };
  reader.readAsArrayBuffer(file);
}

function processFinalImportTagihan() {
  if (!pendingImportTagihanData || pendingImportTagihanData.length === 0) {
    showToast('Tidak ada data yang siap diimpor', 'warning');
    return;
  }

  // Update existing or add new by rekening
  let updatedCount = 0;
  let addedCount = 0;

  pendingImportTagihanData.forEach(newItem => {
    const existingIdx = dbTagihan.findIndex(x => String(x.rekening) === String(newItem.rekening));
    if (existingIdx !== -1) {
      dbTagihan[existingIdx] = { ...dbTagihan[existingIdx], ...newItem };
      updatedCount++;
    } else {
      dbTagihan.push(newItem);
      addedCount++;
    }
  });

  saveTagihanDatabase();
  populateTagihanPetugasDropdown();
  updateTagihanUI();
  closeUploadTagihanModal();

  showToast(`Sukses memperbarui data tagihan! (${addedCount} baru, ${updatedCount} diperbarui)`, 'success');
}

// ================= EXPORT & TEMPLATE TAGIHAN =================
function exportTagihanExcel() {
  if (dbTagihan.length === 0) {
    showToast('Database tagihan kosong, tidak ada data untuk diekspor', 'warning');
    return;
  }

  showToast('Menyiapkan file rekap tagihan Excel...', 'info');

  const rows = dbTagihan.map((item, idx) => {
    const fu = getTagihanFollowup(item);
    return {
      'NO': idx + 1,
      'CABANG': item.cabang,
      'UNIT': item.unit || '',
      'CIF': item.cif,
      'PETUGAS': item.petugas,
      'PRODUK': item.produk,
      'NO REKENING': item.rekening,
      'NAMA NASABAH': item.nama,
      'LIMIT PLAFON': item.limit,
      'BAKI DEBET': item.bakiDebet,
      'KOL': item.kol,
      'KOL LALU': item.kolPrev,
      'TGL CAIR': item.tglCair,
      'JT': item.jt,
      'HT': item.ht,
      'ANGSURAN': item.angsuran,
      'TUNGGAKAN': item.tunggakan,
      'TUNGGAKAN POKOK': item.tunggakanPokok ?? '',
      'TUNGGAKAN BUNGA': item.tunggakanBunga ?? '',
      'TUNGGAKAN DENDA': item.tunggakanDenda ?? '',
      'TUNGGAKAN LAIN': item.tunggakanLain ?? '',
      'TOTAL KEWAJIBAN': item.totalKewajiban,
      'REK AGF': item.rekAgf,
      'SALDO AGF': item.saldoAgf,
      'KECUKUPAN SALDO': item.saldoCukup ? 'CUKUP' : 'KURANG',
      'KEKURANGAN SALDO': item.kurangSaldo,
      'STATUS PENAGIHAN': fu.status === 'sudah_bayar' ? 'SUDAH BAYAR' : fu.status === 'janji_bayar' ? 'JANJI BAYAR' : fu.status === 'belum_ada_dana' ? 'BELUM ADA DANA' : fu.status === 'kendala' ? 'KENDALA' : 'BELUM DITAGIH',
      'TANGGAL JANJI BAYAR (PTP)': fu.ptpDate || '',
      'PETUGAS PENAGIH': fu.petugas || '',
      'CATATAN PENAGIHAN': fu.catatan || '',
      'TGL UPDATE PENAGIHAN': fu.updatedAt || ''
    };
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Rekap Tagihan Mandiri');

  const dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `Rekap_Monitoring_Tagihan_Mandiri_${dateStr}.xlsx`);
  showToast('File rekap tagihan berhasil diunduh!', 'success');
}

function downloadTemplateTagihan() {
  const link = document.createElement('a');
  link.href = 'contoh_data_tagihan.xlsx';
  link.download = 'contoh_data_tagihan.xlsx';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Mengunduh contoh format file data tagihan...', 'info');
}

// ================= SETUP EVENT LISTENERS TAGIHAN =================
function setupTagihanEventListeners() {
  // Header Actions
  const btnExport = document.getElementById('btnExportTagihanExcel');
  if (btnExport) btnExport.addEventListener('click', exportTagihanExcel);

  const btnTemplate = document.getElementById('btnDownloadTemplateTagihan');
  if (btnTemplate) btnTemplate.addEventListener('click', downloadTemplateTagihan);

  const btnOpenUpload = document.getElementById('btnOpenUploadTagihanModal');
  if (btnOpenUpload) btnOpenUpload.addEventListener('click', openUploadTagihanModal);

  // Search Tagihan
  const searchInput = document.getElementById('searchTagihanInput');
  const btnClearSearch = document.getElementById('btnClearSearchTagihan');
  let searchTimer = null;

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const val = e.target.value;
      if (btnClearSearch) {
        if (val) btnClearSearch.classList.remove('hidden');
        else btnClearSearch.classList.add('hidden');
      }

      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        currentTagihanSearch = val;
        currentTagihanPage = 1;
        updateTagihanUI();
      }, 250);
    });
  }

  if (btnClearSearch) {
    btnClearSearch.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      btnClearSearch.classList.add('hidden');
      currentTagihanSearch = '';
      currentTagihanPage = 1;
      updateTagihanUI();
    });
  }

  // Filter Dropdowns
  const fJT = document.getElementById('filterTagihanJT');
  if (fJT) fJT.addEventListener('change', (e) => {
    currentTagihanFilterJT = e.target.value;
    currentTagihanPage = 1;
    updateTagihanUI();
  });

  const fKol = document.getElementById('filterTagihanKol');
  if (fKol) fKol.addEventListener('change', (e) => {
    currentTagihanFilterKol = e.target.value;
    currentTagihanPage = 1;
    updateTagihanUI();
  });

  const fSaldo = document.getElementById('filterTagihanSaldo');
  if (fSaldo) fSaldo.addEventListener('change', (e) => {
    currentTagihanFilterSaldo = e.target.value;
    currentTagihanPage = 1;
    updateTagihanUI();
  });

  const fCabang = document.getElementById('filterTagihanCabang');
  if (fCabang) fCabang.addEventListener('change', e => {
    currentTagihanFilterCabang = e.target.value;
    currentTagihanPage = 1;
    updateTagihanUI();
  });

  const fPetugas = document.getElementById('filterTagihanPetugas');
  if (fPetugas) fPetugas.addEventListener('change', (e) => {
    currentTagihanFilterPetugas = e.target.value;
    currentTagihanPage = 1;
    updateTagihanUI();
  });

  const fProduk = document.getElementById('filterTagihanProduk');
  if (fProduk) fProduk.addEventListener('change', (e) => {
    currentTagihanFilterProduk = e.target.value;
    currentTagihanPage = 1;
    updateTagihanUI();
  });

  const fFollowup = document.getElementById('filterTagihanFollowup');
  if (fFollowup) fFollowup.addEventListener('change', (e) => {
    currentTagihanFilterFollowup = e.target.value;
    currentTagihanPage = 1;
    updateTagihanUI();
  });

  // Modal Detail Tagihan Close
  const btnCloseDetail = document.getElementById('btnCloseModalDetailTagihan');
  if (btnCloseDetail) btnCloseDetail.addEventListener('click', closeDetailTagihan);
  const btnCloseDetailFooter = document.getElementById('btnCloseModalDetailTagihanFooter');
  if (btnCloseDetailFooter) btnCloseDetailFooter.addEventListener('click', closeDetailTagihan);

  const btnOpenWaFromDetail = document.getElementById('btnOpenWaFromDetailTagihan');
  if (btnOpenWaFromDetail) btnOpenWaFromDetail.addEventListener('click', () => {
    if (currentActiveTagihan) openWaTagihan(currentActiveTagihan.id);
  });

  const btnOpenFuFromDetail = document.getElementById('btnOpenFollowupFromDetailTagihan');
  if (btnOpenFuFromDetail) btnOpenFuFromDetail.addEventListener('click', () => {
    if (currentActiveTagihan) openFollowupTagihan(currentActiveTagihan.id);
  });

  // Modal Follow-up Tagihan
  const btnCloseFu = document.getElementById('btnCloseModalFollowupTagihan');
  if (btnCloseFu) btnCloseFu.addEventListener('click', closeFollowupTagihan);
  const btnCancelFu = document.getElementById('btnCancelFollowupTagihan');
  if (btnCancelFu) btnCancelFu.addEventListener('click', closeFollowupTagihan);
  const formFu = document.getElementById('formFollowupTagihan');
  if (formFu) formFu.addEventListener('submit', handleFollowupTagihanSubmit);

  // Radio listener for PTP Box toggle
  document.querySelectorAll('input[name="radioTagihanStatus"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const ptpBox = document.getElementById('boxPtpDate');
      const ptpInput = document.getElementById('followupPtpDate');
      if (e.target.value === 'janji_bayar') {
        if (ptpBox) ptpBox.classList.remove('hidden');
        if (ptpInput) ptpInput.setAttribute('required', 'true');
      } else {
        if (ptpBox) ptpBox.classList.add('hidden');
        if (ptpInput) ptpInput.removeAttribute('required');
      }
    });
  });

  // Modal WA Tagihan
  const btnCloseWa = document.getElementById('btnCloseModalWaTagihan');
  if (btnCloseWa) btnCloseWa.addEventListener('click', closeWaTagihan);
  const btnCancelWa = document.getElementById('btnCancelWaTagihan');
  if (btnCancelWa) btnCancelWa.addEventListener('click', closeWaTagihan);
  const btnCopyWa = document.getElementById('btnCopyWaTagihan');
  if (btnCopyWa) btnCopyWa.addEventListener('click', copyWaTagihanText);
  const btnSendWa = document.getElementById('btnSendWaTagihanNow');
  if (btnSendWa) btnSendWa.addEventListener('click', sendWaTagihanNow);

  // Modal Upload Tagihan
  const btnCloseUpload = document.getElementById('btnCloseModalUploadTagihan');
  if (btnCloseUpload) btnCloseUpload.addEventListener('click', closeUploadTagihanModal);
  const btnCancelUpload = document.getElementById('btnCancelUploadTagihan');
  if (btnCancelUpload) btnCancelUpload.addEventListener('click', closeUploadTagihanModal);
  const btnDownloadTplModal = document.getElementById('btnDownloadTemplateTagihanModal');
  if (btnDownloadTplModal) btnDownloadTplModal.addEventListener('click', downloadTemplateTagihan);

  const dropZone = document.getElementById('dropZoneTagihan');
  const fileInput = document.getElementById('excelFileTagihanInput');

  if (dropZone && fileInput) {
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleTagihanExcelUpload(e.target.files[0]);
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
        handleTagihanExcelUpload(e.dataTransfer.files[0]);
      }
    });
  }

  const btnProcessImport = document.getElementById('btnProcessImportTagihan');
  if (btnProcessImport) btnProcessImport.addEventListener('click', processFinalImportTagihan);

  // Modal Cetak Advis LMAP
  const btnCloseAdvis = document.getElementById('btnCloseModalCetakAdvis');
  if (btnCloseAdvis) btnCloseAdvis.addEventListener('click', closeModalCetakAdvis);

  const btnCancelAdvis = document.getElementById('btnCancelModalCetakAdvis');
  if (btnCancelAdvis) btnCancelAdvis.addEventListener('click', closeModalCetakAdvis);

  const btnDlDocx = document.getElementById('btnDownloadAdvisDocx');
  if (btnDlDocx) btnDlDocx.addEventListener('click', downloadAdvisDocx);

  const btnDlPdf = document.getElementById('btnDownloadAdvisPdf');
  if (btnDlPdf) btnDlPdf.addEventListener('click', downloadAdvisPdf);

  const btnPrintAdvis = document.getElementById('btnPrintAdvisWindow');
  if (btnPrintAdvis) btnPrintAdvis.addEventListener('click', printAdvisDocument);

  const inputNomor = document.getElementById('advisInputNomor');
  if (inputNomor) {
    inputNomor.addEventListener('input', () => {
      const el = document.getElementById('previewAdvisNomorText');
      if (el) el.textContent = inputNomor.value.trim() || '-';
    });
  }

  const inputTanggal = document.getElementById('advisInputTanggal');
  if (inputTanggal) {
    inputTanggal.addEventListener('input', () => {
      const el = document.getElementById('previewAdvisTanggalText');
      if (el) el.textContent = inputTanggal.value.trim() || '-';
    });
  }
}

// =========================================================================
// ================= FITUR CETAK TAGIHAN (ADVIS LMAP) ======================
// =========================================================================

function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function getIndonesianDateString(d = new Date()) {
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const day = d.getDate();
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

function formatNumberInput(num) {
  if (!num && num !== 0) return '';
  return Number(num).toLocaleString('id-ID');
}

function parseNumberInput(str) {
  if (!str) return 0;
  const cleaned = String(str).replace(/[^\d]/g, '');
  return parseInt(cleaned, 10) || 0;
}

function toggleSelectTagihan(id, isChecked) {
  if (isChecked) {
    selectedTagihanIds.add(id);
  } else {
    selectedTagihanIds.delete(id);
    delete currentAdvisNominalMap[id];
  }
  syncSelectedTagihanToAdvis(false);
  updateTagihanSelectionUI();
}
window.toggleSelectTagihan = toggleSelectTagihan;

function toggleSelectAllTagihan(isChecked) {
  const cbs = document.querySelectorAll('.tagihan-select-cb');
  cbs.forEach(cb => {
    const id = cb.dataset.id;
    if (id) {
      if (isChecked) {
        selectedTagihanIds.add(id);
      } else {
        selectedTagihanIds.delete(id);
        delete currentAdvisNominalMap[id];
      }
    }
  });
  syncSelectedTagihanToAdvis(true);
  updateTagihanSelectionUI();
}
window.toggleSelectAllTagihan = toggleSelectAllTagihan;

function clearTagihanSelection() {
  selectedTagihanIds.clear();
  currentAdvisNominalMap = {};
  advisDebiturList = [];
  updateTagihanSelectionUI();
}
window.clearTagihanSelection = clearTagihanSelection;

function updateTagihanSelectionUI() {
  const count = selectedTagihanIds.size;
  const countBadge = document.getElementById('badgeSelectedTagihanCount');
  if (countBadge) countBadge.textContent = count;

  const countBadgeModal = document.getElementById('advisDebiturCountBadge');
  if (countBadgeModal) {
    const activeCount = advisDebiturList.filter(item => (item.nama && item.nama.trim()) || (item.nominal && item.nominal > 0)).length;
    countBadgeModal.textContent = `${activeCount || count} debitur dipilih`;
  }

  const floatingBar = document.getElementById('tagihanSelectionFloatingBar');
  if (floatingBar) {
    if (count > 0) floatingBar.classList.remove('hidden');
    else floatingBar.classList.add('hidden');
  }

  // Update check-all checkbox state
  const checkAll = document.getElementById('checkSelectAllTagihan');
  const cbs = document.querySelectorAll('.tagihan-select-cb');
  if (checkAll && cbs.length > 0) {
    const allChecked = Array.from(cbs).every(cb => selectedTagihanIds.has(cb.dataset.id));
    checkAll.checked = allChecked;
  }

  // Sync checkboxes and visual card/row highlights
  cbs.forEach(cb => {
    const isSel = selectedTagihanIds.has(cb.dataset.id);
    cb.checked = isSel;
    const card = cb.closest('.tagihan-card-item');
    if (card) {
      if (isSel) {
        card.classList.add('ring-2', 'ring-mandiri-blue', 'bg-blue-50/40');
      } else {
        card.classList.remove('ring-2', 'ring-mandiri-blue', 'bg-blue-50/40');
      }
    }
    const row = cb.closest('tr');
    if (row) {
      if (isSel) {
        row.classList.add('bg-blue-50/60');
      } else {
        row.classList.remove('bg-blue-50/60');
      }
    }
  });
}
window.updateTagihanSelectionUI = updateTagihanSelectionUI;

// ================= CETAK ADVIS LMAP (STANDALONE / MANUAL & SELECTION) =================
let advisDebiturList = []; // Array of { id, nama, rekAgf, rekening, nominal }

function syncSelectedTagihanToAdvis(force = true) {
  if (selectedTagihanIds.size > 0) {
    const syncedList = [];
    selectedTagihanIds.forEach(id => {
      // Cari data nasabah di dbTagihan berdasarkan id atau rekening
      const item = dbTagihan.find(x => x.id === id || String(x.id) === String(id) || String(x.rekening) === String(id));
      if (item) {
        // Cek apakah nominal sudah pernah diinput/disunting oleh user sebelumnya
        const savedNominal = currentAdvisNominalMap[item.id] !== undefined 
          ? currentAdvisNominalMap[item.id] 
          : (currentAdvisNominalMap[item.rekening] !== undefined ? currentAdvisNominalMap[item.rekening] : undefined);

        // Nilai default: samakan dengan tunggakan (totalKewajiban), atau jika 0 gunakan angsuran
        const defaultNominal = (Number(item.tunggakan) > 0) 
          ? Number(item.tunggakan) 
          : (Number(item.totalKewajiban) > 0 ? Number(item.totalKewajiban) : (Number(item.angsuran) || 0));

        const finalNominal = savedNominal !== undefined ? savedNominal : defaultNominal;

        syncedList.push({
          id: item.id || ('tagihan-' + item.rekening),
          nama: item.nama || '',
          rekAgf: item.rekAgf || '',
          rekening: item.rekening || '',
          nominal: finalNominal
        });
      }
    });

    if (syncedList.length > 0) {
      advisDebiturList = syncedList;
    }
  } else if (force) {
    advisDebiturList = [];
  }
}
window.syncSelectedTagihanToAdvis = syncSelectedTagihanToAdvis;

function cetakAdvisSingle(id) {
  selectedTagihanIds.clear();
  selectedTagihanIds.add(id);
  syncSelectedTagihanToAdvis(true);
  updateTagihanSelectionUI();
  openModalCetakAdvis(id);
}
window.cetakAdvisSingle = cetakAdvisSingle;

function addAdvisManualRow(nama = '', rekAgf = '', rekening = '', nominal = 0) {
  const newRow = {
    id: 'adv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    nama: nama,
    rekAgf: rekAgf,
    rekening: rekening,
    nominal: Number(nominal) || 0
  };
  advisDebiturList.push(newRow);
  renderAdvisFormTable();
  updateAdvisPreview();
  showToast('Baris debitur baru ditambahkan', 'info');
}
window.addAdvisManualRow = addAdvisManualRow;

function clearAdvisRows() {
  if (advisDebiturList.length === 0) return;
  advisDebiturList = [];
  selectedTagihanIds.clear();
  currentAdvisNominalMap = {};
  updateTagihanSelectionUI();
  renderAdvisFormTable();
  updateAdvisPreview();
  showToast('Seluruh baris debitur dikosongkan', 'info');
}
window.clearAdvisRows = clearAdvisRows;

function removeAdvisDebitur(id) {
  advisDebiturList = advisDebiturList.filter(item => item.id !== id);
  selectedTagihanIds.delete(id);
  const match = dbTagihan.find(x => x.id === id || String(x.rekening) === String(id));
  if (match) {
    if (match.id) selectedTagihanIds.delete(match.id);
    if (match.rekening) selectedTagihanIds.delete(match.rekening);
  }
  delete currentAdvisNominalMap[id];
  updateTagihanSelectionUI();
  renderAdvisFormTable();
  updateAdvisPreview();
}
window.removeAdvisDebitur = removeAdvisDebitur;

function handleAdvisFieldInput(id, field, value) {
  const item = advisDebiturList.find(x => x.id === id);
  if (!item) return;

  if (field === 'nominal') {
    item.nominal = parseNumberInput(value);
    currentAdvisNominalMap[id] = item.nominal;
    updateAdvisTotalNominal();
    updateAdvisPreview();
  } else {
    item[field] = value;
    updateAdvisPreview();
  }
}
window.handleAdvisFieldInput = handleAdvisFieldInput;

function openModalCetakAdvis(specificId) {
  if (specificId) {
    selectedTagihanIds.clear();
    selectedTagihanIds.add(specificId);
  }

  // Jika ada debitur yang dipilih dari tabel/kartu tagihan, selalu sinkronkan otomatis ke tabel Advis
  if (selectedTagihanIds.size > 0) {
    syncSelectedTagihanToAdvis(true);
  }

  // Jika daftar debitur masih kosong (misal buka dari header tanpa memilih nasabah),
  // sediakan 1 baris kosong untuk entri manual langsung
  if (advisDebiturList.length === 0) {
    advisDebiturList.push({
      id: 'adv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      nama: '',
      rekAgf: '',
      rekening: '',
      nominal: 0
    });
  }

  updateTagihanSelectionUI();

  // Isi default tanggal jika kosong
  const tglInput = document.getElementById('advisInputTanggal');
  if (tglInput && !tglInput.value.trim()) {
    tglInput.value = getIndonesianDateString();
  }

  // Muat logo dan tanda tangan di pratinjau surat
  const logoImg = document.getElementById('previewAdvisLogoImg');
  if (logoImg && window.ADVIS_MANDIRI_LOGO_BASE64) {
    logoImg.src = window.ADVIS_MANDIRI_LOGO_BASE64;
  }
  const sigImg = document.getElementById('previewAdvisSignatureImg');
  if (sigImg && window.ADVIS_SIGNATURE_BASE64) {
    sigImg.src = window.ADVIS_SIGNATURE_BASE64;
  }

  const modal = document.getElementById('modalCetakAdvis');
  if (modal) modal.classList.remove('hidden');

  switchAdvisModalTab('form');
  renderAdvisFormTable();
  updateAdvisPreview();

  const nomorInput = document.getElementById('advisInputNomor');
  if (nomorInput && !nomorInput.value.trim()) {
    setTimeout(() => nomorInput.focus(), 150);
  }
}
window.openModalCetakAdvis = openModalCetakAdvis;

function closeModalCetakAdvis() {
  const modal = document.getElementById('modalCetakAdvis');
  if (modal) modal.classList.add('hidden');
}
window.closeModalCetakAdvis = closeModalCetakAdvis;

function switchAdvisModalTab(tab) {
  // Both panels stay visible; kept for existing print/export and validation callers.
  currentAdvisActiveTab = tab;
  document.getElementById('advisSectionForm')?.classList.remove('hidden');
  document.getElementById('advisSectionPreview')?.classList.remove('hidden');
  updateAdvisPreview();
}
window.switchAdvisModalTab = switchAdvisModalTab;

function renderAdvisFormTable() {
  const tbody = document.getElementById('advisFormTableBody');
  if (!tbody) return;

  if (advisDebiturList.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="p-6 text-center text-slate-400">
          <i class="fa-solid fa-folder-open text-2xl mb-2 block"></i>
          Belum ada baris debitur. Klik tombol <strong class="text-mandiri-blue font-bold">+ Tambah Baris Debitur</strong> di atas untuk menambah data.
        </td>
      </tr>
    `;
    updateAdvisTotalNominal();
    return;
  }

  tbody.innerHTML = advisDebiturList.map((item, idx) => {
    return `
      <tr class="hover:bg-slate-50 transition">
        <td class="p-3 text-center font-bold text-slate-500">${idx + 1}</td>
        <td class="p-2.5">
          <input type="text"
                 class="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:border-mandiri-blue focus:ring-1 focus:ring-blue-100 font-bold text-xs outline-none"
                 value="${escapeHtml(item.nama || '')}"
                 oninput="handleAdvisFieldInput('${escapeHtml(item.id)}', 'nama', this.value)"
                 placeholder="Nama Debitur">
        </td>
        <td class="p-2.5">
          <input type="text"
                 class="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:border-mandiri-blue focus:ring-1 focus:ring-blue-100 font-mono text-xs outline-none"
                 value="${escapeHtml(item.rekAgf || '')}"
                 oninput="handleAdvisFieldInput('${escapeHtml(item.id)}', 'rekAgf', this.value)"
                 placeholder="No. Rek Debit (AGF)">
        </td>
        <td class="p-2.5">
          <input type="text"
                 class="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:border-mandiri-blue focus:ring-1 focus:ring-blue-100 font-mono text-xs outline-none"
                 value="${escapeHtml(item.rekening || '')}"
                 oninput="handleAdvisFieldInput('${escapeHtml(item.id)}', 'rekening', this.value)"
                 placeholder="No. Rek Kredit">
        </td>
        <td class="p-2.5 text-right">
          <div class="relative">
            <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">Rp</span>
            <input type="text"
                   class="w-full pl-8 pr-2.5 py-1.5 rounded-lg border border-slate-300 focus:border-mandiri-blue focus:ring-1 focus:ring-blue-100 font-bold text-right text-xs outline-none"
                   value="${formatNumberInput(item.nominal || 0)}"
                   oninput="handleAdvisFieldInput('${escapeHtml(item.id)}', 'nominal', this.value)"
                   placeholder="0">
          </div>
        </td>
        <td class="p-2.5 text-center">
          <button type="button" onclick="removeAdvisDebitur('${escapeHtml(item.id)}')" class="text-red-500 hover:text-red-700 p-1.5 rounded hover:bg-red-50 transition" title="Hapus debitur ini">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  updateAdvisTotalNominal();
}
window.renderAdvisFormTable = renderAdvisFormTable;

function updateAdvisTotalNominal() {
  let total = 0;
  advisDebiturList.forEach(item => {
    total += Number(item.nominal) || 0;
  });

  const totalEl = document.getElementById('advisFormTotalNominal');
  if (totalEl) totalEl.textContent = formatRupiah(total);

  const previewTotal = document.getElementById('previewAdvisTotalText');
  if (previewTotal) previewTotal.textContent = formatRupiah(total);
}
window.updateAdvisTotalNominal = updateAdvisTotalNominal;

function updateAdvisPreview() {
  const nomorInput = document.getElementById('advisInputNomor');
  const tanggalInput = document.getElementById('advisInputTanggal');

  const nomorText = nomorInput && nomorInput.value.trim() ? nomorInput.value.trim() : '-';
  const tanggalText = tanggalInput && tanggalInput.value.trim() ? tanggalInput.value.trim() : getIndonesianDateString();

  const previewNomor = document.getElementById('previewAdvisNomorText');
  if (previewNomor) previewNomor.textContent = nomorText;

  const previewTanggal = document.getElementById('previewAdvisTanggalText');
  if (previewTanggal) previewTanggal.textContent = tanggalText;

  // Pastikan logo Mandiri dan tanda tangan terpasang
  const logoImg = document.getElementById('previewAdvisLogoImg');
  if (logoImg && (!logoImg.src || logoImg.src === window.location.href || logoImg.src.endsWith('/')) && window.ADVIS_MANDIRI_LOGO_BASE64) {
    logoImg.src = window.ADVIS_MANDIRI_LOGO_BASE64;
  }
  const sigImg = document.getElementById('previewAdvisSignatureImg');
  if (sigImg && (!sigImg.src || sigImg.src === window.location.href || sigImg.src.endsWith('/')) && window.ADVIS_SIGNATURE_BASE64) {
    sigImg.src = window.ADVIS_SIGNATURE_BASE64;
  }

  const tbody = document.getElementById('previewAdvisTableBody');
  if (!tbody) return;

  const activeItems = advisDebiturList.filter(item => (item.nama && item.nama.trim()) || (item.nominal && item.nominal > 0));

  if (activeItems.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="border: 1px solid #4F81BD; padding: 16px; text-align: center; color: #64748b; font-style: italic;">
          Belum ada data debitur yang diisi
        </td>
      </tr>
    `;
    const totalEl = document.getElementById('previewAdvisTotalText');
    if (totalEl) totalEl.textContent = 'Rp 0';
    return;
  }

  let total = 0;
  tbody.innerHTML = activeItems.map((item, idx) => {
    const nominal = Number(item.nominal) || 0;
    total += nominal;
    const bg = idx % 2 === 0 ? '#DCE6F1' : '#FFFFFF';
    return `
      <tr style="background-color: ${bg};">
        <td style="border: 1px solid #4F81BD; padding: 4px; text-align: center; font-size: 10pt;">${idx + 1}</td>
        <td style="border: 1px solid #4F81BD; padding: 4px 6px; font-size: 10pt;">${escapeHtml(item.nama || '-')}</td>
        <td style="border: 1px solid #4F81BD; padding: 4px 6px; text-align: center; font-family: monospace; font-size: 10pt;">${escapeHtml(item.rekAgf || '-')}</td>
        <td style="border: 1px solid #4F81BD; padding: 4px 6px; text-align: center; font-family: monospace; font-size: 10pt;">${escapeHtml(item.rekening || '-')}</td>
        <td style="border: 1px solid #4F81BD; padding: 4px 6px; text-align: right; font-family: monospace; font-size: 10pt;">${formatRupiah(nominal)}</td>
      </tr>
    `;
  }).join('');

  const totalEl = document.getElementById('previewAdvisTotalText');
  if (totalEl) totalEl.textContent = formatRupiah(total);
}
window.updateAdvisPreview = updateAdvisPreview;

// ================= DOWNLOAD DOKUMEN WORD (.DOCX) =================
let isDownloadingAdvisDocx = false;
async function downloadAdvisDocx() {
  if (isDownloadingAdvisDocx) return;

  const nomorInput = document.getElementById('advisInputNomor');
  const nomor = nomorInput ? nomorInput.value.trim() : '';
  if (!nomor) {
    showToast('Harap masukkan Nomor Surat terlebih dahulu!', 'warning');
    if (nomorInput) nomorInput.focus();
    switchAdvisModalTab('form');
    return;
  }

  const tanggalInput = document.getElementById('advisInputTanggal');
  const tanggal = tanggalInput && tanggalInput.value.trim() ? tanggalInput.value.trim() : getIndonesianDateString();

  const activeItems = advisDebiturList.filter(item => (item.nama && item.nama.trim()) || (item.nominal && item.nominal > 0));
  if (activeItems.length === 0) {
    showToast('Masukkan minimal 1 data debitur untuk mencetak Advis LMAP!', 'warning');
    return;
  }

  if (typeof JSZip === 'undefined' || !window.ADVIS_LMAP_TEMPLATE_BASE64) {
    showToast('Library pembuat dokumen Word belum dimuat', 'error');
    return;
  }

  isDownloadingAdvisDocx = true;
  const btnDlDocx = document.getElementById('btnDownloadAdvisDocx');
  const originalBtnHtml = btnDlDocx ? btnDlDocx.innerHTML : '';
  if (btnDlDocx) {
    btnDlDocx.disabled = true;
    btnDlDocx.classList.add('opacity-75', 'cursor-not-allowed');
    btnDlDocx.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-sm"></i> <span>Mengunduh...</span>';
  }

  showToast('Membuat dokumen Word Advis LMAP...', 'info');

  try {
    const zip = await JSZip.loadAsync(window.ADVIS_LMAP_TEMPLATE_BASE64, { base64: true });
    let xml = await zip.file('word/document.xml').async('text');

    // 1. Ganti Nomor
    const nomorRegex = /(<w:t>Nomor<\/w:t>[\s\S]*?<w:t xml:space="preserve">:\s*)(<\/w:t>)/;
    xml = xml.replace(nomorRegex, `$1${escapeXml(nomor)}$2`);

    // 2. Ganti Tanggal
    const tanggalRegex = /(<w:t>Tanggal<\/w:t>[\s\S]*?<w:t xml:space="preserve">:\s*)(<\/w:t>)/;
    xml = xml.replace(tanggalRegex, `$1${escapeXml(tanggal)}$2`);

    // 3. Ganti Tabel Data
    const tblStart = xml.indexOf('<w:tbl>');
    const tblEnd = xml.indexOf('</w:tbl>') + 8;
    const tblXml = xml.substring(tblStart, tblEnd);

    const tblPrMatch = tblXml.match(/<w:tblPr[\s\S]*?<\/w:tblPr>/);
    const tblGridMatch = tblXml.match(/<w:tblGrid[\s\S]*?<\/w:tblGrid>/);
    const rows = tblXml.match(/<w:tr[\s\S]*?<\/w:tr>/g);

    const tblPr = tblPrMatch ? tblPrMatch[0] : '';
    const tblGrid = tblGridMatch ? tblGridMatch[0] : '';
    const headerRow = rows && rows.length > 0 ? rows[0] : '';

    const dataRowsXml = activeItems.map((item, idx) => {
      const nominalVal = Number(item.nominal) || 0;
      const nominalStr = formatRupiah(nominalVal);
      const rekDebit = item.rekAgf || '-';
      const rekKredit = item.rekening || '-';

      return `<w:tr w:rsidR="00D1563A" w:rsidTr="00D1563A">
        <w:trPr><w:trHeight w:val="250"/></w:trPr>
        <w:tc>
          <w:tcPr><w:tcW w:w="535" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>
          <w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:rFonts w:asciiTheme="minorHAnsi" w:hAnsiTheme="minorHAnsi"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:pPr>
            <w:r><w:rPr><w:rFonts w:asciiTheme="minorHAnsi" w:hAnsiTheme="minorHAnsi"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t>${idx + 1}</w:t></w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="2520" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>
          <w:p><w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:color w:val="000000"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:color w:val="000000"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t>${escapeXml(item.nama || '-')}</w:t></w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="2050" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>
          <w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:rFonts w:asciiTheme="minorHAnsi" w:hAnsiTheme="minorHAnsi"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:pPr>
            <w:r><w:rPr><w:rFonts w:asciiTheme="minorHAnsi" w:hAnsiTheme="minorHAnsi"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t>${escapeXml(rekDebit)}</w:t></w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="2070" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>
          <w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:rFonts w:asciiTheme="minorHAnsi" w:hAnsiTheme="minorHAnsi"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:pPr>
            <w:r><w:rPr><w:rFonts w:asciiTheme="minorHAnsi" w:hAnsiTheme="minorHAnsi"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t>${escapeXml(rekKredit)}</w:t></w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="1910" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>
          <w:p><w:pPr><w:jc w:val="right"/><w:rPr><w:rFonts w:asciiTheme="minorHAnsi" w:hAnsiTheme="minorHAnsi"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:pPr>
            <w:r><w:rPr><w:rFonts w:asciiTheme="minorHAnsi" w:hAnsiTheme="minorHAnsi"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t>${escapeXml(nominalStr)}</w:t></w:r>
          </w:p>
        </w:tc>
      </w:tr>`;
    }).join('');

    const newTable = `<w:tbl>${tblPr}${tblGrid}${headerRow}${dataRowsXml}</w:tbl>`;
    xml = xml.substring(0, tblStart) + newTable + xml.substring(tblEnd);

    zip.file('word/document.xml', xml);
    const blob = await zip.generateAsync({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Advis LMAP.docx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('Dokumen Word "Advis LMAP.docx" berhasil diunduh!', 'success');
  } catch (err) {
    console.error('Error generating docx:', err);
    showToast('Gagal membuat dokumen Word: ' + err.message, 'error');
  } finally {
    isDownloadingAdvisDocx = false;
    if (btnDlDocx) {
      btnDlDocx.disabled = false;
      btnDlDocx.classList.remove('opacity-75', 'cursor-not-allowed');
      btnDlDocx.innerHTML = originalBtnHtml;
    }
  }
}
window.downloadAdvisDocx = downloadAdvisDocx;

// ================= DOWNLOAD DOKUMEN PDF (ADVIS LMAP.PDF) =================
let isDownloadingAdvisPdf = false;
async function downloadAdvisPdf() {
  if (isDownloadingAdvisPdf) return;

  const nomorInput = document.getElementById('advisInputNomor');
  const nomor = nomorInput ? nomorInput.value.trim() : '';
  if (!nomor) {
    showToast('Harap masukkan Nomor Surat terlebih dahulu!', 'warning');
    if (nomorInput) nomorInput.focus();
    switchAdvisModalTab('form');
    return;
  }

  const activeItems = advisDebiturList.filter(item => (item.nama && item.nama.trim()) || (item.nominal && item.nominal > 0));
  if (activeItems.length === 0) {
    showToast('Masukkan minimal 1 data debitur untuk mencetak Advis LMAP!', 'warning');
    return;
  }

  isDownloadingAdvisPdf = true;
  const btnDlPdf = document.getElementById('btnDownloadAdvisPdf');
  const originalBtnHtml = btnDlPdf ? btnDlPdf.innerHTML : '';
  if (btnDlPdf) {
    btnDlPdf.disabled = true;
    btnDlPdf.classList.add('opacity-75', 'cursor-not-allowed');
    btnDlPdf.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-sm"></i> <span>Mengunduh...</span>';
  }

  // 1. Pindahkan ke tab pratinjau agar dokumen aktif dan ter-render sempurna di DOM
  switchAdvisModalTab('preview');
  updateAdvisPreview();

  const element = document.getElementById('advisDocumentSheet');
  if (!element) {
    isDownloadingAdvisPdf = false;
    if (btnDlPdf) {
      btnDlPdf.disabled = false;
      btnDlPdf.classList.remove('opacity-75', 'cursor-not-allowed');
      btnDlPdf.innerHTML = originalBtnHtml;
    }
    return;
  }

  // 2. Tunggu gambar (logo Mandiri dan tanda tangan) selesai dimuat sepenuhnya
  const imgs = Array.from(element.querySelectorAll('img'));
  await Promise.all(imgs.map(img => {
    if (img.complete && img.naturalHeight !== 0) return Promise.resolve();
    return new Promise(resolve => {
      img.onload = resolve;
      img.onerror = resolve;
      setTimeout(resolve, 200);
    });
  }));

  // 3. Reset scroll container modal agar posisi render tepat
  const modalScroll = element.closest('.overflow-y-auto') || document.querySelector('#modalCetakAdvis .overflow-y-auto');
  if (modalScroll) modalScroll.scrollTop = 0;

  showToast('Membuat dokumen PDF Advis LMAP...', 'info');

  // 4. Simpan style & class asli untuk dikembalikan setelah ekspor
  const originalStyle = element.getAttribute('style') || '';
  const originalClasses = element.className;

  element.style.width = '794px';
  element.style.minWidth = '794px';
  element.style.maxWidth = '794px';
  element.style.minHeight = 'auto';
  element.style.boxShadow = 'none';
  element.style.border = 'none';
  element.classList.remove('shadow-xl', 'border', 'border-slate-300');

  // Export an independent sheet so the split pane cannot clip the PDF canvas.
  const exportHost = document.createElement('div');
  const exportSheet = element.cloneNode(true);
  exportSheet.removeAttribute('id');
  exportSheet.style.margin = '0';
  exportSheet.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
  exportHost.appendChild(exportSheet);
  document.body.appendChild(exportHost);

  const opt = {
    margin: [0, 0, 0, 0], // A4 sheet already includes document padding
    filename: 'Advis LMAP.pdf',
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      logging: false,
      scrollX: 0,
      scrollY: 0
    },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  try {
    if (typeof html2pdf !== 'undefined') {
      await html2pdf().set(opt).from(exportSheet).save();
      showToast('Dokumen PDF "Advis LMAP" berhasil diunduh!', 'success');
    } else {
      printAdvisDocument();
    }
  } catch (err) {
    console.error('Error generating PDF:', err);
    showToast('Gagal membuat PDF otomatis, beralih ke dialog cetak browser...', 'warning');
    printAdvisDocument();
  } finally {
    exportHost.remove();
    element.setAttribute('style', originalStyle);
    element.className = originalClasses;
    isDownloadingAdvisPdf = false;
    if (btnDlPdf) {
      btnDlPdf.disabled = false;
      btnDlPdf.classList.remove('opacity-75', 'cursor-not-allowed');
      btnDlPdf.innerHTML = originalBtnHtml;
    }
  }
}
window.downloadAdvisPdf = downloadAdvisPdf;

// ================= CETAK / PRINT DOKUMEN BROWSER =================
function printAdvisDocument() {
  const nomorInput = document.getElementById('advisInputNomor');
  const nomor = nomorInput ? nomorInput.value.trim() : '';
  if (!nomor) {
    showToast('Harap masukkan Nomor Surat terlebih dahulu!', 'warning');
    if (nomorInput) nomorInput.focus();
    switchAdvisModalTab('form');
    return;
  }

  const activeItems = advisDebiturList.filter(item => (item.nama && item.nama.trim()) || (item.nominal && item.nominal > 0));
  if (activeItems.length === 0) {
    showToast('Masukkan minimal 1 data debitur untuk mencetak Advis LMAP!', 'warning');
    return;
  }

  updateAdvisPreview();

  const element = document.getElementById('advisDocumentSheet');
  if (!element) return;
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    showToast('Izinkan pop-up untuk mencetak Advis.', 'warning');
    return;
  }
  printWindow.document.write('<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Advis LMAP</title><style>body{margin:0}*{box-sizing:border-box}table{border-collapse:collapse}img{max-width:100%}#advisDocumentSheet{min-height:296mm!important;box-shadow:none!important;border:0!important;margin:0!important}@page{size:A4;margin:0}</style></head><body>' + element.outerHTML + '</body></html>');
  printWindow.document.close();
  Promise.all(Array.from(printWindow.document.images).map(img => img.decode().catch(() => {})))
    .then(() => { if (!printWindow.closed) { printWindow.focus(); printWindow.print(); } });
}
window.printAdvisDocument = printAdvisDocument;





function getInitials(name) {
  if (!name) return 'NS';
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'NS';
}
window.getInitials = getInitials;

// ================= TAB 3: MASTER DATABASE NASABAH PENCAIRAN (BOOKING) =================
let dbBooking = [];
let currentBookingSearch = '';
let currentBookingFilterJenis = 'all';
let currentBookingFilterPencairan = 'all';
let currentBookingFilterJaminan = 'all';
let currentBookingView = 'cards';
let currentBookingPage = 1;
const bookingPageSize = 24;
let currentActiveBooking = null;
let pendingImportBookingData = [];

const BOOKING_STORAGE_KEY = 'portal_mandiri_booking_v1';

function loadBookingDatabase() {
  try {
    const raw = localStorage.getItem(BOOKING_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && Array.isArray(parsed) && parsed.length > 0) {
      dbBooking = parsed;
    } else if (window.MANDIRI_BOOKING_DATA && window.MANDIRI_BOOKING_DATA.length > 0) {
      dbBooking = [...window.MANDIRI_BOOKING_DATA];
    }
  } catch (e) {
    console.error('Error loading booking database:', e);
    if (window.MANDIRI_BOOKING_DATA) {
      dbBooking = [...window.MANDIRI_BOOKING_DATA];
    }
  }
}

function saveBookingDatabase() {
  try {
    // Only save if reasonable size to avoid localStorage quota crash
    const str = JSON.stringify(dbBooking);
    if (str.length < 4500000) {
      localStorage.setItem(BOOKING_STORAGE_KEY, str);
    }
  } catch (e) {
    console.warn('LocalStorage quota exceeded for booking database, keeping in-memory:', e);
  }
}

function updateBookingTabBadge() {
  const badge = document.getElementById('tabBadgeBookingCount');
  if (badge) {
    badge.textContent = dbBooking.length.toLocaleString('id-ID');
  }
}

function setupBookingEventListeners() {
  // Drag & drop for Booking Excel upload
  const dropZone = document.getElementById('dropZoneBooking');
  const fileInput = document.getElementById('excelFileBookingInput');

  if (dropZone && fileInput) {
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleBookingExcelUpload(e.target.files[0]);
      }
    });

    ['dragenter', 'dragover'].forEach(name => {
      dropZone.addEventListener(name, (e) => {
        e.preventDefault();
        dropZone.classList.add('border-emerald-500', 'bg-emerald-50/50');
      });
    });

    ['dragleave', 'drop'].forEach(name => {
      dropZone.addEventListener(name, (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-emerald-500', 'bg-emerald-50/50');
      });
    });

    dropZone.addEventListener('drop', (e) => {
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleBookingExcelUpload(e.dataTransfer.files[0]);
      }
    });
  }
}

function updateBookingUI() {
  updateBookingTabBadge();
  updateBookingDashboardStats();
  renderBookingContent();
}
window.updateBookingUI = updateBookingUI;

function updateBookingDashboardStats() {
  const totalDebitur = dbBooking.length;
  let totalFasilitas = 0;
  let totalLimit = 0;
  let multiCount = 0;
  let kurCount = 0;
  let kumCount = 0;

  dbBooking.forEach(deb => {
    const facCount = (deb.fasilitas && deb.fasilitas.length) || 1;
    totalFasilitas += facCount;
    if (facCount > 1) multiCount++;

    (deb.fasilitas || []).forEach(f => {
      totalLimit += (f.limit || 0);
      const jk = (f.jenisKredit || '').toUpperCase();
      if (jk === 'KUR') kurCount++;
      else if (jk.startsWith('KUM')) kumCount++;
    });
  });

  const elTotalDeb = document.getElementById('statBookingTotalDebitur');
  if (elTotalDeb) elTotalDeb.textContent = totalDebitur.toLocaleString('id-ID');

  const elTotalFac = document.getElementById('statBookingTotalFasilitas');
  if (elTotalFac) elTotalFac.textContent = `${totalFasilitas.toLocaleString('id-ID')}x`;

  const elTotalLimit = document.getElementById('statBookingTotalLimit');
  if (elTotalLimit) {
    if (totalLimit >= 1000000000) {
      elTotalLimit.textContent = `Rp ${(totalLimit / 1000000000).toFixed(1).replace('.', ',')} M`;
    } else {
      elTotalLimit.textContent = formatRupiah(totalLimit);
    }
  }

  const elMulti = document.getElementById('statBookingMultiCount');
  if (elMulti) elMulti.textContent = `${multiCount.toLocaleString('id-ID')} nasabah`;

  const elKur = document.getElementById('statBookingKurCount');
  if (elKur) elKur.textContent = kurCount.toLocaleString('id-ID');

  const elKum = document.getElementById('statBookingKumCount');
  if (elKum) elKum.textContent = kumCount.toLocaleString('id-ID');
}

function getFilteredBookingData() {
  const q = currentBookingSearch.toLowerCase().trim();

  return dbBooking.filter(deb => {
    // 1. Text Search
    if (q) {
      const matchNama = (deb.nama || '').toLowerCase().includes(q);
      const matchKtp = (deb.ktp || '').toLowerCase().includes(q);
      const matchCif = (deb.cif || '').toLowerCase().includes(q);
      const matchUsaha = (deb.usaha || deb.namaPerusahaan || '').toLowerCase().includes(q);
      const matchAlamat = (deb.alamatUsaha || deb.alamat || '').toLowerCase().includes(q);
      const matchPasangan = (deb.namaPasangan || '').toLowerCase().includes(q);
      const matchIbu = (deb.ibuKandung || '').toLowerCase().includes(q);
      const matchTelp = (deb.telp || '').includes(q);

      if (!matchNama && !matchKtp && !matchCif && !matchUsaha && !matchAlamat && !matchPasangan && !matchIbu && !matchTelp) {
        return false;
      }
    }

    // 2. Filter Jenis Kredit
    if (currentBookingFilterJenis !== 'all') {
      const hasJenis = (deb.fasilitas || []).some(f => {
        const jk = (f.jenisKredit || '').toUpperCase();
        if (currentBookingFilterJenis === 'KUR') return jk === 'KUR';
        if (currentBookingFilterJenis === 'KUM') return jk.startsWith('KUM');
        if (currentBookingFilterJenis === 'KSM') return jk.includes('KSM');
        if (currentBookingFilterJenis === 'KTA') return jk.includes('KTA');
        return jk.includes(currentBookingFilterJenis.toUpperCase());
      });
      if (!hasJenis) return false;
    }

    // 3. Filter Multi Pencairan
    if (currentBookingFilterPencairan !== 'all') {
      const facCount = (deb.fasilitas && deb.fasilitas.length) || 1;
      if (currentBookingFilterPencairan === 'multi' && facCount < 2) return false;
      if (currentBookingFilterPencairan === 'single' && facCount !== 1) return false;
    }

    // 4. Filter Jaminan
    if (currentBookingFilterJaminan !== 'all') {
      const hasJaminan = (deb.fasilitas || []).some(f => {
        const jd = (f.jenisDokumen || f.jaminanUtama || '').toUpperCase();
        if (currentBookingFilterJaminan === 'BPKB') return jd.includes('BPKB');
        if (currentBookingFilterJaminan === 'SHM') return jd.includes('SHM') || jd.includes('SHGB') || jd.includes('AJB');
        if (currentBookingFilterJaminan === 'TANPA') return jd.includes('TANPA') || jd === '' || jd === '-';
        return jd.includes(currentBookingFilterJaminan.toUpperCase());
      });
      if (!hasJaminan) return false;
    }

    return true;
  });
}

function renderBookingContent() {
  const filtered = getFilteredBookingData();
  const totalFiltered = filtered.length;

  const countBadge = document.getElementById('badgeBookingResultCount');
  if (countBadge) countBadge.textContent = `${totalFiltered.toLocaleString('id-ID')} debitur`;

  const totalPages = Math.ceil(totalFiltered / bookingPageSize) || 1;
  if (currentBookingPage > totalPages) currentBookingPage = totalPages;
  const start = (currentBookingPage - 1) * bookingPageSize;
  const paged = filtered.slice(start, start + bookingPageSize);

  const containerCards = document.getElementById('bookingCardsViewContainer');
  const containerTable = document.getElementById('bookingTableViewContainer');

  if (currentBookingView === 'cards') {
    if (containerCards) {
      containerCards.classList.remove('hidden');
      renderBookingCards(paged);
    }
    if (containerTable) containerTable.classList.add('hidden');
  } else {
    if (containerCards) containerCards.classList.add('hidden');
    if (containerTable) {
      containerTable.classList.remove('hidden');
      renderBookingTable(paged, start);
    }
  }

  renderBookingPagination(totalFiltered, start + 1, Math.min(start + bookingPageSize, totalFiltered), totalPages);
}

function renderBookingCards(items) {
  const container = document.getElementById('bookingCardsViewContainer');
  if (!container) return;

  if (items.length === 0) {
    container.innerHTML = `
      <div class="col-span-full p-12 text-center bg-white rounded-3xl border border-slate-200">
        <i class="fa-solid fa-folder-open text-4xl text-slate-300 mb-3 block"></i>
        <h3 class="text-base font-bold text-slate-700">Tidak ada debitur yang cocok</h3>
        <p class="text-xs text-slate-400 mt-1">Coba gunakan kata kunci lain atau reset filter pencarian.</p>
        <button onclick="clearBookingSearch()" class="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 transition">
          Reset Filter & Pencarian
        </button>
      </div>
    `;
    return;
  }

  const avatarGradients = [
    'from-emerald-600 to-teal-700',
    'from-blue-600 to-indigo-700',
    'from-indigo-600 to-purple-700',
    'from-amber-500 to-orange-600',
    'from-cyan-600 to-blue-700',
    'from-rose-500 to-pink-600'
  ];

  container.innerHTML = items.map((deb, idx) => {
    const initials = getInitials(deb.nama);
    const grad = avatarGradients[idx % avatarGradients.length];
    const facCount = (deb.fasilitas && deb.fasilitas.length) || 1;
    const lastFac = deb.fasilitasTerakhir || (deb.fasilitas && deb.fasilitas[deb.fasilitas.length - 1]) || {};
    const totalPlafon = deb.totalLimit || lastFac.limit || 0;

    let multiBadge = '';
    if (facCount > 1) {
      multiBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 flex items-center space-x-1 shrink-0">
        <i class="fa-solid fa-repeat text-[9px]"></i>
        <span>${facCount}x Pencairan</span>
      </span>`;
    } else {
      multiBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
        1x Booking
      </span>`;
    }

    const telpClean = (deb.telp || '').replace(/[^0-9]/g, '');
    let waButton = '';
    if (telpClean && telpClean.length >= 8) {
      const waNumber = telpClean.startsWith('0') ? '62' + telpClean.slice(1) : telpClean;
      waButton = `
        <a href="https://wa.me/${waNumber}" target="_blank" onclick="event.stopPropagation()" class="text-emerald-600 hover:text-emerald-800 p-1.5 rounded-lg hover:bg-emerald-50 transition" title="Kirim WhatsApp">
          <i class="fa-brands fa-whatsapp text-sm"></i>
        </a>
      `;
    }

    const jaminanText = lastFac.jenisDokumen || (lastFac.jaminanUtama ? 'Agunan Usaha' : 'Tanpa Agunan');

    return `
      <div class="bg-white rounded-2xl border border-slate-200 hover:border-mandiri-blue hover:shadow-card-hover transition-all duration-200 p-4 flex flex-col justify-between group cursor-pointer" onclick="openModalDetailBooking('${escapeHtml(deb.id)}')">
        
        <!-- Card Top Header -->
        <div>
          <div class="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
            <div class="flex items-center space-x-3 min-w-0">
              <div class="w-10 h-10 rounded-xl bg-gradient-to-br ${grad} text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-xs">
                ${initials}
              </div>
              <div class="min-w-0">
                <h4 class="font-bold text-slate-900 text-sm group-hover:text-mandiri-blue transition truncate">
                  ${escapeHtml(deb.nama)}
                </h4>
                <div class="flex items-center space-x-1.5 text-[11px] text-slate-500 font-mono mt-0.5">
                  <span>CIF: ${escapeHtml(deb.cif || '-')}</span>
                  ${deb.ktp ? `<span>&bull; KTP: ${escapeHtml(deb.ktp.slice(0, 6))}...</span>` : ''}
                </div>
              </div>
            </div>
            ${multiBadge}
          </div>

          <!-- Card Body: Profil Usaha & Keluarga -->
          <div class="py-3 space-y-2 text-xs text-slate-600">
            
            <!-- Usaha -->
            <div class="flex items-start space-x-2">
              <i class="fa-solid fa-shop text-slate-400 mt-0.5 text-xs shrink-0 w-3.5 text-center"></i>
              <div class="min-w-0 flex-1">
                <span class="font-semibold text-slate-800 truncate block">${escapeHtml(deb.usaha || deb.pekerjaan || 'Usaha Perdagangan')}</span>
                <span class="text-[11px] text-slate-400 truncate block">${escapeHtml(deb.alamatUsaha || deb.alamat || '-')}</span>
              </div>
            </div>

            <!-- Pasangan & Ibu Kandung -->
            <div class="flex items-center space-x-2 text-[11px] text-slate-500 bg-slate-50 p-2 rounded-xl">
              <i class="fa-solid fa-people-roof text-slate-400 shrink-0"></i>
              <div class="truncate flex-1">
                <span>Pasangan: <b class="text-slate-700">${escapeHtml(deb.namaPasangan || '-')}</b></span>
                <span class="mx-1">&bull;</span>
                <span>Ibu: <b class="text-slate-700">${escapeHtml(deb.ibuKandung || '-')}</b></span>
              </div>
            </div>

            <!-- Fasilitas Terakhir Box -->
            <div class="mt-2.5 p-2.5 rounded-xl bg-blue-50/60 border border-blue-100 flex items-center justify-between">
              <div>
                <span class="text-[10px] text-blue-700 font-bold block uppercase tracking-wider">
                  ${escapeHtml(lastFac.jenisKredit || 'Fasilitas Kredit')} &bull; ${lastFac.tglPk || 'Pencairan'}
                </span>
                <span class="text-xs font-black text-mandiri-navy">
                  ${formatRupiah(lastFac.limit || 0)}
                </span>
              </div>
              <div class="text-right text-[11px]">
                <span class="px-2 py-0.5 bg-white rounded-md text-slate-700 font-bold border border-slate-200">
                  ${escapeHtml(jaminanText)}
                </span>
              </div>
            </div>

          </div>
        </div>

        <!-- Card Footer -->
        <div class="pt-2.5 border-t border-slate-100 flex items-center justify-between">
          <div class="flex items-center space-x-1.5">
            ${waButton}
            <span class="text-[11px] font-mono text-slate-500 truncate max-w-[120px]">${escapeHtml(deb.telp || '-')}</span>
          </div>
          <button class="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-mandiri-blue hover:text-white text-slate-700 font-bold text-xs transition flex items-center space-x-1">
            <span>Rincian & Riwayat</span>
            <i class="fa-solid fa-chevron-right text-[10px]"></i>
          </button>
        </div>

      </div>
    `;
  }).join('');
}

function renderBookingTable(items, startIdx) {
  const tbody = document.getElementById('bookingTableBody');
  if (!tbody) return;

  if (items.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="p-8 text-center text-slate-400">
          <i class="fa-solid fa-folder-open text-3xl mb-2 block"></i>
          Tidak ada data nasabah yang sesuai kriteria filter.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = items.map((deb, idx) => {
    const facCount = (deb.fasilitas && deb.fasilitas.length) || 1;
    const lastFac = deb.fasilitasTerakhir || (deb.fasilitas && deb.fasilitas[deb.fasilitas.length - 1]) || {};
    const totalPlafon = deb.totalLimit || lastFac.limit || 0;
    const jaminanText = lastFac.jenisDokumen || (lastFac.jaminanUtama ? 'Agunan Usaha' : 'Tanpa Agunan');

    let badgePencairan = '';
    if (facCount > 1) {
      badgePencairan = `<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300 whitespace-nowrap">${facCount}x Top Up</span>`;
    } else {
      badgePencairan = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 whitespace-nowrap">1x</span>`;
    }

    return `
      <tr class="hover:bg-slate-50 transition cursor-pointer" onclick="openModalDetailBooking('${escapeHtml(deb.id)}')">
        <td class="p-3 text-center text-slate-400 font-bold">${startIdx + idx + 1}</td>
        <td class="p-3">
          <div class="font-bold text-slate-900 group-hover:text-mandiri-blue">${escapeHtml(deb.nama)}</div>
          <div class="text-[11px] text-slate-400">${escapeHtml(deb.pekerjaan || '-')}</div>
        </td>
        <td class="p-3 font-mono text-xs">
          <div class="font-bold text-slate-800">${escapeHtml(deb.cif || '-')}</div>
          <div class="text-[11px] text-slate-400">${escapeHtml(deb.ktp || '-')}</div>
        </td>
        <td class="p-3">
          <div class="font-semibold text-slate-800 truncate max-w-[160px]">${escapeHtml(deb.usaha || '-')}</div>
          <div class="text-[11px] text-slate-400 truncate max-w-[180px]">${escapeHtml(deb.alamatUsaha || deb.alamat || '-')}</div>
        </td>
        <td class="p-3">
          <span class="px-2 py-0.5 rounded-md font-bold text-[11px] bg-slate-100 text-slate-700 border border-slate-200">
            ${escapeHtml(jaminanText)}
          </span>
        </td>
        <td class="p-3 text-center">${badgePencairan}</td>
        <td class="p-3 text-xs">
          <div class="font-bold text-slate-800">${escapeHtml(lastFac.jenisKredit || 'Kredit')}</div>
          <div class="text-[11px] text-slate-400">${escapeHtml(lastFac.tglPk || '-')} &bull; ${lastFac.jkWaktu || 0} Bln</div>
        </td>
        <td class="p-3 text-right font-mono font-black text-mandiri-navy">
          ${formatRupiah(totalPlafon)}
        </td>
        <td class="p-3 text-center" onclick="event.stopPropagation()">
          <button onclick="openModalDetailBooking('${escapeHtml(deb.id)}')" class="px-2.5 py-1 rounded-lg bg-blue-50 text-mandiri-blue hover:bg-mandiri-blue hover:text-white font-bold text-xs transition">
            Lihat
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function renderBookingPagination(totalFiltered, startIdx, endIdx, totalPages) {
  const info = document.getElementById('bookingPaginationInfo');
  if (info) {
    if (totalFiltered === 0) {
      info.textContent = 'Menampilkan 0 nasabah';
    } else {
      info.textContent = `Menampilkan ${startIdx} - ${endIdx} dari ${totalFiltered.toLocaleString('id-ID')} nasabah`;
    }
  }

  const container = document.getElementById('bookingPaginationButtons');
  if (!container) return;

  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  let html = '';
  // Prev button
  html += `
    <button onclick="changeBookingPage(${currentBookingPage - 1})" ${currentBookingPage === 1 ? 'disabled class="px-2 py-1 border rounded bg-slate-100 text-slate-300 cursor-not-allowed"' : 'class="px-2 py-1 border border-slate-200 rounded bg-white hover:bg-slate-50 text-slate-600 font-bold"'}>
      <i class="fa-solid fa-chevron-left text-xs"></i>
    </button>
  `;

  // Page numbers (max 5 page numbers centered around current)
  const maxButtons = 5;
  let startP = Math.max(1, currentBookingPage - Math.floor(maxButtons / 2));
  let endP = Math.min(totalPages, startP + maxButtons - 1);
  if (endP - startP + 1 < maxButtons) {
    startP = Math.max(1, endP - maxButtons + 1);
  }

  for (let p = startP; p <= endP; p++) {
    if (p === currentBookingPage) {
      html += `<button class="px-3 py-1 rounded-lg bg-mandiri-navy text-white font-bold text-xs shadow-xs">${p}</button>`;
    } else {
      html += `<button onclick="changeBookingPage(${p})" class="px-3 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs">${p}</button>`;
    }
  }

  // Next button
  html += `
    <button onclick="changeBookingPage(${currentBookingPage + 1})" ${currentBookingPage === totalPages ? 'disabled class="px-2 py-1 border rounded bg-slate-100 text-slate-300 cursor-not-allowed"' : 'class="px-2 py-1 border border-slate-200 rounded bg-white hover:bg-slate-50 text-slate-600 font-bold"'}>
      <i class="fa-solid fa-chevron-right text-xs"></i>
    </button>
  `;

  container.innerHTML = html;
}

function changeBookingPage(page) {
  currentBookingPage = page;
  renderBookingContent();
  const el = document.getElementById('viewBookingTab');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
window.changeBookingPage = changeBookingPage;

function setBookingView(view) {
  currentBookingView = view;
  const btnCards = document.getElementById('btnViewBookingCards');
  const btnTable = document.getElementById('btnViewBookingTable');

  if (view === 'cards') {
    if (btnCards) btnCards.className = 'p-2 rounded-lg bg-mandiri-navy text-white text-xs shadow-xs';
    if (btnTable) btnTable.className = 'p-2 rounded-lg bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 text-xs shadow-xs ml-1';
  } else {
    if (btnCards) btnCards.className = 'p-2 rounded-lg bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 text-xs shadow-xs';
    if (btnTable) btnTable.className = 'p-2 rounded-lg bg-mandiri-navy text-white text-xs shadow-xs ml-1';
  }
  renderBookingContent();
}
window.setBookingView = setBookingView;

function handleBookingSearchInput(val) {
  currentBookingSearch = val;
  currentBookingPage = 1;
  const btnClear = document.getElementById('btnClearSearchBooking');
  if (btnClear) {
    if (val) btnClear.classList.remove('hidden');
    else btnClear.classList.add('hidden');
  }
  renderBookingContent();
}
window.handleBookingSearchInput = handleBookingSearchInput;

function clearBookingSearch() {
  currentBookingSearch = '';
  currentBookingFilterJenis = 'all';
  currentBookingFilterPencairan = 'all';
  currentBookingFilterJaminan = 'all';
  currentBookingPage = 1;

  const input = document.getElementById('searchBookingInput');
  if (input) input.value = '';

  const btnClear = document.getElementById('btnClearSearchBooking');
  if (btnClear) btnClear.classList.add('hidden');

  const selJenis = document.getElementById('filterBookingJenisKredit');
  if (selJenis) selJenis.value = 'all';

  const selPencairan = document.getElementById('filterBookingPencairanCount');
  if (selPencairan) selPencairan.value = 'all';

  const selJaminan = document.getElementById('filterBookingJaminan');
  if (selJaminan) selJaminan.value = 'all';

  renderBookingContent();
}
window.clearBookingSearch = clearBookingSearch;

function handleBookingFilterChange() {
  const selJenis = document.getElementById('filterBookingJenisKredit');
  if (selJenis) currentBookingFilterJenis = selJenis.value;

  const selPencairan = document.getElementById('filterBookingPencairanCount');
  if (selPencairan) currentBookingFilterPencairan = selPencairan.value;

  const selJaminan = document.getElementById('filterBookingJaminan');
  if (selJaminan) currentBookingFilterJaminan = selJaminan.value;

  currentBookingPage = 1;
  renderBookingContent();
}
window.handleBookingFilterChange = handleBookingFilterChange;

function filterBookingByJenis(jenis) {
  currentBookingFilterJenis = jenis;
  const sel = document.getElementById('filterBookingJenisKredit');
  if (sel) sel.value = jenis;
  currentBookingPage = 1;
  renderBookingContent();
}
window.filterBookingByJenis = filterBookingByJenis;

function filterBookingByPencairan(type) {
  currentBookingFilterPencairan = type;
  const sel = document.getElementById('filterBookingPencairanCount');
  if (sel) sel.value = type;
  currentBookingPage = 1;
  renderBookingContent();
}
window.filterBookingByPencairan = filterBookingByPencairan;

// ================= MODAL DETAIL PROFIL & RIWAYAT PENCAIRAN =================
function openModalDetailBooking(id) {
  const deb = dbBooking.find(x => x.id === id);
  if (!deb) {
    showToast('Data debitur tidak ditemukan!', 'error');
    return;
  }
  currentActiveBooking = deb;

  // Avatar & Header
  const avatar = document.getElementById('modalBookingAvatar');
  if (avatar) avatar.textContent = getInitials(deb.nama);

  const elNama = document.getElementById('modalBookingNama');
  if (elNama) elNama.textContent = deb.nama;

  const facCount = (deb.fasilitas && deb.fasilitas.length) || 1;
  const badgePencairan = document.getElementById('modalBookingPencairanBadge');
  if (badgePencairan) {
    if (facCount > 1) {
      badgePencairan.textContent = `${facCount}x Pencairan (Top Up / Refill)`;
      badgePencairan.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950';
    } else {
      badgePencairan.textContent = '1x Pencairan';
      badgePencairan.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-400 text-emerald-950';
    }
  }

  const badgeCif = document.getElementById('modalBookingCifBadge');
  if (badgeCif) badgeCif.textContent = `CIF: ${deb.cif || '-'}`;

  // Quick action bar contacts
  const telpText = document.getElementById('modalBookingTelpText');
  if (telpText) telpText.textContent = deb.telp || '-';

  const telpClean = (deb.telp || '').replace(/[^0-9]/g, '');
  const btnWa = document.getElementById('btnBookingWa');
  if (btnWa) {
    if (telpClean && telpClean.length >= 8) {
      const waNumber = telpClean.startsWith('0') ? '62' + telpClean.slice(1) : telpClean;
      btnWa.href = `https://wa.me/${waNumber}?text=Halo%20Bapak%2FIbu%20${encodeURIComponent(deb.nama)}%2C%20kami%20dari%20Bank%20Mandiri...`;
      btnWa.classList.remove('hidden');
    } else {
      btnWa.classList.add('hidden');
    }
  }

  const btnCall = document.getElementById('btnBookingCall');
  if (btnCall) {
    if (telpClean && telpClean.length >= 8) {
      btnCall.href = `tel:${telpClean}`;
      btnCall.classList.remove('hidden');
    } else {
      btnCall.classList.add('hidden');
    }
  }

  // Identitas Pribadi
  const elKtp = document.getElementById('modalBookingKtp');
  if (elKtp) elKtp.textContent = deb.ktp || '-';

  const elTtl = document.getElementById('modalBookingTtl');
  if (elTtl) {
    const tempat = deb.tempatLahir ? deb.tempatLahir + ', ' : '';
    const tgl = deb.tglLahir || '-';
    const umur = deb.umur ? ` (${deb.umur} thn)` : '';
    elTtl.textContent = `${tempat}${tgl}${umur}`;
  }

  const elPekerjaan = document.getElementById('modalBookingPekerjaan');
  if (elPekerjaan) elPekerjaan.textContent = deb.pekerjaan || '-';

  const elAlamat = document.getElementById('modalBookingAlamat');
  if (elAlamat) {
    const parts = [deb.alamat, deb.kelurahan, deb.kecamatan, deb.kota, deb.kodePos].filter(Boolean);
    elAlamat.textContent = parts.length > 0 ? parts.join(', ') : '-';
  }

  // Keluarga & Pasangan
  const elIbu = document.getElementById('modalBookingIbuKandung');
  if (elIbu) elIbu.textContent = deb.ibuKandung || '-';

  const elPasangan = document.getElementById('modalBookingNamaPasangan');
  if (elPasangan) elPasangan.textContent = deb.namaPasangan || '-';

  const elKtpPasangan = document.getElementById('modalBookingKtpPasangan');
  if (elKtpPasangan) elKtpPasangan.textContent = deb.ktpPasangan || '-';

  const elPekerjaanPasangan = document.getElementById('modalBookingPekerjaanPasangan');
  if (elPekerjaanPasangan) elPekerjaanPasangan.textContent = deb.pekerjaanPasangan || '-';

  // Profil Usaha
  const elUsaha = document.getElementById('modalBookingUsaha');
  if (elUsaha) elUsaha.textContent = deb.usaha || '-';

  const elPerusahaan = document.getElementById('modalBookingPerusahaan');
  if (elPerusahaan) elPerusahaan.textContent = deb.namaPerusahaan || '-';

  const elAlamatUsaha = document.getElementById('modalBookingAlamatUsaha');
  if (elAlamatUsaha) elAlamatUsaha.textContent = deb.alamatUsaha || '-';

  // Rekening Bank Mandiri
  const elCif = document.getElementById('modalBookingCIF');
  if (elCif) elCif.textContent = deb.cif || '-';

  const lastFac = deb.fasilitasTerakhir || (deb.fasilitas && deb.fasilitas[deb.fasilitas.length - 1]) || {};
  const elRekPjm = document.getElementById('modalBookingRekPjm');
  if (elRekPjm) elRekPjm.textContent = lastFac.rekPjm || '-';

  const elRekTab = document.getElementById('modalBookingRekTab');
  if (elRekTab) elRekTab.textContent = lastFac.rekTab || '-';

  // Akumulasi Total Plafon Limit
  const elTotalLimitBadge = document.getElementById('modalBookingTotalLimitBadge');
  if (elTotalLimitBadge) {
    elTotalLimitBadge.textContent = `Total Akumulasi Plafon: ${formatRupiah(deb.totalLimit || 0)}`;
  }

  // Timeline Riwayat Fasilitas Pencairan
  const timeline = document.getElementById('modalBookingFasilitasTimeline');
  if (timeline) {
    const list = deb.fasilitas || [];
    timeline.innerHTML = list.map((f, idx) => {
      const isFirst = idx === 0;
      const urutanLabel = isFirst 
        ? 'Pencairan Pertama (Fasilitas Awal)' 
        : `Pencairan Ke-${idx + 1} (Fasilitas Top Up / Suplesi)`;
      const headerBg = isFirst 
        ? 'bg-blue-600 text-white' 
        : 'bg-emerald-600 text-white';

      const jaminanDoc = f.jenisDokumen || (f.jaminanUtama ? 'Agunan Fisik' : 'Tanpa Agunan');

      return `
        <div class="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
          
          <!-- Facility Header -->
          <div class="${headerBg} px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center space-x-2">
              <span class="w-6 h-6 rounded-full bg-white/20 text-white font-extrabold flex items-center justify-center text-xs">
                ${idx + 1}
              </span>
              <span class="font-bold text-xs sm:text-sm tracking-wide">
                ${urutanLabel}
              </span>
            </div>
            <div class="flex items-center space-x-2 text-xs">
              <span class="px-2 py-0.5 rounded-md bg-white/20 font-bold">${escapeHtml(f.jenisKredit || 'Kredit')}</span>
              <span class="font-semibold text-blue-100">Tgl PK: <b>${escapeHtml(f.tglPk || '-')}</b></span>
            </div>
          </div>

          <!-- Facility Body -->
          <div class="p-4 space-y-3 text-xs text-slate-700">
            
            <!-- Limit & Angsuran Highlight -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/80">
              <div>
                <span class="text-[10px] text-slate-400 block font-medium">Limit Plafon Pinjaman:</span>
                <span class="text-sm font-black text-mandiri-navy block">${formatRupiah(f.limit || 0)}</span>
              </div>
              <div>
                <span class="text-[10px] text-slate-400 block font-medium">Jangka Waktu (Tenor):</span>
                <span class="text-xs sm:text-sm font-bold text-slate-800 block">${f.jkWaktu || 0} Bulan</span>
              </div>
              <div>
                <span class="text-[10px] text-slate-400 block font-medium">Suku Bunga:</span>
                <span class="text-xs sm:text-sm font-bold text-slate-800 block">${f.bunga ? f.bunga + '% p.a.' : '-'}</span>
              </div>
              <div>
                <span class="text-[10px] text-slate-400 block font-medium">Angsuran per Bulan:</span>
                <span class="text-xs sm:text-sm font-extrabold text-emerald-700 block">${formatRupiah(f.angsuran || 0)}</span>
              </div>
            </div>

            <!-- Detail Agunan / Jaminan pada Pencairan ini -->
            <div class="p-3 rounded-xl bg-amber-50/50 border border-amber-200/80 space-y-1.5">
              <div class="flex items-center justify-between border-b border-amber-200/60 pb-1.5">
                <span class="font-bold text-amber-900 flex items-center space-x-1.5">
                  <i class="fa-solid fa-shield-halved text-xs text-amber-700"></i>
                  <span>Agunan Fasilitas Ini:</span>
                  <span class="px-2 py-0.5 rounded-md bg-amber-200/80 text-amber-950 font-black text-[10px] uppercase">
                    ${escapeHtml(jaminanDoc)}
                  </span>
                </span>
                ${f.hargaTaksasi > 0 ? `<span class="text-[11px] font-bold text-amber-900">Taksasi: ${formatRupiah(f.hargaTaksasi)}</span>` : ''}
              </div>

              ${f.jaminanUtama ? `
                <div class="text-[11px] leading-relaxed text-slate-700">
                  <span class="font-semibold text-slate-800">Jaminan Utama:</span> ${escapeHtml(f.jaminanUtama)}
                </div>
              ` : ''}

              ${f.jaminanTambahan1 && f.jaminanTambahan1 !== '`' ? `
                <div class="text-[11px] leading-relaxed text-slate-700">
                  <span class="font-semibold text-slate-800">Jaminan Tambahan 1:</span> ${escapeHtml(f.jaminanTambahan1)}
                </div>
              ` : ''}

              ${f.jaminanTambahan2 && f.jaminanTambahan2 !== '`' ? `
                <div class="text-[11px] leading-relaxed text-slate-700">
                  <span class="font-semibold text-slate-800">Jaminan Tambahan 2:</span> ${escapeHtml(f.jaminanTambahan2)}
                </div>
              ` : ''}

              ${!f.jaminanUtama && (!f.jaminanTambahan1 || f.jaminanTambahan1 === '`') ? `
                <div class="text-[11px] text-slate-500 italic">
                  Fasilitas Kredit Tanpa Agunan Fisik (KSM / KTA / Pre-Approved).
                </div>
              ` : ''}
            </div>

            <!-- Metadata Fasilitas: No PK, Rekening, Marketing -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-slate-500 pt-1">
              <div>
                <span class="block text-slate-400">Nomor Perjanjian Kredit (PK):</span>
                <span class="font-mono font-semibold text-slate-700 truncate block">${escapeHtml(f.noPk || '-')}</span>
              </div>
              <div>
                <span class="block text-slate-400">Rekening Pinjaman (PJM):</span>
                <span class="font-mono font-semibold text-slate-700 truncate block">${escapeHtml(f.rekPjm || '-')}</span>
              </div>
              <div>
                <span class="block text-slate-400">Marketing Pemroses (MKS):</span>
                <span class="font-semibold text-slate-700 truncate block">${escapeHtml(f.mks || '-')}</span>
              </div>
            </div>

          </div>

        </div>
      `;
    }).join('');
  }

  const modal = document.getElementById('modalDetailBooking');
  if (modal) modal.classList.remove('hidden');
}
window.openModalDetailBooking = openModalDetailBooking;

function closeModalDetailBooking() {
  const modal = document.getElementById('modalDetailBooking');
  if (modal) modal.classList.add('hidden');
  currentActiveBooking = null;
}
window.closeModalDetailBooking = closeModalDetailBooking;

function copyBookingDetails() {
  if (!currentActiveBooking) return;
  const deb = currentActiveBooking;

  let text = `=====================================\n`;
  text += `PROFIL NASABAH PENCAIRAN MANDIRI\n`;
  text += `=====================================\n`;
  text += `Nama Nasabah   : ${deb.nama}\n`;
  text += `CIF            : ${deb.cif || '-'}\n`;
  text += `No. KTP        : ${deb.ktp || '-'}\n`;
  text += `No. Telepon    : ${deb.telp || '-'}\n`;
  text += `Ibu Kandung    : ${deb.ibuKandung || '-'}\n`;
  text += `Nama Pasangan  : ${deb.namaPasangan || '-'}\n`;
  text += `Jenis Usaha    : ${deb.usaha || '-'}\n`;
  text += `Alamat Usaha   : ${deb.alamatUsaha || '-'}\n`;
  text += `Alamat Rumah   : ${deb.alamat || '-'}\n`;
  text += `Total Plafon   : ${formatRupiah(deb.totalLimit || 0)}\n\n`;
  text += `REKAM JEJAK FASILITAS PENCAIRAN (${deb.fasilitas.length}x Pencairan):\n`;

  (deb.fasilitas || []).forEach((f, idx) => {
    text += `\n[Pencairan Ke-${idx + 1}]\n`;
    text += `- Tanggal PK   : ${f.tglPk || '-'}\n`;
    text += `- Jenis Kredit : ${f.jenisKredit || '-'}\n`;
    text += `- Limit Plafon : ${formatRupiah(f.limit || 0)}\n`;
    text += `- Jangka Waktu : ${f.jkWaktu || 0} Bulan\n`;
    text += `- Angsuran/Bln : ${formatRupiah(f.angsuran || 0)}\n`;
    text += `- Jaminan      : ${f.jenisDokumen || f.jaminanUtama || 'Tanpa Agunan'}\n`;
    text += `- No. PK       : ${f.noPk || '-'}\n`;
  });

  navigator.clipboard.writeText(text).then(() => {
    showToast('Profil dan seluruh riwayat pencairan berhasil disalin!', 'success');
  }).catch(() => {
    showToast('Gagal menyalin teks ke clipboard', 'error');
  });
}
window.copyBookingDetails = copyBookingDetails;

// ================= EXPORT BOOKING EXCEL =================
function exportBookingExcel() {
  if (typeof XLSX === 'undefined') {
    showToast('Library Excel belum siap', 'error');
    return;
  }

  showToast('Menyiapkan file Rekap Database Booking...', 'info');

  const filtered = getFilteredBookingData();
  const rows = [
    [
      'NO',
      'NAMA NASABAH',
      'CIF',
      'NO. KTP',
      'NO. TELEPON',
      'JENIS USAHA',
      'ALAMAT USAHA',
      'NAMA PASANGAN',
      'IBU KANDUNG',
      'JML PENCAIRAN',
      'AKUMULASI PLAFON',
      'PENCAIRAN TERAKHIR (TGL)',
      'JENIS KREDIT TERAKHIR',
      'LIMIT TERAKHIR',
      'TENOR (BULAN)',
      'JAMINAN TERAKHIR',
      'ALAMAT TINGGAL'
    ]
  ];

  filtered.forEach((deb, idx) => {
    const lastFac = deb.fasilitasTerakhir || (deb.fasilitas && deb.fasilitas[deb.fasilitas.length - 1]) || {};
    rows.push([
      idx + 1,
      deb.nama,
      deb.cif || '-',
      deb.ktp || '-',
      deb.telp || '-',
      deb.usaha || '-',
      deb.alamatUsaha || '-',
      deb.namaPasangan || '-',
      deb.ibuKandung || '-',
      (deb.fasilitas && deb.fasilitas.length) || 1,
      deb.totalLimit || 0,
      lastFac.tglPk || '-',
      lastFac.jenisKredit || '-',
      lastFac.limit || 0,
      lastFac.jkWaktu || 0,
      lastFac.jenisDokumen || (lastFac.jaminanUtama ? 'Agunan' : 'Tanpa Agunan'),
      deb.alamat || '-'
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Database Booking');

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  XLSX.writeFile(wb, `Mandiri_Database_Booking_${dateStr}.xlsx`);
  showToast('File Excel Database Booking berhasil diunduh!', 'success');
}
window.exportBookingExcel = exportBookingExcel;

// ================= UPLOAD EXCEL BOOKING =================
function openModalUploadBooking() {
  const modal = document.getElementById('modalUploadBooking');
  if (modal) modal.classList.remove('hidden');
  pendingImportBookingData = [];
  const btnProcess = document.getElementById('btnProcessImportBooking');
  if (btnProcess) btnProcess.disabled = true;
  const container = document.getElementById('previewBookingContainer');
  if (container) container.classList.add('hidden');
}
window.openModalUploadBooking = openModalUploadBooking;

function closeModalUploadBooking() {
  const modal = document.getElementById('modalUploadBooking');
  if (modal) modal.classList.add('hidden');
  pendingImportBookingData = [];
}
window.closeModalUploadBooking = closeModalUploadBooking;

function handleBookingExcelUpload(file) {
  if (!file) return;
  if (typeof XLSX === 'undefined') {
    showToast('Library Excel belum dimuat', 'error');
    return;
  }

  showToast(`Membaca file "${file.name}"...`, 'info');
  const reader = new FileReader();

  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

      if (!rawRows || rawRows.length < 2) {
        showToast('File Excel kosong atau format tidak sesuai!', 'error');
        return;
      }

      // Grouping process
      const debiturMap = new Map();
      let currentPeriod = '';

      for (let i = 1; i < rawRows.length; i++) {
        const row = rawRows[i];
        const col0 = String(row[0] || '').trim();
        const col1 = String(row[1] || '').trim();

        if (col0 && !col1 && isNaN(Number(col0))) {
          currentPeriod = col0;
          continue;
        }
        if (col0.toLowerCase().includes('total booking') || col1.toLowerCase().includes('total booking')) {
          continue;
        }
        if (col1 && col1.toUpperCase() !== 'NASABAH' && !col0.toLowerCase().startsWith('total')) {
          const nama = col1;
          const ktp = String(row[2] || '').trim().replace(/'/g, '');
          const cif = String(row[65] || '').trim().replace(/'/g, '');

          const key = cif && cif.length >= 7 
            ? `CIF:${cif}` 
            : (ktp && ktp.length >= 10 ? `KTP:${ktp}` : `NAMA:${nama.toUpperCase()}`);

          const facility = {
            id: `fac-${i}`,
            period: currentPeriod,
            noPk: String(row[27] || '').trim(),
            tglPk: formatBookingDate(row[24]),
            jenisKredit: String(row[22] || '').trim() || 'Kredit',
            tujuanKredit: String(row[21] || '').trim(),
            limit: Math.round(Number(String(row[30] || '').replace(/[^0-9.-]/g, ''))) || 0,
            jkWaktu: Math.round(Number(String(row[32] || '').replace(/[^0-9.-]/g, ''))) || 0,
            bunga: Number(Number(String(row[34] || '').replace(/[^0-9.-]/g, '')).toFixed(2)) || 0,
            angsuran: Math.round(Number(String(row[40] || '').replace(/[^0-9.-]/g, ''))) || 0,
            tglJatuhTempo: formatBookingDate(row[29]),
            rekPjm: String(row[66] || '').trim(),
            rekTab: String(row[67] || '').trim(),
            jaminanUtama: String(row[42] || '').trim(),
            jaminanTambahan1: String(row[43] || '').trim(),
            jaminanTambahan2: String(row[44] || '').trim(),
            jaminanTambahan3: String(row[45] || '').trim(),
            hargaTaksasi: Math.round(Number(String(row[46] || '').replace(/[^0-9.-]/g, ''))) || 0,
            jenisDokumen: String(row[48] || '').trim(),
            alamatUsaha: String(row[49] || '').trim(),
            ijinUsaha: String(row[50] || '').trim(),
            mks: String(row[83] || row[80] || '').trim(),
            keterangan: String(row[89] || row[90] || row[88] || '').trim()
          };

          if (!debiturMap.has(key)) {
            debiturMap.set(key, {
              id: `deb-${debiturMap.size + 1}`,
              key: key,
              nama: nama,
              ktp: ktp,
              tempatLahir: String(row[3] || '').trim(),
              tglLahir: formatBookingDate(row[4]),
              pekerjaan: String(row[6] || '').trim(),
              umur: Math.round(Number(row[7])) || 0,
              namaPerusahaan: String(row[8] || '').trim(),
              alamat: String(row[11] || '').trim(),
              kelurahan: String(row[12] || '').trim(),
              kecamatan: String(row[13] || '').trim(),
              kota: String(row[14] || '').trim(),
              kodePos: String(row[15] || '').trim(),
              telp: String(row[16] || '').trim().replace(/'/g, ''),
              alamatUsaha: String(row[49] || '').trim(),
              usaha: String(row[8] || row[6] || row[21] || '').trim(),
              namaPasangan: String(row[53] || '').trim(),
              ktpPasangan: String(row[54] || '').trim(),
              pekerjaanPasangan: String(row[58] || '').trim(),
              alamatPasangan: String(row[59] || '').trim(),
              cif: cif,
              ibuKandung: String(row[68] || '').trim(),
              fasilitas: [facility]
            });
          } else {
            const existing = debiturMap.get(key);
            if (!existing.telp && row[16]) existing.telp = String(row[16]).trim().replace(/'/g, '');
            if (!existing.namaPasangan && row[53]) existing.namaPasangan = String(row[53]).trim();
            if (!existing.ibuKandung && row[68]) existing.ibuKandung = String(row[68]).trim();
            if (!existing.alamatUsaha && row[49]) existing.alamatUsaha = String(row[49]).trim();
            if (!existing.cif && cif) existing.cif = cif;
            existing.fasilitas.push(facility);
          }
        }
      }

      const parsedList = Array.from(debiturMap.values());
      parsedList.forEach(deb => {
        deb.totalPencairan = deb.fasilitas.length;
        deb.totalLimit = deb.fasilitas.reduce((acc, cur) => acc + (cur.limit || 0), 0);
        deb.fasilitasTerakhir = deb.fasilitas[deb.fasilitas.length - 1];
      });

      if (parsedList.length === 0) {
        showToast('Tidak ada baris debitur yang valid!', 'warning');
        return;
      }

      pendingImportBookingData = parsedList;

      // Show preview
      const previewContainer = document.getElementById('previewBookingContainer');
      const rowCountEl = document.getElementById('previewBookingRowCount');
      const tbody = document.getElementById('previewBookingTableBody');
      const btnProcess = document.getElementById('btnProcessImportBooking');

      if (rowCountEl) rowCountEl.textContent = `${parsedList.length.toLocaleString('id-ID')} debitur terdeteksi`;

      if (tbody) {
        tbody.innerHTML = parsedList.slice(0, 5).map(deb => {
          const lastFac = deb.fasilitasTerakhir || {};
          return `
            <tr>
              <td class="p-2 font-bold text-slate-800">${escapeHtml(deb.nama)}</td>
              <td class="p-2 font-mono">${escapeHtml(deb.cif || '-')}</td>
              <td class="p-2">${escapeHtml(deb.usaha || '-')}</td>
              <td class="p-2">${escapeHtml(lastFac.jenisDokumen || 'Agunan')}</td>
              <td class="p-2 font-bold text-mandiri-navy">${formatRupiah(lastFac.limit || 0)}</td>
              <td class="p-2 text-slate-500">${escapeHtml(lastFac.tglPk || '-')}</td>
            </tr>
          `;
        }).join('');
      }

      if (previewContainer) previewContainer.classList.remove('hidden');
      if (btnProcess) btnProcess.disabled = false;

      showToast(`Berhasil membaca ${parsedList.length} profil debitur!`, 'success');
    } catch (err) {
      console.error('Error parsing booking excel:', err);
      showToast('Gagal memproses file Excel: ' + err.message, 'error');
    }
  };

  reader.readAsArrayBuffer(file);
}
window.handleBookingExcelUpload = handleBookingExcelUpload;

function formatBookingDate(val) {
  if (!val) return '';
  if (typeof val === 'string') {
    const s = val.trim();
    if (s.includes('/') || s.includes('-') || s.includes(' ')) return s;
    const num = Number(s);
    if (!isNaN(num) && num > 20000 && num < 60000) val = num;
    else return s;
  }
  if (typeof val === 'number') {
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
  }
  return String(val);
}

function saveImportedBookingData() {
  if (!pendingImportBookingData || pendingImportBookingData.length === 0) {
    showToast('Tidak ada data booking untuk disimpan!', 'warning');
    return;
  }

  dbBooking = [...pendingImportBookingData];
  saveBookingDatabase();
  closeModalUploadBooking();
  updateBookingUI();
  showToast(`Database Booking berhasil diperbarui dengan ${dbBooking.length} debitur!`, 'success');
}
window.saveImportedBookingData = saveImportedBookingData;
