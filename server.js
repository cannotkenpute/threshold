const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;
const ROOT = path.resolve(__dirname);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.fbx': 'application/octet-stream',
  '.obj': 'text/plain',
  '.mtl': 'text/plain',
  '.dae': 'application/xml',
  '.usdz': 'model/vnd.usdz+zip'
};

// Connected SSE clients for live reload
const clients = new Set();

function broadcastReload() {
  console.log(`[DevServer] File changed -> Triggering instant browser reload...`);
  for (const client of clients) {
    try {
      client.write(`data: reload\n\n`);
    } catch (e) {
      clients.delete(client);
    }
  }
}

// Watch directory for changes
let reloadDebounce = null;
fs.watch(ROOT, { recursive: true }, (eventType, filename) => {
  if (!filename) return;
  // Ignore git, node_modules, temp, .DS_Store
  if (filename.includes('.git') || filename.includes('node_modules') || filename.startsWith('.') || filename.includes('.system_generated')) return;
  
  clearTimeout(reloadDebounce);
  reloadDebounce = setTimeout(() => {
    broadcastReload();
  }, 100);
});

const server = http.createServer((req, res) => {
  // 1. Live Reload EventSource Endpoint
  if (req.url === '/__livereload') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write('\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  // Parse requested URL
  let parsedUrl = req.url.split('?')[0];
  if (parsedUrl === '/') parsedUrl = '/index.html';
  
  // Safe path resolution
  const decodedPath = decodeURIComponent(parsedUrl);
  let filePath = path.join(ROOT, decodedPath);

  // Case-insensitive fallback for Assets vs assets on macOS
  if (!fs.existsSync(filePath)) {
    if (decodedPath.startsWith('/assets/')) {
      const altPath = path.join(ROOT, decodedPath.replace('/assets/', '/Assets/'));
      if (fs.existsSync(altPath)) filePath = altPath;
    } else if (decodedPath.startsWith('/Assets/')) {
      const altPath = path.join(ROOT, decodedPath.replace('/Assets/', '/assets/'));
      if (fs.existsSync(altPath)) filePath = altPath;
    }
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end(`404 Not Found: ${parsedUrl}`);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // ZERO CACHING HEADERS - Guarantees instant reload on changes
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store',
      'Access-Control-Allow-Origin': '*'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`⚡ BACKROOMS DEV SERVER RUNNING: http://localhost:${PORT}`);
  console.log(`🔥 Zero-Cache & Hot Auto-Reload Active`);
  console.log(`   (You NEVER need to restart the server when files change!)`);
  console.log(`=======================================================`);
});
