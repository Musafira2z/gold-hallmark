const test = require("node:test");
const assert = require("node:assert");
const { parseRestore, importReport, photoName, restoreArgs } = require("../src/importer");

test("the old PC's sync progress is not brought over, so the new app sends everything again", () => {
    const args = restoreArgs("mongodb://127.0.0.1:47117", "/b/goldhallmark-1.gz");
    assert.ok(args.includes("--nsInclude=goldhallmark.*"));
    assert.ok(args.includes("--nsExclude=goldhallmark.syncstates"));
    assert.ok(args.includes("--drop"));
});

test("reads mongorestore's counts", () => {
    const out = [
        "2026-11-25T10:00:00.000+0600\tfinished restoring goldhallmark.orders (29854 documents, 0 failures)",
        "2026-11-25T10:00:00.000+0600\tfinished restoring goldhallmark.users (812 documents, 0 failures)",
        "2026-11-25T10:00:00.000+0600\tfinished restoring goldhallmark.counters (1 document, 0 failures)",
        "2026-11-25T10:00:01.000+0600\t30667 document(s) restored successfully and 0 document(s) failed to restore.",
    ].join("\n");
    assert.deepStrictEqual(parseRestore(out), { counts: { orders: 29854, users: 812, counters: 1 }, failures: 0, restored: 30667 });
    assert.strictEqual(parseRestore("10 document(s) restored successfully and 2 document(s) failed to restore.").failures, 2);
});

test("photo names from image paths", () => {
    assert.strictEqual(photoName("/uploads/image-1-2.jpg"), "image-1-2.jpg");
    for (const bad of [null, "", "image.jpg", "/uploads/../x.jpg", "/uploads/a/b.jpg", "http://x/uploads/a.jpg"]) {
        assert.strictEqual(photoName(bad), bad === "/uploads/../x.jpg" ? null : null, String(bad));
    }
});

test("report: equal counts, missing photos, problems", () => {
    const ok = importReport({ file: "b.gz", fileCounts: { orders: 3, users: 2 }, appCounts: { orders: 3, users: 2 },
        referenced: new Set(["a.jpg", "b.jpg"]), present: new Set(["a.jpg", "b.jpg", "c.jpg"]), copied: 3, failures: 0 });
    assert.ok(ok.ok);
    assert.deepStrictEqual(ok.missing, []);
    assert.match(ok.text, /everything brought over, all counts equal/);

    const miss = importReport({ file: "b.gz", fileCounts: { orders: 3 }, appCounts: { orders: 3 },
        referenced: new Set(["a.jpg", "z.jpg"]), present: new Set(["a.jpg"]), copied: 1, failures: 0 });
    assert.ok(miss.ok);
    assert.deepStrictEqual(miss.missing, ["z.jpg"]);
    assert.match(miss.text, /photo file missing: 1/);

    const bad = importReport({ file: "b.gz", fileCounts: { orders: 3 }, appCounts: { orders: 2 },
        referenced: new Set(), present: new Set(), copied: 0, failures: 1 });
    assert.ok(!bad.ok);
    assert.match(bad.text, /NOT EQUAL/);
    assert.match(bad.text, /PROBLEM/);
});
