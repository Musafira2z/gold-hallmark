// Serves the shop screens (the built client) on 127.0.0.1, like nginx did in Docker.
const http = require("http");
const fs = require("fs");
const path = require("path");

const TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".avif": "image/avif",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".webmanifest": "application/manifest+json",
};

function serveScreens({ dir, port }) {
    const root = path.resolve(dir);
    const index = path.join(root, "index.html");
    const server = http.createServer((req, res) => {
        let file;
        try {
            const urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
            file = path.resolve(root, `.${urlPath}`);
        } catch {
            res.writeHead(400).end();
            return;
        }
        // Never outside the screens folder.
        if (file !== root && !file.startsWith(root + path.sep)) file = index;
        fs.stat(file, (err, stat) => {
            const target = !err && stat.isFile() ? file : index; // app routes like /orders -> index.html
            const type = TYPES[path.extname(target).toLowerCase()] || "application/octet-stream";
            const headers = { "Content-Type": type, "X-Content-Type-Options": "nosniff" };
            // Built files have a hash in their name, so they can be kept; index.html never.
            headers["Cache-Control"] = target.includes(`${path.sep}assets${path.sep}`) ? "public, max-age=31536000, immutable" : "no-cache";
            res.writeHead(200, headers);
            fs.createReadStream(target).pipe(res);
        });
    });
    return new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, "127.0.0.1", () => resolve(server));
    });
}

module.exports = { serveScreens };
