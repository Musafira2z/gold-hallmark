// Plan 23 (S7): /desktop/ updates, https only behind the proxy, robots. No database needed.
const { test, before, after } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { createApp, DESKTOP_FILE_RE } = require("../app");

const KEY = "test-key-0123456789abcdefghij";
let dir;
let outside;
const servers = [];
const bases = {};

const listen = (app) => new Promise((resolve) => {
    const s = app.listen(0, () => resolve(`http://127.0.0.1:${s.address().port}`));
    servers.push(s);
});

before(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "desktop-"));
    outside = fs.mkdtempSync(path.join(os.tmpdir(), "outside-"));
    fs.writeFileSync(path.join(dir, "latest.yml"), "version: 1.0.1\n");
    fs.writeFileSync(path.join(dir, "SylhetGoldHallmark-Setup-1.0.1.exe"), Buffer.alloc(4096, 7));
    fs.writeFileSync(path.join(dir, "SylhetGoldHallmark-Setup-1.0.1.exe.sig"), "{}");
    fs.writeFileSync(path.join(dir, ".update-signing-key.pem"), "secret");
    fs.writeFileSync(path.join(dir, "notes.txt"), "not served");
    fs.writeFileSync(path.join(outside, "secret.exe"), "outside");
    bases.plain = await listen(createApp({ syncKey: KEY, desktopDir: dir }));
    bases.proxy = await listen(createApp({ syncKey: KEY, desktopDir: dir, trustProxy: true, httpsOnlyMode: true }));
    bases.noDesktop = await listen(createApp({ syncKey: KEY }));
});

after(() => {
    for (const s of servers) s.close();
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
});

test("only update file names are allowed", () => {
    for (const ok of ["latest.yml", "latest-linux.yml", "SylhetGoldHallmark-Setup-1.0.1.exe", "SylhetGoldHallmark-Setup-1.0.1.exe.sig", "SylhetGoldHallmark-Setup-1.0.1.exe.blockmap"]) {
        assert.ok(DESKTOP_FILE_RE.test(ok), ok);
    }
    for (const bad of [".update-signing-key.pem", "notes.txt", "../secret.exe", "a/b.exe", "", ".exe", "latest.yml.bak"]) {
        assert.ok(!DESKTOP_FILE_RE.test(bad), bad);
    }
});

test("/desktop/ serves latest.yml uncached and the installer whole and in ranges", async () => {
    let res = await fetch(`${bases.plain}/desktop/latest.yml`);
    assert.equal(res.status, 200);
    assert.equal(await res.text(), "version: 1.0.1\n");
    assert.equal(res.headers.get("cache-control"), "no-store");

    res = await fetch(`${bases.plain}/desktop/SylhetGoldHallmark-Setup-1.0.1.exe.sig`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("cache-control"), "no-store");

    res = await fetch(`${bases.plain}/desktop/SylhetGoldHallmark-Setup-1.0.1.exe`);
    assert.equal(res.status, 200);
    assert.equal((await res.arrayBuffer()).byteLength, 4096);
    assert.match(res.headers.get("cache-control"), /max-age=86400/);

    res = await fetch(`${bases.plain}/desktop/SylhetGoldHallmark-Setup-1.0.1.exe`, { headers: { Range: "bytes=0-99" } });
    assert.equal(res.status, 206);
    assert.equal((await res.arrayBuffer()).byteLength, 100);
});

test("/desktop/ hides everything else", async () => {
    for (const p of ["/desktop/", "/desktop", "/desktop/.update-signing-key.pem", "/desktop/notes.txt",
        "/desktop/..%2f..%2fetc%2fpasswd", "/desktop/%2e%2e/secret.exe", "/desktop/Missing-9.9.9.exe"]) {
        const res = await fetch(`${bases.plain}${p}`);
        assert.equal(res.status, 404, p);
        const body = await res.text();
        assert.doesNotMatch(body, /secret|not served|outside/, p);
    }
    assert.equal((await fetch(`${bases.plain}/desktop/latest.yml`, { method: "POST" })).status, 404);
    assert.equal((await fetch(`${bases.noDesktop}/desktop/latest.yml`)).status, 404);
});

test("robots keeps search engines out of private pages", async () => {
    const res = await fetch(`${bases.plain}/robots.txt`);
    assert.equal(res.status, 200);
    const text = await res.text();
    for (const p of ["/r/", "/report", "/login", "/me", "/owner", "/api/", "/desktop/"]) assert.match(text, new RegExp(`Disallow: ${p}\\n`));
});

// fetch can't set Host, so this one uses http directly.
const rawGet = (base, p, headers) => new Promise((resolve, reject) => {
    const u = new URL(base);
    http.get({ host: u.hostname, port: u.port, path: p, headers }, (res) => { res.resume(); resolve(res); }).on("error", reject);
});

test("behind the proxy: http goes to https, https gets HSTS, health stays on http", async () => {
    const raw = await rawGet(bases.proxy, "/report?memo=1", { "X-Forwarded-Proto": "http", Host: "sylhethallmark.com" });
    assert.equal(raw.statusCode, 301);
    assert.equal(raw.headers.location, "https://sylhethallmark.com/report?memo=1");

    let res;

    res = await fetch(`${bases.proxy}/api/sync/orders`, { method: "POST", headers: { "X-Forwarded-Proto": "http" } });
    assert.equal(res.status, 403);

    res = await fetch(`${bases.proxy}/robots.txt`, { headers: { "X-Forwarded-Proto": "https" } });
    assert.equal(res.status, 200);
    assert.match(res.headers.get("strict-transport-security"), /max-age=31536000/);

    // A proxy that says nothing: no redirect, so never a loop.
    res = await fetch(`${bases.proxy}/robots.txt`, { redirect: "manual" });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("strict-transport-security"), null);
});

test("without the proxy setting nothing is redirected", async () => {
    const res = await fetch(`${bases.plain}/robots.txt`, { redirect: "manual", headers: { "X-Forwarded-Proto": "http" } });
    assert.equal(res.status, 200);
});
