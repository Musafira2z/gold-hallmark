// Bangladesh mobile numbers are 11 digits starting with 0 (01XXXXXXXXX).
// Old records saved them as numbers, which drops the leading 0 (1725275114).
// fixPhone gives the 11-digit text for those, and null when it can't be sure
// (already fine, empty, or an odd length) so the value is left alone.
const fixPhone = (value) => {
    if (value === null || value === undefined) return null;
    const text = String(value).trim();
    if (/^1\d{9}$/.test(text)) return `0${text}`;
    return null;
};

// The value to store: fixed when we are sure, otherwise as it came (as text).
const normalizePhone = (value) => {
    if (value === null || value === undefined || String(value).trim() === "") return value;
    return fixPhone(value) || String(value).trim();
};

module.exports = { fixPhone, normalizePhone };
