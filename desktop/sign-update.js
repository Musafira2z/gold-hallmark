#!/usr/bin/env node
// Signs an installer for the app's updates (Plan 22). Run on the test server only.
//   node desktop/sign-update.js --new-key                      make the key pair (once)
//   node desktop/sign-update.js dist/SylhetGoldHallmark-Setup-1.0.1.exe   -> writes <file>.sig
// The private key is desktop/.update-signing-key.pem (or UPDATE_KEY_FILE). Never commit it.
// Keep a copy somewhere safe: without it, no update can be published (the app would need a manual reinstall).
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const keyFile = process.env.UPDATE_KEY_FILE || path.join(__dirname, ".update-signing-key.pem");

(async () => {
    const arg = process.argv[2];
    if (arg === "--new-key") {
        if (fs.existsSync(keyFile)) throw new Error(`${keyFile} already exists; not replaced`);
        const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
        fs.writeFileSync(keyFile, privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600 });
        const pub = publicKey.export({ type: "spki", format: "pem" });
        fs.writeFileSync(path.join(__dirname, "src", "update-key.js"),
            `// Public half of the update signing key (Plan 22). Made by: node desktop/sign-update.js --new-key\n` +
            `module.exports = { UPDATE_PUBLIC_KEY: ${JSON.stringify(pub)} };\n`);
        console.log(`New key: private ${keyFile}, public src/update-key.js`);
        return;
    }
    if (!arg) throw new Error("Give the installer file");
    const version = require("./package.json").version;
    if (!path.basename(arg).includes(version)) throw new Error(`${arg} is not version ${version} (package.json)`);
    const { signInstaller } = require("./src/updates"); // after --new-key has made src/update-key.js
    const sig = await signInstaller(arg, version, fs.readFileSync(keyFile, "utf8"));
    fs.writeFileSync(`${arg}.sig`, JSON.stringify(sig, null, 2));
    console.log(`Signed ${path.basename(arg)} (${version}) -> ${path.basename(arg)}.sig`);
})().catch((e) => { console.error(e.message); process.exit(1); });
