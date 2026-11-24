// Online report link for each order (Plan 14 / S1).
// - reportToken: 12 random letters/digits, used in the QR link /r/<token>. Can't be guessed.
// - reportCode:  4 easy-to-read characters printed on the memo. Memo number + code
//   finds the report on the website (memo numbers alone are easy to count through).
const crypto = require("crypto");
const Order = require("../models/Order");

const TOKEN_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I/L

// Unbiased random characters (bytes above the last full multiple are skipped).
const randomFrom = (alphabet, length) => {
    const limit = 256 - (256 % alphabet.length);
    let out = "";
    while (out.length < length) {
        for (const byte of crypto.randomBytes(length * 2)) {
            if (byte < limit && out.length < length) out += alphabet[byte % alphabet.length];
        }
    }
    return out;
};

const newReportToken = () => randomFrom(TOKEN_ALPHABET, 12);
const newReportCode = () => randomFrom(CODE_ALPHABET, 4);

// Link for the QR on the memo, or null when REPORT_BASE_URL is not set.
const reportUrlFor = (order) => {
    const base = (process.env.REPORT_BASE_URL || "").trim().replace(/\/+$/, "");
    if (!base || !order || !order.reportToken) return null;
    return `${base}/r/${order.reportToken}`;
};

// Old orders get a token and code once (only adds two fields; updatedAt is left alone).
const ensureReportLinks = async () => {
    let done = 0;
    for (;;) {
        const batch = await Order.find({ reportToken: { $exists: false } }, { _id: 1 }).limit(1000).lean();
        if (batch.length === 0) break;
        await Order.bulkWrite(
            batch.map((o) => ({
                updateOne: {
                    filter: { _id: o._id, reportToken: { $exists: false } },
                    update: { $set: { reportToken: newReportToken(), reportCode: newReportCode() } },
                    timestamps: false,
                },
            })),
            { ordered: false, timestamps: false }
        );
        done += batch.length;
    }
    return done;
};

module.exports = { newReportToken, newReportCode, reportUrlFor, ensureReportLinks, CODE_ALPHABET };
