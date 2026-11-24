// Shop name -> key (Plan 16). Two names with the same key are the same shop.
// Only safe changes: case, spaces, punctuation, and common words that staff spell
// several ways. Two really different names never get the same key by guessing.
const WORD_FIX = {
    JEWLLERS: "JEWELLERS",
    JEWELLRS: "JEWELLERS",
    JEWELLARS: "JEWELLERS",
    JEWELLERE: "JEWELLERS",
    JEWELERS: "JEWELLERS",
    JEWELLER: "JEWELLERS",
    JEWLERS: "JEWELLERS",
    JEWELLEARS: "JEWELLERS",
    JEWELLRES: "JEWELLERS",
    JWELLER: "JEWELLERS",
    JWELLERS: "JEWELLERS",
    SORNO: "SHORNO",
    SILPALOY: "SHILPALOY",
    SILPALAY: "SHILPALOY",
    SHILPALAY: "SHILPALOY",
    SHILPALO: "SHILPALOY",
    SHOLPALOY: "SHILPALOY",
};

// Typed when there is no shop.
const NO_SHOP = /^(NIL+|NULL|NONE|NO|N\/?A|-+|0+|\.+|X+)$/;

const shopKey = (name) => {
    const raw = typeof name === "string" ? name.trim().toUpperCase() : "";
    if (!raw || NO_SHOP.test(raw)) return null;
    const words = raw.replace(/&/g, " AND ").replace(/[^A-Z0-9]+/g, " ").trim().split(" ").filter(Boolean);
    if (words.length === 0) return null;
    return words.map((w) => WORD_FIX[w] || w).join(" ");
};

// How a typed name is shown: extra spaces and a trailing dot removed.
const tidyName = (name) => String(name || "").replace(/\s+/g, " ").trim().replace(/\.+$/, "").trim().slice(0, 80);

module.exports = { shopKey, tidyName };
