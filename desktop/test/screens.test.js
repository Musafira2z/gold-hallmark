const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const { serveScreens } = require("../src/screens");

const get = (port, p) => new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, path: p }, (res) => {
        let body = "";
        res.on("data", (c) => { body += c; });
        res.on("end", () => resolve({ status: res.statusCode, type: res.headers["content-type"], cache: res.headers["cache-control"], body }));
    });
    req.on("error", reject);
    req.end();
});

test("serves files, sends app routes to index.html, never leaves the folder", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "gold-screens-"));
    fs.mkdirSync(path.join(root, "assets"));
    fs.writeFileSync(path.join(root, "index.html"), "INDEX");
    fs.writeFileSync(path.join(root, "assets", "app-1a2b.js"), "JS");
    fs.writeFileSync(path.join(path.dirname(root), "secret.txt"), "SECRET");
    const server = await serveScreens({ dir: root, port: 0 });
    const { port } = server.address();
    try {
        const js = await get(port, "/assets/app-1a2b.js");
        assert.deepStrictEqual([js.status, js.body, js.type.startsWith("text/javascript"), js.cache.includes("immutable")], [200, "JS", true, true]);
        const route = await get(port, "/invoice/abc?view=1");
        assert.deepStrictEqual([route.body, route.cache], ["INDEX", "no-cache"]);
        for (const p of ["/../secret.txt", "/%2e%2e/secret.txt", "/..%2fsecret.txt"]) {
            assert.strictEqual((await get(port, p)).body, "INDEX", p);
        }
        assert.strictEqual(server.address().address, "127.0.0.1", "only this PC");
    } finally {
        server.close();
    }
});
