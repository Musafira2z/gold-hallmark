// Plan 19: owner's phone app code and the PC heartbeat.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { makeCode, hashCode, checkCode, normalizeCode, ALPHABET } = require("../services/ownerCode");
const { newestBackup, heartbeat } = require("../services/pcHealth");
const { toOwner } = require("../services/sync");

test("codes look like K7PQ-M2XD-9HTW and vary", () => {
    const codes = new Set(Array.from({ length: 200 }, makeCode));
    assert.equal(codes.size, 200);
    for (const c of codes) {
        assert.match(c, /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
        for (const ch of c.replace(/-/g, "")) assert.ok(ALPHABET.includes(ch));
    }
});

test("hash checks the code however it is typed, and never contains it", () => {
    const code = "K7PQ-M2XD-9HTW";
    const h = hashCode(code);
    assert.match(h, /^sha256\$[a-f0-9]{32}\$[a-f0-9]{64}$/);
    assert.ok(!h.includes("K7PQ"));
    assert.equal(checkCode(code, h), true);
    assert.equal(checkCode("k7pq m2xd 9htw", h), true);
    assert.equal(checkCode("K7PQM2XD9HTW", h), true);
    assert.equal(checkCode("K7PQ-M2XD-9HTX", h), false);
    assert.equal(checkCode("K7PQ-M2XD", h), false);
    assert.equal(checkCode(code, null), false);
    assert.equal(checkCode(code, "sha256$zz$zz"), false);
    assert.equal(normalizeCode(" ab-cd "), "ABCD");
    assert.throws(() => hashCode("short"));
});

test("newest backup: newest non-empty .gz, null without a folder", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bk-"));
    try {
        assert.equal(await newestBackup(undefined), null);
        assert.equal(await newestBackup(path.join(dir, "missing")), null);
        assert.equal(await newestBackup(dir), null);
        fs.writeFileSync(path.join(dir, "a.gz"), "x");
        fs.writeFileSync(path.join(dir, "b.gz"), "yy");
        fs.writeFileSync(path.join(dir, "empty.gz"), "");
        fs.writeFileSync(path.join(dir, "notes.txt"), "zzz");
        fs.mkdirSync(path.join(dir, "photos"));
        const old = new Date(Date.now() - 3600e3);
        fs.utimesSync(path.join(dir, "a.gz"), old, old);
        const b = await newestBackup(dir);
        assert.equal(b.name, "b.gz");
        assert.equal(b.size, 2);
        const beat = await heartbeat({ waiting: 3, dir });
        assert.equal(beat.waiting, 3);
        assert.equal(beat.backup.name, "b.gz");
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("owner sent to the website: code hash only while on, active and owner", () => {
    const base = { _id: "s1", name: "Owner", role: "owner", active: true, ownerAppCodeHash: "sha256$x", ownerAppCodeSetAt: new Date() };
    assert.equal(toOwner(base).codeHash, "sha256$x");
    assert.equal(toOwner({ ...base, ownerAppOffAt: new Date() }).codeHash, null);
    assert.equal(toOwner({ ...base, active: false }).codeHash, null);
    assert.equal(toOwner({ ...base, role: "staff" }).codeHash, null);
});
