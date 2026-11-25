const test = require("node:test");
const assert = require("node:assert");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { verifyInstaller, signInstaller } = require("../src/updates");
const { UPDATE_PUBLIC_KEY } = require("../src/update-key");

const keys = () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
    return { pub: publicKey.export({ type: "spki", format: "pem" }), priv: privateKey.export({ type: "pkcs8", format: "pem" }) };
};
const file = (content) => {
    const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "gold-up-")), "Setup-1.0.1.exe");
    fs.writeFileSync(p, content);
    return p;
};

test("a correctly signed installer is accepted", async () => {
    const k = keys();
    const f = file("installer bytes");
    const sig = await signInstaller(f, "1.0.1", k.priv);
    assert.deepStrictEqual(await verifyInstaller(f, sig, k.pub, "1.0.1"), { ok: true });
});

test("tampered, wrong key, wrong version, or no signature: refused", async () => {
    const k = keys();
    const other = keys();
    const f = file("installer bytes");
    const sig = await signInstaller(f, "1.0.1", k.priv);
    fs.appendFileSync(f, "evil");
    assert.strictEqual((await verifyInstaller(f, sig, k.pub, "1.0.1")).ok, false, "tampered file");
    const f2 = file("installer bytes");
    assert.strictEqual((await verifyInstaller(f2, sig, other.pub, "1.0.1")).ok, false, "someone else's key");
    assert.strictEqual((await verifyInstaller(f2, sig, k.pub, "1.0.2")).ok, false, "signature for another version");
    const forged = { ...sig, version: "1.0.2" };
    assert.strictEqual((await verifyInstaller(f2, forged, k.pub, "1.0.2")).ok, false, "version changed after signing");
    assert.strictEqual((await verifyInstaller(f2, null, k.pub)).ok, false, "no signature");
    assert.strictEqual((await verifyInstaller(f2, { version: "1", sha512: "x", signature: "!!" }, k.pub)).ok, false, "garbage");
});

test("the app has a real public key built in", () => {
    const key = crypto.createPublicKey(UPDATE_PUBLIC_KEY);
    assert.strictEqual(key.asymmetricKeyType, "ed25519");
});
