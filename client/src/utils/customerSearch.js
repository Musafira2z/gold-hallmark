import { formatContactForDisplay } from "./formatContact.js";

const digits = (v) => String(v ?? "").replace(/\D/g, "");

// Match name, exact ID, phone (with or without the leading 0) or shop name.
export const matchesCustomer = (c, q) => {
    const text = q.trim().toLowerCase();
    if (!text) return true;
    if (String(c.name || "").toLowerCase().includes(text)) return true;
    if (String(c.customerID) === text) return true;
    const companies = Array.isArray(c.company) ? c.company : [c.company];
    if (companies.some((co) => String(co || "").toLowerCase().includes(text))) return true;
    const qd = digits(text);
    // Phone is shown with its leading 0 even when the DB lost it, so "0171..." and "171..." both match.
    return qd.length >= 3 && digits(formatContactForDisplay(c.contact)).includes(qd);
};

// Search results: exact ID first, then newest customers.
export const searchCustomers = (customers, q, limit = Infinity) => {
    const text = q.trim();
    const exactId = (c) => String(c.customerID) === text;
    const found = customers.filter((c) => matchesCustomer(c, text));
    found.sort((a, b) => exactId(b) - exactId(a) || Number(b.customerID) - Number(a.customerID));
    return found.slice(0, limit);
};

export const companyText = (company) => (Array.isArray(company) ? company.filter(Boolean).join(", ") : company || "");
