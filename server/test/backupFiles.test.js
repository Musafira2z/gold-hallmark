// Plan 22: the owner's phone shows only good backups as "newest backup".
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { newestBackup, isRealBackup } = require("../services/pcHealth");

test("only good backups count", () => {
    assert.ok(isRealBackup("goldhallmark-20261125-1200.gz"));
    assert.ok(isRealBackup("goldhallmark-20261125-1200-before-update-1.0.1.gz"));
    assert.ok(!isRealBackup(".tmp-goldhallmark-20261125-1200.gz"));
    assert.ok(!isRealBackup("goldhallmark-20261125-1200.BAD.gz"));
    assert.ok(!isRealBackup("goldhallmark-20261125-1200.CHECK.gz"));
    assert.ok(!isRealBackup("backup-log.txt"));
});

test("newest skips half-written and bad files", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gold-bk-"));
    const put = (name, ageMin) => {
        const p = path.join(dir, name);
        fs.writeFileSync(p, "x");
        const t = new Date(Date.now() - ageMin * 60000);
        fs.utimesSync(p, t, t);
    };
    put("goldhallmark-20261125-0600.gz", 300);
    put("goldhallmark-20261125-1100.BAD.gz", 10);
    put("goldhallmark-20261125-1105.CHECK.gz", 5);
    put(".tmp-goldhallmark-20261125-1110.gz", 1);
    assert.strictEqual((await newestBackup(dir)).name, "goldhallmark-20261125-0600.gz");
});
