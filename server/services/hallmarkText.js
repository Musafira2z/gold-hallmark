// Reads the "Hall Mark" text staff type for each item (Plan 15 / S2a).
// The text is the mark stamped on the jewellery: the shop's letters + the purity,
// e.g. "PJ 916", "MJL 22K", "916 A", "SHORNA J 916 K". The original text is always
// kept; this only adds two fields that can be counted and shown:
//   purity: "24K" | "22K" | "21K" | "18K" | "14K" | "925" (silver) | null (unclear)
//   stamp:  the shop letters, e.g. "PJ", "SHORNA J" ("" if none)
// Raise PARSE_VERSION whenever the rules change: old orders are read again on start.
const PARSE_VERSION = 2; // 2: a dot also separates ("916.A", "22K.T")

const PURITY_PERCENT = { "24K": 99.9, "22K": 91.6, "21K": 87.5, "18K": 75, "14K": 58.5, "925": 92.5 };

// Karat number + K/KT/CT/C/T ("22K", "22 CT", "21T", "18.K"), or the fineness number.
const KARAT_SUFFIX = "(?:K|KT|CT|C|T)";
const RULES = [
    ["24K", new RegExp(`^(?:999|24\\.?${KARAT_SUFFIX})$`)],
    ["22K", new RegExp(`^(?:916|9\\*16|22\\.?${KARAT_SUFFIX})$`)],
    ["21K", new RegExp(`^(?:875|21\\.?${KARAT_SUFFIX})$`)],
    ["18K", new RegExp(`^(?:750|18\\.?${KARAT_SUFFIX})$`)],
    ["14K", new RegExp(`^(?:585|14\\.?${KARAT_SUFFIX})$`)],
    ["925", /^925$/],
];
const FINENESS = /^(?:999|916|875|750|585|925)$/;
const SUFFIX_ONLY = new RegExp(`^${KARAT_SUFFIX}$`);

const purityOf = (token) => {
    for (const [code, re] of RULES) if (re.test(token)) return code;
    return null;
};

const readHallmark = (text) => {
    const raw = typeof text === "string" ? text : "";
    // "SJ916" -> "SJ 916"; separators (also ".") become spaces: "916.A" -> "916 A", "18.K" -> "18 K".
    const tokens = raw.toUpperCase().replace(/([A-Z])(\d)/g, "$1 $2").split(/[\s.,/\\|_-]+/).filter(Boolean);
    let purity = null;
    const used = new Set();
    for (let i = 0; i < tokens.length && !purity; i += 1) {
        const next = tokens[i + 1];
        // "22 K" / "916 K": number followed by a karat letter.
        if (next && SUFFIX_ONLY.test(next)) {
            const joined = purityOf(tokens[i] + next) || (FINENESS.test(tokens[i]) ? purityOf(tokens[i]) : null);
            if (joined) {
                purity = joined;
                used.add(i).add(i + 1);
                break;
            }
        }
        const single = purityOf(tokens[i]);
        if (single) {
            purity = single;
            used.add(i);
        }
    }
    // Stamp: leftover words that start with a letter ("1", "2.91", "2K" are not a shop mark).
    const stamp = tokens.filter((t, i) => !used.has(i) && /^[A-Z]/.test(t)).join(" ").slice(0, 40);
    return { purity, stamp };
};

// Adds purity + stamp to each item (from its `xray` text). Returns new item objects.
const withPurity = (items) =>
    (Array.isArray(items) ? items : []).map((it) => {
        const plain = it && typeof it.toObject === "function" ? it.toObject() : { ...it };
        return { ...plain, ...readHallmark(plain.xray) };
    });

module.exports = { readHallmark, withPurity, PURITY_PERCENT, PARSE_VERSION };
