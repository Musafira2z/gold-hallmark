// Online login PIN for karigors and shop owners (Plan 18).
// The PIN is 6 random digits, shown to staff once. Only a scrypt hash is kept,
// here and on the website; the website checks a login with checkPin (same code there).
const crypto = require("crypto");

const PIN_RE = /^\d{6}$/;
const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 32;

const makePin = () => String(crypto.randomInt(0, 1000000)).padStart(6, "0");

// "scrypt$16384$8$1$<salt base64>$<hash base64>"
const hashPin = (pin) => {
    if (!PIN_RE.test(String(pin))) throw new Error("PIN must be 6 digits");
    const salt = crypto.randomBytes(16);
    const hash = crypto.scryptSync(String(pin), salt, KEYLEN, { N, r: R, p: P });
    return ["scrypt", N, R, P, salt.toString("base64"), hash.toString("base64")].join("$");
};

const checkPin = (pin, stored) => {
    if (!PIN_RE.test(String(pin)) || typeof stored !== "string") return false;
    const parts = stored.split("$");
    if (parts.length !== 6 || parts[0] !== "scrypt") return false;
    const [n, r, p] = parts.slice(1, 4).map(Number);
    if (n !== N || r !== R || p !== P) return false; // only the known strength
    const salt = Buffer.from(parts[4], "base64");
    const want = Buffer.from(parts[5], "base64");
    if (salt.length !== 16 || want.length !== KEYLEN) return false;
    const got = crypto.scryptSync(String(pin), salt, KEYLEN, { N, r: R, p: P });
    return crypto.timingSafeEqual(got, want);
};

// 01XXXXXXXXX only: the login is by phone, so it must be a real mobile number.
const loginPhone = (value) => {
    const digits = String(value ?? "").replace(/\D/g, "");
    if (/^01\d{9}$/.test(digits)) return digits;
    if (/^1\d{9}$/.test(digits)) return `0${digits}`;
    if (/^8801\d{9}$/.test(digits)) return digits.slice(2);
    return null;
};

module.exports = { makePin, hashPin, checkPin, loginPhone, PIN_RE };
