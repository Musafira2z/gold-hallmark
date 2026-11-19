// Shared display helpers. The shop is in Bangladesh (UTC+6, no daylight saving).
const DHAKA_MS = 6 * 60 * 60 * 1000;

// Today's date in Dhaka as "2026-11-19".
export const dhakaToday = () => new Date(Date.now() + DHAKA_MS).toISOString().slice(0, 10);

// This month in Dhaka as "2026-11".
export const dhakaMonth = () => dhakaToday().slice(0, 7);

export const taka = (value) => `৳${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export const formatDay = (value) =>
    new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Dhaka" });

export const formatTime = (value) =>
    new Date(value).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Dhaka" });

// "2026-11" -> "Nov 2026"
export const formatMonth = (month) => {
    const [y, m] = month.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
};

// "2026-11-19" -> "Thu 19"
export const formatShortDay = (day) =>
    new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", timeZone: "UTC" });
