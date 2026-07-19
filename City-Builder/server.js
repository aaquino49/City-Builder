// Simple zero-dependency Node.js static file server for local play and Railway.
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const PORT = Number(process.env.PORT) || 8000;
const ROOT = path.dirname(fileURLToPath(import.meta.url));

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon',
    '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg',
    '.woff2': 'font/woff2'
};

const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    let pathname;
    try {
        pathname = decodeURIComponent(url.pathname);
    } catch {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Bad Request');
        return;
    }

    if (pathname === '/') pathname = '/index.html';
    const filePath = path.resolve(ROOT, `.${pathname}`);
    if (!filePath.startsWith(ROOT + path.sep) && filePath !== ROOT) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Forbidden');
        return;
    }
    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = MIME_TYPES[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end('<h1>404 Not Found</h1>', 'utf-8');
            } else {
                res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end(`Server Error: ${error.code}\n`);
            }
        } else {
            const cacheControl = extname === '.html' || extname === '.js' || extname === '.css'
                ? 'no-cache'
                : 'public, max-age=31536000, immutable';
            res.writeHead(200, {
                'Content-Type': `${contentType}${contentType.startsWith('text/') || extname === '.js' ? '; charset=utf-8' : ''}`,
                'Cache-Control': cacheControl,
            });
            res.end(content);
        }
    });
});

server.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`Pixel Dominion Local Server Running!`);
    console.log(`URL: http://localhost:${PORT}`);
    console.log(`Press Ctrl+C to terminate the server.`);
    console.log(`======================================================\n`);
});
