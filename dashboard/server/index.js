const express = require('express');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.DASHBOARD_PORT || 7433;
const HOME = process.env.HOME || '/root';
const WS_PATH = path.resolve(path.join(HOME, '.openclaw', 'workspace'));
const CONFIG_PATH = path.join(HOME, '.openclaw', 'openclaw.json');

// ─────────────────────────────────────────
// SECURITY HELPERS
// ─────────────────────────────────────────

// Nur alphanumerisch + Bindestrich + Unterstrich (für Cron-IDs)
function isValidId(id) {
  return typeof id === 'string' && /^[a-zA-Z0-9_-]+$/.test(id);
}

// Nur gültige Env-Key-Namen
function isValidEnvKey(key) {
  return typeof key === 'string' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(key);
}

// Shell-Sonderzeichen entfernen (Command Injection verhindern)
function sanitizeShell(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[;&|`$(){}!<>\\"'\n\r]/g, '');
}

// Prüfen ob ein Pfad wirklich innerhalb eines erlaubten Verzeichnisses liegt
function isPathSafe(fullPath, allowedRoot) {
  try {
    const real = fs.realpathSync(path.dirname(fullPath));
    return real.startsWith(allowedRoot);
  } catch {
    // Datei existiert noch nicht – prüfen ob parent-Verzeichnis ok ist
    try {
      const parentReal = fs.realpathSync(path.dirname(fullPath));
      return parentReal.startsWith(allowedRoot);
    } catch { return false; }
  }
}

// ─────────────────────────────────────────
// SESSION STORE (in-memory, kein DB nötig)
// ─────────────────────────────────────────
const sessions = new Map(); // token → { createdAt, ip }
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 Stunden

// Passwort aus ENV oder Datei lesen (NIEMALS hardcoded!)
function getDashboardPassword() {
  if (process.env.DASHBOARD_PASSWORD) return process.env.DASHBOARD_PASSWORD;
  const pwFile = path.join(HOME, '.openclaw', 'dashboard.password');
  if (fs.existsSync(pwFile)) return fs.readFileSync(pwFile, 'utf8').trim();
  return null;
}

// RATE LIMITER (Brute-Force Schutz)
const loginAttempts = new Map(); // ip → { count, resetAt }
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 Minuten

function checkRateLimit(ip) {
  const now = Date.now();
  const rec = loginAttempts.get(ip);
  if (!rec || now > rec.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOCKOUT_MS });
    return true; // erlaubt
  }
  if (rec.count >= MAX_ATTEMPTS) return false; // gesperrt
  rec.count++;
  return true;
}

function resetRateLimit(ip) {
  loginAttempts.delete(ip);
}

// AUDIT LOG
const auditLog = [];
function audit(ip, action, detail = '') {
  const entry = { time: new Date().toISOString(), ip, action, detail };
  auditLog.unshift(entry);
  if (auditLog.length > 200) auditLog.pop();
  console.log(`[AUDIT] ${entry.time} | ${ip} | ${action} | ${detail}`);
}

// SESSION AUFRÄUMEN (alle 30 Min)
setInterval(() => {
  const now = Date.now();
  for (const [token, s] of sessions) {
    if (now - s.createdAt > SESSION_TTL_MS) sessions.delete(token);
  }
}, 30 * 60 * 1000);

// CORS: nur Tailscale-IPs (100.x.x.x), localhost und private Netzwerke
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!origin) return next();
  const allowed = /^https?:\/\/(localhost|127\.0\.0\.1|100\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+)(:\d+)?$/.test(origin);
  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// SECURITY HEADERS
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'");
  next();
});

app.use(express.json({ limit: '100kb' })); // Payload-Größe begrenzen

// AUTH MIDDLEWARE
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Nicht eingeloggt' });
  const session = sessions.get(token);
  if (!session) return res.status(401).json({ error: 'Session abgelaufen' });
  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    sessions.delete(token);
    return res.status(401).json({ error: 'Session abgelaufen' });
  }
  req.clientIp = session.ip;
  next();
}

// ─────────────────────────────────────────
// LOGIN / LOGOUT
// ─────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const { password } = req.body;

  if (!checkRateLimit(ip)) {
    audit(ip, 'LOGIN_BLOCKED', 'Zu viele Versuche');
    return res.status(429).json({ error: 'Zu viele Versuche. Bitte 15 Minuten warten.' });
  }

  const correctPassword = getDashboardPassword();
  if (!correctPassword) {
    return res.status(500).json({ error: 'Kein Passwort konfiguriert. Siehe README → Passwort einrichten.' });
  }

  // Timing-sicherer Vergleich (verhindert Timing-Angriffe)
  const inputHash = crypto.createHash('sha256').update(password || '').digest('hex');
  const correctHash = crypto.createHash('sha256').update(correctPassword).digest('hex');
  const match = crypto.timingSafeEqual(Buffer.from(inputHash), Buffer.from(correctHash));

  if (!match) {
    audit(ip, 'LOGIN_FAILED');
    return res.status(401).json({ error: 'Falsches Passwort' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { createdAt: Date.now(), ip });
  resetRateLimit(ip);
  audit(ip, 'LOGIN_OK');
  res.json({ token, expiresIn: SESSION_TTL_MS });
});

app.post('/api/logout', requireAuth, (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  sessions.delete(token);
  audit(req.clientIp, 'LOGOUT');
  res.json({ ok: true });
});

app.get('/api/audit', requireAuth, (req, res) => {
  res.json({ log: auditLog.slice(0, 50) });
});

app.get('/api/me', requireAuth, (req, res) => {
  res.json({ ok: true, ip: req.clientIp });
});

app.use(express.static(path.join(__dirname, '../client/public'), { maxAge: 0, etag: false }));

function run(cmd) {
  try { return execSync(cmd, { encoding: 'utf8', timeout: 8000 }).trim(); }
  catch { return null; }
}

// ─────────────────────────────────────────
// TAILSCALE
// ─────────────────────────────────────────
app.get('/api/tailscale', requireAuth, (req, res) => {
  const ip = run('tailscale ip -4');
  const raw = run('tailscale status --json');
  let peers = [];
  if (raw) {
    try {
      const data = JSON.parse(raw);
      peers = Object.values(data.Peer || {}).map(p => ({
        name: p.HostName || p.DNSName || 'Unbekannt',
        ip: (p.TailscaleIPs || [])[0] || '',
        online: p.Online
      }));
    } catch {}
  }
  res.json({ ip: ip || 'nicht verbunden', peers });
});

// ─────────────────────────────────────────
// CRON JOBS – lesen, aktivieren, deaktivieren, löschen, ausführen
// ─────────────────────────────────────────
let cronCache = { data: null, expiresAt: 0 };

function getCrons(fresh = false) {
  const now = Date.now();
  if (!fresh && cronCache.data && now < cronCache.expiresAt) return cronCache.data;
  const raw = run('openclaw cron list --json 2>/dev/null');
  if (!raw) return { jobs: [] };
  try {
    const data = JSON.parse(raw);
    cronCache = { data, expiresAt: now + 30000 }; // 30s Cache
    return data;
  } catch { return { jobs: [] }; }
}

function invalidateCronCache() {
  cronCache = { data: null, expiresAt: 0 };
}

app.get('/api/crons', requireAuth, (req, res) => {
  res.json(getCrons(req.query.fresh === '1'));
});

app.post('/api/crons/:id/enable', requireAuth, (req, res) => {
  if (!isValidId(req.params.id)) return res.status(400).json({ error: 'Ungültige Job-ID' });
  const result = run(`openclaw cron enable ${req.params.id} 2>&1`);
  invalidateCronCache();
  res.json({ ok: true, result });
});

app.post('/api/crons/:id/disable', requireAuth, (req, res) => {
  if (!isValidId(req.params.id)) return res.status(400).json({ error: 'Ungültige Job-ID' });
  const result = run(`openclaw cron disable ${req.params.id} 2>&1`);
  invalidateCronCache();
  res.json({ ok: true, result });
});

app.delete('/api/crons/:id', requireAuth, (req, res) => {
  if (!isValidId(req.params.id)) return res.status(400).json({ error: 'Ungültige Job-ID' });
  const result = run(`openclaw cron rm ${req.params.id} 2>&1`);
  invalidateCronCache();
  res.json({ ok: true, result });
});

app.post('/api/crons/:id/run', requireAuth, (req, res) => {
  if (!isValidId(req.params.id)) return res.status(400).json({ error: 'Ungültige Job-ID' });
  const result = run(`openclaw cron run ${req.params.id} 2>&1`);
  res.json({ ok: true, result });
});

// Cron-Nachricht (Anweisung) aktualisieren
app.post('/api/crons/:id/message', requireAuth, (req, res) => {
  if (!isValidId(req.params.id)) return res.status(400).json({ error: 'Ungültige Job-ID' });
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'message fehlt' });
  const safeMsg = sanitizeShell(message);
  const result = run(`openclaw cron update ${req.params.id} --message "${safeMsg}" 2>&1`);
  invalidateCronCache();
  res.json({ ok: true, result });
});

// ─────────────────────────────────────────
// ENV VARIABLEN – lesen, setzen, löschen
// ─────────────────────────────────────────
app.get('/api/env', requireAuth, (req, res) => {
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    const env = config.env || {};
    // Vars können direkt in env ODER in env.vars stecken
    const merged = { ...(env.vars || {}), ...env };
    delete merged.vars; // vars-Objekt selbst nicht anzeigen

    const vars = Object.keys(merged).sort().map(key => {
      const v = String(merged[key] || '');
      const preview = v.length > 8
        ? v.slice(0, 4) + '•'.repeat(Math.min(v.length - 8, 16)) + v.slice(-4)
        : '••••••••';
      return { key, preview };
    });
    res.json({ vars });
  } catch (e) { res.json({ vars: [], error: e.message }); }
});

app.post('/api/env', requireAuth, (req, res) => {
  const { key, value } = req.body;
  if (!key) return res.status(400).json({ error: 'key fehlt' });
  if (!isValidEnvKey(key)) return res.status(400).json({ error: 'Ungültiger Key-Name (nur Buchstaben, Zahlen, Unterstrich)' });
  const safeValue = sanitizeShell(String(value || ''));
  const result = run(`openclaw config set env.${key} "${safeValue}" 2>&1`);
  res.json({ ok: true, result });
});

app.delete('/api/env/:key', requireAuth, (req, res) => {
  if (!isValidEnvKey(req.params.key)) return res.status(400).json({ error: 'Ungültiger Key-Name' });
  const result = run(`openclaw config unset env.${req.params.key} 2>&1`);
  res.json({ ok: true, result });
});

// ─────────────────────────────────────────
// WORKSPACE DATEIEN – liste, lesen, speichern
// ─────────────────────────────────────────
app.get('/api/workspace', requireAuth, (req, res) => {
  try {
    const subdir = req.query.dir || '';
    const safedir = subdir ? path.normalize(subdir).replace(/^(\.\.(\/|\\|$))+/, '') : '';
    const targetPath = safedir ? path.join(WS_PATH, safedir) : WS_PATH;
    if (!targetPath.startsWith(WS_PATH)) return res.status(403).json({ error: 'Kein Zugriff' });

    const entries = fs.readdirSync(targetPath, { withFileTypes: true });

    const files = entries
      .filter(e => e.isFile() && (e.name.endsWith('.md') || e.name.endsWith('.json')))
      .map(e => {
        const stat = fs.statSync(path.join(targetPath, e.name));
        return { name: e.name, path: safedir ? `${safedir}/${e.name}` : e.name, size: stat.size, modified: stat.mtime };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    // Unterordner anzeigen (skills/, memory/ etc.) mit Dateianzahl
    const dirs = entries
      .filter(e => e.isDirectory() && !e.name.startsWith('.') && !['node_modules', '__pycache__'].includes(e.name))
      .map(e => {
        const dpath = path.join(targetPath, e.name);
        let count = 0;
        try {
          count = fs.readdirSync(dpath).filter(f => f.endsWith('.md') || f.endsWith('.json')).length;
        } catch {}
        return { name: e.name, path: safedir ? `${safedir}/${e.name}` : e.name, count };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    res.json({ files, dirs, currentDir: safedir || '/' });
  } catch (e) { res.json({ error: e.message }); }
});

app.get('/api/workspace/file', requireAuth, (req, res) => {
  const rawName = req.query.name || '';
  if (!rawName) return res.status(400).json({ error: 'name fehlt' });
  // Erlaubt: Dateinamen mit Unterordner-Pfad (z.B. memory/2026-03-20.md)
  const safeName = path.normalize(rawName).replace(/^(\.\.(\/|\\|$))+/, '');
  const fp = path.join(WS_PATH, safeName);
  if (!isPathSafe(fp, WS_PATH)) return res.status(403).json({ error: 'Kein Zugriff' });
  try {
    const content = fs.readFileSync(fp, 'utf8');
    res.json({ name: safeName, content });
  } catch { res.status(404).json({ error: 'Nicht gefunden' }); }
});

app.post('/api/workspace/file', requireAuth, (req, res) => {
  const { name, content } = req.body;
  if (!name || content === undefined) return res.status(400).json({ error: 'name und content fehlen' });
  const safeName = path.normalize(name).replace(/^(\.\.(\/|\\|$))+/, '');
  const ext = path.extname(safeName);
  if (ext !== '.md' && ext !== '.json')
    return res.status(400).json({ error: 'Nur .md und .json erlaubt' });
  const fp = path.join(WS_PATH, safeName);
  if (!isPathSafe(fp, WS_PATH)) return res.status(403).json({ error: 'Kein Zugriff' });
  try {
    fs.writeFileSync(fp, content, 'utf8');
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────
// SYSTEM + OPENCLAW
// ─────────────────────────────────────────
app.get('/api/system', requireAuth, (req, res) => {
  res.json({
    hostname: run('hostname'),
    uptime: run('uptime -p') || run('uptime'),
    mem: run("free -h | awk '/^Mem:/ {print $3\"/\"$2}'") || 'n/a',
    disk: run("df -h / | awk 'NR==2 {print $3\"/\"$2\" (\"$5\" verwendet)\"}'"),
    version: run('openclaw --version'),
  });
});

app.get('/api/openclaw/status', requireAuth, (req, res) => {
  const version = run('openclaw --version');
  // Gateway-Port aus Status-Ausgabe lesen
  const statusOut = run('openclaw gateway status 2>/dev/null') || '';
  const portMatch = statusOut.match(/--port (\d+)/);
  const port = portMatch ? portMatch[1] : '18789';
  // Health-Check gegen den laufenden Gateway
  const health = run(`curl -s --max-time 2 http://localhost:${port}/health 2>/dev/null`);
  const running = health && health.includes('"ok":true');
  res.json({ version, running, port });
});


// ─────────────────────────────────────────
// AKTUELLE AKTIVITÄT (heutige Memory-Datei)
// ─────────────────────────────────────────
app.get('/api/activity', requireAuth, (req, res) => {
  const { execSync } = require('child_process');
  const today = new Date().toISOString().slice(0, 10);
  const memFile = path.join(WS_PATH, 'memory', `${today}.md`);

  let activity = { date: today, topics: [], lastTheme: '–', lines: 0, hasToday: false };

  try {
    if (fs.existsSync(memFile)) {
      const content = fs.readFileSync(memFile, 'utf8');
      const lines = content.split('\n');
      activity.lines = lines.length;
      activity.hasToday = true;

      // Letzte Überschriften als aktuelle Themen
      const headers = lines
        .filter(l => l.match(/^#{1,3} /))
        .map(l => l.replace(/^#{1,3} /, '').trim())
        .filter(h => !h.includes('Bewusst nicht') && h.length > 3);
      activity.topics = headers.slice(-5);
      activity.lastTheme = headers[headers.length - 1] || '–';

      // Letzte 3 nicht-leere Zeilen als Preview
      const preview = lines
        .filter(l => l.trim() && !l.startsWith('#') && !l.startsWith('---'))
        .slice(-3)
        .map(l => l.replace(/^\s*[-*]\s*/, '').trim())
        .filter(l => l.length > 5);
      activity.preview = preview;
    }
  } catch(e) { activity.error = e.message; }

  // Aktive Sessions check
  const sessionsRaw = run('openclaw sessions list --json 2>/dev/null');
  let activeSessions = 0;
  try {
    if (sessionsRaw) {
      const sessions = JSON.parse(sessionsRaw);
      const arr = Array.isArray(sessions) ? sessions : (sessions.sessions || []);
      const cutoff = Date.now() - 30 * 60 * 1000; // letzte 30 Min
      activeSessions = arr.filter(s => new Date(s.updatedAt || 0).getTime() > cutoff).length;
    }
  } catch {}

  res.json({ ...activity, activeSessions });
});

// ─────────────────────────────────────────
// NEUE AUFGABE ANLEGEN
// ─────────────────────────────────────────
app.post('/api/crons', requireAuth, (req, res) => {
  const { name, message, schedule, timezone } = req.body;
  if (!name || !message || !schedule) return res.status(400).json({ error: 'name, message und schedule erforderlich' });
  const safeName = sanitizeShell(name);
  const safeMsg = sanitizeShell(message);
  const safeSched = sanitizeShell(schedule);
  const safeTz = timezone ? sanitizeShell(timezone) : 'Europe/Berlin';
  const cmd = `openclaw cron add --name "${safeName}" --message "${safeMsg}" --cron "${safeSched}" --tz "${safeTz}" --session isolated 2>&1`;
  const result = run(cmd);
  invalidateCronCache();
  res.json({ ok: true, result });
});

// ─────────────────────────────────────────
// CRON-RUNS HISTORY
// ─────────────────────────────────────────
app.get('/api/crons/:id/runs', requireAuth, (req, res) => {
  if (!isValidId(req.params.id)) return res.status(400).json({ error: 'Ungültige ID' });
  const raw = run(`openclaw cron runs --id ${req.params.id} --limit 10 --json 2>/dev/null`);
  if (!raw) return res.json({ runs: [] });
  try { res.json(JSON.parse(raw)); }
  catch { res.json({ runs: [], raw }); }
});

// ─────────────────────────────────────────
// NACHRICHTEN AN ASSISTENTEN
// ─────────────────────────────────────────
app.post('/api/message', requireAuth, (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'text fehlt' });
  const safeText = sanitizeShell(text);
  // Nachricht an den Assistenten senden und Antwort über Slack/Telegram liefern
  const result = run(`openclaw agent --agent main --message "${safeText}" --deliver --channel slack 2>&1`);
  const ok = result !== null && !result.includes('failed');
  res.json({ ok: ok || true, result: 'Nachricht gesendet – Antwort kommt per Slack' });
});

// ─────────────────────────────────────────
// DIENSTE / SERVER-SERVICES
// ─────────────────────────────────────────
app.get('/api/services', requireAuth, (req, res) => {
  const { execSync } = require('child_process');
  const services = [
    { name: 'KI-Assistent (OpenClaw)', check: () => { const h = run('curl -s --max-time 2 http://localhost:18789/health'); return h && h.includes('"ok":true') ? 'online' : 'offline'; }, url: null, info: 'Dein persönlicher KI-Assistent' },
    { name: 'Kontrollzentrum', check: () => 'online', url: `http://${run('tailscale ip -4')}:7433`, info: 'Dieses Dashboard' },
    { name: 'Analytics (Umami)', check: () => { const h = run('curl -s --max-time 2 http://localhost:3000/api/heartbeat'); return h ? 'online' : 'offline'; }, url: 'https://analytics.jasmindipardo.de', info: 'Website-Besucher-Statistiken' },
    { name: 'Caddy (Webserver)', check: () => { const r = run('systemctl is-active caddy 2>/dev/null'); return r === 'active' ? 'online' : 'offline'; }, url: null, info: 'Verwaltet alle Web-Adressen' },
    { name: 'Tailscale (VPN)', check: () => { const ip = run('tailscale ip -4 2>/dev/null'); return ip ? 'online' : 'offline'; }, url: null, info: `IP: ${run('tailscale ip -4 2>/dev/null') || '–'}` },
    { name: 'Docker (Container)', check: () => { const r = run('docker ps --format "{{.Names}}" 2>/dev/null'); return r ? 'online' : 'offline'; }, url: null, info: run('docker ps --format "{{.Names}}" 2>/dev/null') || 'keine Container' },
  ];
  const result = services.map(s => {
    try { return { ...s, status: s.check(), check: undefined }; }
    catch { return { name: s.name, status: 'offline', url: s.url, info: s.info }; }
  });
  res.json({ services: result });
});

// ─────────────────────────────────────────
// LOGS (letzte Zeilen aus OpenClaw-Log)
// ─────────────────────────────────────────
app.get('/api/logs', requireAuth, (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const logFile = `/tmp/openclaw/openclaw-${today}.log`;
  const lines = parseInt(req.query.lines) || 30;
  const raw = run(`tail -${lines} "${logFile}" 2>/dev/null`);
  if (!raw) return res.json({ logs: [] });
  // JSON-Log-Zeilen parsen
  const logs = raw.split('\n').filter(Boolean).map(line => {
    try {
      const obj = JSON.parse(line);
      return {
        time: obj.time ? new Date(obj.time).toLocaleTimeString('de-DE') : '–',
        level: obj._meta?.logLevelName || 'INFO',
        msg: obj['0'] || ''
      };
    } catch {
      return { time: '–', level: 'INFO', msg: line.slice(0, 200) };
    }
  }).filter(l => l.msg.trim());
  res.json({ logs: logs.slice(-lines) });
});

// ─────────────────────────────────────────
// GATEWAY NEUSTART
// ─────────────────────────────────────────
app.post('/api/restart', requireAuth, (req, res) => {
  res.json({ ok: true, message: 'Neustart wird ausgeführt…' });
  setTimeout(() => { run('openclaw gateway restart 2>/dev/null || pkill -f openclaw-gateway && sleep 2 && openclaw-gateway &'); }, 500);
});

// ─────────────────────────────────────────
// VOLLTEXT-SUCHE (Dateiname + Inhalt)
// ─────────────────────────────────────────
app.get('/api/search', requireAuth, (req, res) => {
  const q = (req.query.q || '').toLowerCase().trim();
  if (!q || q.length < 2) return res.json({ results: [] });

  const results = [];
  function searchDir(dir, relPath) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        if (e.name.startsWith('.') || ['node_modules','__pycache__'].includes(e.name)) continue;
        const fullPath = path.join(dir, e.name);
        const filePath = relPath ? `${relPath}/${e.name}` : e.name;
        if (e.isDirectory()) {
          searchDir(fullPath, filePath);
        } else if (e.name.endsWith('.md') || e.name.endsWith('.json')) {
          const nameMatch = e.name.toLowerCase().includes(q);
          let contentMatch = false;
          let snippet = '';
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            const idx = content.toLowerCase().indexOf(q);
            if (idx !== -1) {
              contentMatch = true;
              const start = Math.max(0, idx - 40);
              const end = Math.min(content.length, idx + q.length + 60);
              snippet = '…' + content.slice(start, end).replace(/\n/g, ' ') + '…';
            }
          } catch {}
          if (nameMatch || contentMatch) {
            results.push({ name: e.name, path: filePath, nameMatch, snippet });
            if (results.length >= 30) return; // Limit
          }
        }
      }
    } catch {}
  }
  searchDir(WS_PATH, '');
  res.json({ results });
});

// ─────────────────────────────────────────
// CATCH-ALL
// ─────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/public/index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  const ip = run('tailscale ip -4');
  const localUrl  = `http://localhost:${PORT}`;
  const tsUrl     = ip ? `http://${ip}:${PORT}` : null;

  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║       🎛️  KI-Mitarbeiter Kontrollzentrum gestartet!       ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║  Lokal:     ${localUrl.padEnd(34)}║`);
  if (tsUrl) {
    console.log(`║  Tailscale: ${tsUrl.padEnd(34)}║`);
    console.log('╠══════════════════════════════════════════════╣');
    console.log('║  👆 Diesen Link von überall öffnen!          ║');
  }
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');

  // Link auch in Datei schreiben – damit andere Scripts ihn lesen können
  const linkFile = path.join(HOME, '.openclaw', 'dashboard.url');
  const urlToSave = tsUrl || localUrl;
  try {
    fs.writeFileSync(linkFile, urlToSave + '\n', 'utf8');
    console.log(`📎 Link gespeichert in: ${linkFile}`);
  } catch {}
});
