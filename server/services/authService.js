// Login for owner and staff (BUGS S1/S2). Plan: plans/10-login-security.md
const crypto = require("crypto");
const { promisify } = require("util");
const Staff = require("../models/Staff");
const Session = require("../models/Session");

const scrypt = promisify(crypto.scrypt);
const SESSION_DAYS = 7;
const MAX_FAILS = 5;
const LOCK_MINUTES = 15;

const USERNAME_RE = /^[a-z0-9._-]{3,30}$/;
const MIN_PASSWORD = 6;

// "scrypt$<salt>$<hash>", both base64.
const hashPassword = async (password) => {
    const salt = crypto.randomBytes(16);
    const hash = await scrypt(String(password), salt, 64);
    return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
};

const verifyPassword = async (password, stored) => {
    const [kind, saltB64, hashB64] = String(stored || "").split("$");
    if (kind !== "scrypt" || !saltB64 || !hashB64) return false;
    const expected = Buffer.from(hashB64, "base64");
    const actual = await scrypt(String(password), Buffer.from(saltB64, "base64"), expected.length);
    return crypto.timingSafeEqual(actual, expected);
};

const sha256 = (text) => crypto.createHash("sha256").update(text).digest("hex");

// Checks for a new or changed account. Returns an error text or "".
const checkAccountInput = ({ name, username, password, role }, { passwordRequired }) => {
    if (name !== undefined && (typeof name !== "string" || !name.trim() || name.length > 60)) return "Enter a name (up to 60 letters).";
    if (username !== undefined && (typeof username !== "string" || !USERNAME_RE.test(username.trim().toLowerCase()))) {
        return "Username: 3-30 small letters or numbers (a-z, 0-9, . _ -).";
    }
    if (passwordRequired || password !== undefined) {
        if (typeof password !== "string" || password.length < MIN_PASSWORD || password.length > 200) {
            return `Password: at least ${MIN_PASSWORD} characters.`;
        }
    }
    if (role !== undefined && !["owner", "staff"].includes(role)) return "Role must be owner or staff.";
    return "";
};

const publicStaff = (s) => ({
    _id: s._id,
    name: s.name,
    username: s.username,
    role: s.role,
    active: s.active,
    lastLoginAt: s.lastLoginAt,
    createdAt: s.createdAt,
});

const setupNeeded = async () => (await Staff.countDocuments({})) === 0;

// --- failed-login lock (kept in memory; a restart clears it) ---
const fails = new Map(); // username -> { count, until }
const lockedFor = (username) => {
    const f = fails.get(username);
    if (!f || !f.until) return 0;
    const left = f.until - Date.now();
    if (left <= 0) { fails.delete(username); return 0; }
    return Math.ceil(left / 60000);
};
const noteFail = (username) => {
    const f = fails.get(username) || { count: 0, until: 0 };
    f.count += 1;
    if (f.count >= MAX_FAILS) { f.until = Date.now() + LOCK_MINUTES * 60000; f.count = 0; }
    fails.set(username, f);
};

const createSession = async (staff) => {
    const token = crypto.randomBytes(32).toString("base64url");
    await Session.create({
        tokenHash: sha256(token),
        staff: staff._id,
        expiresAt: new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000),
    });
    return token;
};

// Returns { token, staff } or { error, status }.
const login = async (usernameRaw, password) => {
    const username = String(usernameRaw || "").trim().toLowerCase();
    if (!username || typeof password !== "string") return { error: "Enter username and password.", status: 400 };
    const minutes = lockedFor(username);
    if (minutes) return { error: `Too many wrong tries. Try again in ${minutes} minute(s).`, status: 429 };
    const staff = await Staff.findOne({ username });
    const ok = staff && staff.active && (await verifyPassword(password, staff.passwordHash));
    if (!ok) {
        noteFail(username);
        return { error: "Wrong username or password.", status: 401, staff };
    }
    fails.delete(username);
    staff.lastLoginAt = new Date();
    await staff.save();
    return { token: await createSession(staff), staff };
};

// Staff for a token, or null (unknown, expired, or account switched off).
const staffForToken = async (token) => {
    if (!token) return null;
    const session = await Session.findOne({ tokenHash: sha256(token), expiresAt: { $gt: new Date() } }).populate("staff");
    if (!session || !session.staff || !session.staff.active) return null;
    return session.staff;
};

const logout = async (token) => Session.deleteOne({ tokenHash: sha256(String(token || "")) });
const endAllSessions = async (staffId) => Session.deleteMany({ staff: staffId });

module.exports = {
    hashPassword,
    verifyPassword,
    checkAccountInput,
    publicStaff,
    setupNeeded,
    login,
    createSession,
    staffForToken,
    logout,
    endAllSessions,
};
