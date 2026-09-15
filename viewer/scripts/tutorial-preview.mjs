import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const viewer = new URL('../', import.meta.url);
const files = {
    '/bundle.js': fileURLToPath(new URL('dist/container-viewer.umd.min.js', viewer)),
    '/bundle.css': fileURLToPath(new URL('dist/container-viewer.css', viewer)),
    '/vue.js': require.resolve('vue/dist/vue.min.js'),
};
const html =
    '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Container tutorial</title><link rel="stylesheet" href="/bundle.css"><div id="app"></div><script src="/vue.js"></script><script src="/bundle.js"></script><script>container.launchTutorial("#app",{chapter:new URLSearchParams(location.search).get("chapter")||"supply-chain"});</script>';
const server = createServer(async (req, res) => {
    const path = new URL(req.url, 'http://localhost').pathname;
    try {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'no-store');
        if (files[path]) {
            res.setHeader('Content-Type', path.endsWith('.css') ? 'text/css' : 'text/javascript');
            res.end(await readFile(files[path]));
        } else if (path === '/') {
            res.setHeader('Content-Type', 'text/html');
            res.end(html);
        } else {
            res.statusCode = 404;
            res.end('Not found');
        }
    } catch {
        res.statusCode = 500;
        res.end('Build the viewer with pnpm package first.');
    }
});
const port = Number(process.env.PORT || 5197);
server.listen(port, '127.0.0.1', () =>
    console.log(`Container tutorial: http://127.0.0.1:${port}/?chapter=supply-chain`)
);
