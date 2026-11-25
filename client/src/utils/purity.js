// Purity names for the memo. Keep the same as the online report (online/views/pages.js).
export const PURITY = {
    "24K": { label: "24K", pct: "99.9%" },
    "22K": { label: "22K", pct: "91.6%" },
    "21K": { label: "21K", pct: "87.5%" },
    "18K": { label: "18K", pct: "75.0%" },
    "14K": { label: "14K", pct: "58.5%" },
    "925": { label: "Silver 925", pct: "92.5%" },
};

// "22K · 91.6%" for an item whose purity was read, or null.
export const purityText = (item) => {
    const p = PURITY[item?.purity];
    return p ? `${p.label} · ${p.pct}` : null;
};
