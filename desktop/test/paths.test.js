const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { folders, makeFolders, readSettings, DEFAULT_SETTINGS } = require("../src/paths");

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "gold-desktop-"));

test("folders are made under the data folder", () => {
    const f = folders(tmp());
    makeFolders(f);
    for (const d of [f.db, f.photos, f.backups, f.logs]) assert.ok(fs.statSync(d).isDirectory());
});

test("first start writes settings.json with the defaults", () => {
    const file = path.join(tmp(), "settings.json");
    assert.deepStrictEqual(readSettings(file), DEFAULT_SETTINGS);
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(file, "utf8")), DEFAULT_SETTINGS);
    assert.strictEqual(DEFAULT_SETTINGS.syncUrl, "", "sync stays off until the website is set up");
});

test("saved values are used; broken or wrong-type values fall back", () => {
    const file = path.join(tmp(), "settings.json");
    fs.writeFileSync(file, JSON.stringify({ syncUrl: " https://x.test ", syncKey: 5, extra: "no" }));
    const s = readSettings(file);
    assert.strictEqual(s.syncUrl, "https://x.test");
    assert.strictEqual(s.syncKey, "");
    assert.strictEqual(s.extra, undefined);
    fs.writeFileSync(file, "{ broken");
    assert.deepStrictEqual(readSettings(file), DEFAULT_SETTINGS);
    assert.strictEqual(fs.readFileSync(file, "utf8"), "{ broken", "a broken file is never overwritten");
});
