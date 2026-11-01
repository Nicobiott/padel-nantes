// Serveur local, sans dépendance : node server.js  ->  http://localhost:3000
// Mode test avec créneaux fictifs : MOCK=1 node server.js
// (La version hébergée n'a pas besoin de serveur : voir README, GitHub Pages.)
const http = require('http');
const fs = require('fs');
const path = require('path');
const { collect } = require('./collect');

const PORT = process.env.PORT || 3000;
const CACHE_MS = 10 * 60 * 1000;
let cached = null;
let pending = null;

async function getData() {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.data;
  pending ||= collect().then((data) => { cached = { at: Date.now(), data }; pending = null; return data; });
  return pending;
}

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/data.json') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify(await getData()));
  }
  const root = path.join(__dirname, 'public');
  const file = path.join(root, url.pathname === '/' ? 'index.html' : path.normalize(url.pathname));
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Introuvable'); }
    res.writeHead(200, { 'Content-Type': (types[path.extname(file)] || 'application/octet-stream') + '; charset=utf-8' });
    res.end(data);
  });
}).listen(PORT, () => console.log(`Pistas 12 : http://localhost:${PORT}${process.env.MOCK === '1' ? ' (créneaux fictifs)' : ''}`));
