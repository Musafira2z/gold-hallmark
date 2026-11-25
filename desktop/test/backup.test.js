const test = require("node:test");
const assert = require("node:assert");
const { stamp, isoWeek, toPrune, isBigDrop, isGood } = require("../src/backup");

test("names use Bangladesh time", () => {
    assert.strictEqual(stamp(new Date("2026-11-25T18:30:00Z")), "20261126-0030"); // past midnight in Dhaka
    assert.strictEqual(stamp(new Date("2026-01-01T00:05:00Z")), "20260101-0605");
});

test("good backup names", () => {
    assert.ok(isGood("goldhallmark-20261125-1200.gz"));
    for (const n of ["goldhallmark-20261125-1200.BAD.gz", "goldhallmark-20261125-1200.CHECK.gz", ".tmp-goldhallmark-20261125-1200.gz",
        "goldhallmark-20261125-1200-before-update-1.0.1.gz", "goldhallmark-week-2026-W48-20261125-1200.gz"]) {
        assert.ok(!isGood(n), n);
    }
});

test("ISO week (Dhaka date)", () => {
    assert.strictEqual(isoWeek(new Date("2026-11-25T06:00:00Z")), "2026-W48");
    assert.strictEqual(isoWeek(new Date("2026-01-01T06:00:00Z")), "2026-W01");
    assert.strictEqual(isoWeek(new Date("2027-01-01T06:00:00Z")), "2026-W53");
});

test("keeps the newest N", () => {
    const files = Array.from({ length: 17 }, (_, i) => ({ name: `f${i}`, mtimeMs: i }));
    assert.deepStrictEqual(toPrune(files, 14).sort(), ["f0", "f1", "f2"]);
    assert.deepStrictEqual(toPrune(files.slice(0, 3), 14), []);
});

test("big drop rule (below half of last time)", () => {
    assert.ok(isBigDrop(30000, 14000));
    assert.ok(!isBigDrop(30000, 15000));
    assert.ok(!isBigDrop(0, 0), "first backup is never a drop");
});
