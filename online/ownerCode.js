// The owner's phone app code (Plan 19): 12 random letters/digits, e.g. K7PQ-M2XD-9HTW.
// About 59 bits, so it can't be guessed; only a salted sha256 is kept, here and on the website.
// The same code is in online/ownerCode.js (the website checks logins with it).
const crypto = require("crypto");

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I/L
const LENGTH = 12;

const makeCode = () => {
    let out = "";
    for (let i = 0; i < LENGTH; i += 1) out += ALPHABET[crypto.randomInt(0, ALPHABET.length)];
    return `${out.slice(0, 4)}-${out.slice(4, 8)}-${out.slice(8)}`;
};

// What people type: any case, with or without spaces and dashes.
const normalizeCode = (text) => String(text ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

const hashCode = (code) => {
    const clean = normalizeCode(code);
    if (clean.length !== LENGTH) throw new Error("Code must be 12 characters");
    const salt = crypto.randomBytes(16).toString("hex");
    return `sha256$${salt}$${crypto.createHash("sha256").update(`${salt}:${clean}`).digest("hex")}`;
};

const checkCode = (code, stored) => {
    const clean = normalizeCode(code);
    if (clean.length !== LENGTH || typeof stored !== "string") return false;
    const [kind, salt, hex] = stored.split("$");
    if (kind !== "sha256" || !/^[a-f0-9]{32}$/.test(salt || "") || !/^[a-f0-9]{64}$/.test(hex || "")) return false;
    const got = crypto.createHash("sha256").update(`${salt}:${clean}`).digest();
    return crypto.timingSafeEqual(got, Buffer.from(hex, "hex"));
};

module.exports = { makeCode, normalizeCode, hashCode, checkCode, ALPHABET };
