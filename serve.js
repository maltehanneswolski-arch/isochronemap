/* Local development server. Static files with no caching, plus one write
   endpoint used by the calibration tools: POST /save/<name> drops a JSON body
   into data/out/<name>, so a measurement made in the page can be pulled back
   to disk without going through the console. Localhost only, and it refuses
   anything but a plain file name. */
const http = require('http'), fs = require('fs'), p = require('path');
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
            '.json': 'application/json', '.css': 'text/css' };
const OUT = p.join(__dirname, 'data', 'out');

http.createServer((q, s) => {
  if (q.method === 'POST' && q.url.startsWith('/save/')) {
    const name = decodeURIComponent(q.url.slice(6));
    if (!/^[A-Za-z0-9_.-]+$/.test(name) || name.includes('..')) {
      s.writeHead(400); s.end('bad name'); return;
    }
    let body = '';
    q.on('data', c => { body += c; });
    q.on('end', () => {
      fs.mkdirSync(OUT, { recursive: true });
      fs.writeFileSync(p.join(OUT, name), body);
      s.writeHead(200, { 'Content-Type': 'text/plain' });
      s.end('saved ' + body.length + ' bytes');
    });
    return;
  }
  let f = decodeURIComponent(q.url.split('?')[0]);
  if (f === '/') f = '/index.html';
  const fp = p.join(__dirname, f);
  fs.readFile(fp, (e, d) => {
    if (e) { s.writeHead(404); s.end('not found'); return; }
    s.writeHead(200, { 'Content-Type': T[p.extname(fp)] || 'application/octet-stream',
                       'Cache-Control': 'no-store, max-age=0' });
    s.end(d);
  });
}).listen(5199, () => console.log('serving isochrone-globe on 5199 (no-store, POST /save/<name>)'));
