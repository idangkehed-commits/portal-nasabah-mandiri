const sharedApi = require('./shared-database.cjs')();
const authenticatorGate = require('./authenticator-gate.cjs')();
const securityGuard = require('./security-guard.cjs')(__dirname, 'public');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 3050;
const RENDER_EXTERNAL_URL = process.env.RENDER_EXTERNAL_URL;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.csv': 'text/csv; charset=utf-8'
};

// ============================================================
// DAFTAR FILE SENSITIF YANG TIDAK BOLEH DIAKSES VIA HTTP
// Data nasabah (PII) hanya boleh dimuat dari sisi klien yang sudah
// terautentikasi — tidak boleh dapat di-fetch langsung dari URL.
// ============================================================
const BLOCKED_PATTERNS = [
  /^\/cleaned_leads\.json$/i,
  /^\/data_leads\.js$/i,
  /^\/data_tagihan\.js$/i,
  /^\/data_booking\.js$/i,
  /^\/convert_tagihan\.js$/i,
  /\.json$/i,          // blokir semua .json
  /\.csv$/i,           // blokir data mentah csv
  /\.xlsx?$/i,         // blokir data mentah excel
];

function isBlockedPath(urlPath, req) {
  // Jika di server cloud publik (Render / production / IP luar), blokir mutlak file data nasabah (PII)
  const isCloudDeploy = process.env.RENDER === 'true' || process.env.NODE_ENV === 'production' || !!process.env.RENDER_EXTERNAL_URL;
  const remoteIp = (req && req.socket && req.socket.remoteAddress) || '';
  const isLocalhost = remoteIp.includes('127.0.0.1') || remoteIp.includes('::1') || remoteIp === '';

  // Hanya perbolehkan akses data nasabah jika dijalankan secara lokal di komputer pengguna offline
  if (!isCloudDeploy && isLocalhost) {
    return false;
  }
  if (req?.securityTotpVerified && /^\/data_(?:leads|tagihan|booking)\.js$/i.test(urlPath)) return false;
  return BLOCKED_PATTERNS.some((pattern) => pattern.test(urlPath));
}

const server = http.createServer((req, res) => {
  if (authenticatorGate(req, res)) return;
  if (sharedApi(req, res)) return;
  if (req.securityTotpVerified && req.portalRole === 'viewer') {
    const route = (req.url || '/').split('?')[0];
    if (!['/', '/index.html', '/viewer.html', '/viewer.js', '/icon.svg'].includes(route) || !['GET','HEAD'].includes(req.method)) {
      res.writeHead(403, {'Content-Type':'text/plain; charset=utf-8'});res.end('Akses hanya untuk melihat data.');return;
    }
    if (['/', '/index.html'].includes(route)) req.url = '/viewer.html';
  }
  if (securityGuard(req, res)) return;
  // CORS & Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  let sanitizedUrl = req.url.split('?')[0].split('#')[0];

  // Cegah directory traversal / path manipulation dengan '..'
  if (sanitizedUrl.includes('..')) {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Path Tidak Valid', code: 400 }));
    console.warn(`[SECURITY] Dot-dot traversal attempt: ${sanitizedUrl} dari ${req.headers['x-forwarded-for'] || req.socket.remoteAddress}`);
    return;
  }

  // Health check endpoint (Dipakai untuk Render & Uptime Ping 24 Jam)
  if (sanitizedUrl === '/health' || sanitizedUrl === '/ping') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'Portal Data Nasabah Mandiri',
      uptime_seconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // ----------------------------------------------------------------
  // BLOKIR AKSES LANGSUNG KE FILE DATA NASABAH (PII PROTECTION)
  // ----------------------------------------------------------------
  if (isBlockedPath(sanitizedUrl, req)) {
    res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Akses Ditolak', code: 403 }));
    console.warn(`[SECURITY] Akses ditolak ke file sensitif: ${sanitizedUrl} dari ${req.headers['x-forwarded-for'] || req.socket.remoteAddress}`);
    return;
  }

  if (sanitizedUrl === '/') sanitizedUrl = '/index.html';

  const filePath = path.join(__dirname, sanitizedUrl);

  // ----------------------------------------------------------------
  // PATH TRAVERSAL GUARD
  // Pastikan path yang di-resolve masih di dalam direktori proyek.
  // Cegah serangan seperti: GET /../../../etc/passwd
  // ----------------------------------------------------------------
  if (!filePath.startsWith(__dirname + path.sep) && filePath !== __dirname) {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Path Tidak Valid', code: 400 }));
    console.warn(`[SECURITY] Path traversal attempt: ${sanitizedUrl} dari ${req.headers['x-forwarded-for'] || req.socket.remoteAddress}`);
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      // Fallback ke index.html untuk SPA
      fs.readFile(path.join(__dirname, 'index.html'), (err2, fallback) => {
        if (err2) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('404 Not Found');
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(req.securityTotpVerified ? authorizePage(fallback) : fallback, 'utf-8');
        }
      });
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(req.securityTotpVerified && ext === '.html' ? authorizePage(content) : content, 'utf-8');
    }
  });
});

function authorizePage(content) {
  return content.toString('utf8').replace('<head>', '<head><script>window.__PORTAL_SERVER_AUTHENTICATED__=true;</script>').replace('</body>', '<form method="post" action="/__access/logout" style="position:fixed;bottom:12px;right:12px;z-index:45"><button style="border:1px solid #cbd5e1;border-radius:8px;padding:8px 12px;background:white;color:#12375b">Keluar akses online</button></form></body>');
}

function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name in interfaces) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  return addresses;
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[ERROR] Port ${PORT} sedang digunakan oleh aplikasi lain!`);
    console.error(`Gunakan PORT lain via environment: set PORT=3051 && node server.js`);
  } else {
    console.error('[ERROR] Terjadi kesalahan server:', err.message);
  }
  process.exit(1);
});

server.listen(PORT, '0.0.0.0', () => {
  const ips = getLocalIPs();
  console.log('================================================================');
  console.log('  PORTAL DATA NASABAH (KUR & KUM MANDIRI)');
  console.log('  Status: Siap Online 24 Jam');
  console.log('================================================================');
  console.log(`\n  Port Aktif            : ${PORT}`);
  console.log(`  Akses Komputer Lokal  : http://localhost:${PORT}`);
  if (ips.length > 0) {
    console.log(`  Akses Jaringan WiFi   : http://${ips[0]}:${PORT}`);
  }
  if (RENDER_EXTERNAL_URL) {
    console.log(`  Akses Render Online   : ${RENDER_EXTERNAL_URL}`);
  }
  console.log('================================================================\n');

  // ================= 24/7 AUTO KEEP-ALIVE UNTUK RENDER =================
  // Render Free Tier biasanya 'sleep' jika tidak ada akses selama 15 menit.
  // Script ini otomatis melakukan 'ping' ke diri sendiri setiap 13 menit
  // agar server Render tetap terjaga dan online 24 jam nonstop!
  if (RENDER_EXTERNAL_URL) {
    console.log(`[Keep-Alive 24/7] Mengaktifkan auto-ping ke: ${RENDER_EXTERNAL_URL}/health`);
    setInterval(() => {
      const client = RENDER_EXTERNAL_URL.startsWith('https') ? https : http;
      client.get(`${RENDER_EXTERNAL_URL}/health`, (resp) => {
        console.log(`[Keep-Alive] Ping sukses (Status: ${resp.statusCode}) pada ${new Date().toLocaleTimeString('id-ID')}`);
      }).on('error', (err) => {
        console.warn(`[Keep-Alive Warning]: ${err.message}`);
      });
    }, 13 * 60 * 1000); // 13 menit
  }
});
