/**
 * Format contact for display. DB may store as number (no leading 0).
 * BD numbers: 9 or 10 digits without leading 0 → show with 0 prefix (e.g. 017...).
 * @param {string|number|null|undefined} contact - Raw contact from API/DB
 * @returns {string} Contact string safe for display
 */
export function formatContactForDisplay(contact) {
    if (contact === null || contact === undefined) return "";
    const str = String(contact).replace(/\D/g, "");
    if (!str) return String(contact);
    const needsLeadingZero = str.length >= 9 && str.length <= 10 && !str.startsWith("0");
    return needsLeadingZero ? "0" + str : str;
}
