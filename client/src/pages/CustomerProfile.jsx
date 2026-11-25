import React, { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import PropTypes from "prop-types";
import { apiUrl } from "../context/UserContext.jsx";
import { formatContactForDisplay } from "../utils/formatContact.js";
import UpdateUserModal from "../components/UpdateUserModal.jsx";
import CustomerPayments from "../components/CustomerPayments.jsx";
import CustomerPortal from "../components/CustomerPortal.jsx";
import AuthImage from "../components/AuthImage.jsx";

const TZ = "Asia/Dhaka";
const PAGE_SIZE = 50;

const taka = (n) => `৳${Number(n || 0).toLocaleString("en-IN")}`;

const monthName = (key, style = "long") => {
    if (!key) return "";
    const [y, m] = key.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, 15)).toLocaleString("en-GB", { month: style, year: "numeric", timeZone: "UTC" });
};
const monthShort = (key) => {
    const [y, m] = key.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, 15)).toLocaleString("en-GB", { month: "short", timeZone: "UTC" });
};

const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: TZ }) : "";
const fmtTime = (d) =>
    d ? new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: TZ }) : "";

const daysAgo = (d) => {
    if (!d) return null;
    const key = (x) => new Date(x).toLocaleDateString("en-CA", { timeZone: TZ });
    return Math.round((new Date(key(new Date())) - new Date(key(d))) / 86400000);
};
const lastVisitText = (d) => {
    const n = daysAgo(d);
    if (n === null) return "No orders yet";
    if (n === 0) return "Last visit: today";
    if (n === 1) return "Last visit: yesterday";
    return `Last visit: ${n} days ago`;
};

const initials = (name = "") =>
    name.split(/\s+/).filter(Boolean).slice(-2).map((w) => w[0]).join("").toUpperCase() || "?";

const itemSummary = (items = []) =>
    items
        .filter((i) => i && i.item)
        .map((i) => `${i.item} ×${i.quantity ?? 1}`)
        .join(", ") || "—";

const weightSummary = (items = []) => {
    const total = items.reduce((s, i) => s + (Number(i?.weight) || 0), 0);
    return total > 0 ? `${total.toFixed(2)} g` : "";
};

function StatBox({ label, amount, sub }) {
    return (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{taka(amount)}</p>
            <p className="text-sm text-gray-500 mt-1">{sub}</p>
        </div>
    );
}

StatBox.propTypes = {
    label: PropTypes.string.isRequired,
    amount: PropTypes.number,
    sub: PropTypes.string,
};

// Customer type (Plan 16). Staff choose it; the page only suggests.
const KINDS = [
    { value: "", label: "Type not set" },
    { value: "shop_owner", label: "Shop owner" },
    { value: "karigor", label: "Karigor" },
    { value: "other", label: "Other" },
];
function CustomerKind({ customer, shopCount, onSaved }) {
    const [kind, setKind] = useState(customer.kind || "");
    const [saving, setSaving] = useState(false);
    useEffect(() => setKind(customer.kind || ""), [customer.kind]);
    const save = async (next) => {
        const before = kind;
        setKind(next);
        setSaving(true);
        try {
            await axios.put(`${apiUrl}/users/${customer.customerID}/kind`, { kind: next });
            onSaved?.();
        } catch (err) {
            setKind(before);
            window.alert(err.response?.data?.error || "Could not save the type.");
        } finally {
            setSaving(false);
        }
    };
    const hint = !kind && shopCount >= 3 ? `Brought orders for ${shopCount} shops: probably a karigor` : "";
    return (
        <div className="flex flex-wrap items-center gap-2 mt-2">
            <select
                value={kind}
                disabled={saving}
                onChange={(e) => save(e.target.value)}
                aria-label="Customer type"
                className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${kind ? "border-blue-300 bg-blue-50 text-blue-800" : "border-dashed border-gray-300 bg-white text-gray-500"}`}
            >
                {KINDS.map((k) => (
                    <option key={k.value} value={k.value}>{k.label}</option>
                ))}
            </select>
            {hint && (
                <button type="button" onClick={() => save("karigor")} className="text-xs text-amber-700 hover:underline">
                    {hint}. Set Karigor?
                </button>
            )}
        </div>
    );
}
CustomerKind.propTypes = {
    customer: PropTypes.object.isRequired,
    shopCount: PropTypes.number,
    onSaved: PropTypes.func,
};

const CustomerProfile = () => {
    const { customerID } = useParams();

    const [profile, setProfile] = useState(null);
    const [profileError, setProfileError] = useState(null);
    const [orders, setOrders] = useState({ orders: [], total: 0, page: 1, pages: 1 });
    const [ordersLoading, setOrdersLoading] = useState(true);
    const [month, setMonth] = useState("");
    const [company, setCompany] = useState("");
    const [page, setPage] = useState(1);
    const [editOpen, setEditOpen] = useState(false);

    const loadProfile = useCallback(async () => {
        try {
            setProfileError(null);
            const res = await axios.get(`${apiUrl}/users/${encodeURIComponent(customerID)}/profile`);
            setProfile(res.data);
        } catch (err) {
            setProfileError(err.response?.status === 404 ? "notfound" : "error");
        }
    }, [customerID]);

    useEffect(() => {
        setProfile(null);
        setMonth("");
        setCompany("");
        setPage(1);
        loadProfile();
    }, [loadProfile]);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setOrdersLoading(true);
            try {
                const params = { customerID, page, limit: PAGE_SIZE };
                if (month) params.month = month;
                if (company) params.shop = company; // shop record id
                const res = await axios.get(`${apiUrl}/orders`, { params });
                if (!cancelled) setOrders(res.data);
            } catch (err) {
                console.error("Error loading customer orders:", err);
                if (!cancelled) setOrders({ orders: [], total: 0, page: 1, pages: 1, error: true });
            } finally {
                if (!cancelled) setOrdersLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [customerID, month, company, page]);

    if (profileError === "notfound") {
        return (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <p className="text-lg font-semibold text-gray-800">Customer #{customerID} not found</p>
                <Link to="/add-customer" className="text-blue-700 hover:underline mt-2 inline-block">
                    Back to the customer list
                </Link>
            </div>
        );
    }
    if (profileError) {
        return (
            <div className="bg-white rounded-xl border border-red-200 p-8 text-center text-red-700">
                Profile load hoy ni. Server chalu ache kina dekhun.{" "}
                <button onClick={loadProfile} className="underline">Try again</button>
            </div>
        );
    }
    if (!profile) {
        return <div className="p-8 text-center text-gray-500">Load hocche...</div>;
    }

    const { customer, stats } = profile;
    const since = [customer.createdAt, stats.lifetime.firstOrder].filter(Boolean).sort()[0];
    const maxBar = Math.max(1, ...stats.lastSixMonths.map((m) => m.orders));
    const busiest = stats.lastSixMonths.reduce((a, b) => (b.orders > a.orders ? b : a), stats.lastSixMonths[0]);
    const companies = stats.companies.filter((c) => c.id && c.name);

    const changeFilter = (setter) => (e) => {
        setter(e.target.value);
        setPage(1);
    };

    return (
        <div className="space-y-5 max-w-7xl">
            <nav className="text-sm text-gray-500">
                <Link to="/add-customer" className="hover:text-blue-700">Customers</Link>
                <span className="mx-2">›</span>
                <span className="text-gray-800">{customer.name}</span>
            </nav>

            {/* Customer header */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col lg:flex-row lg:items-center gap-5">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                    <AuthImage
                        image={customer.image}
                        alt=""
                        className="w-16 h-16 rounded-full object-cover border border-gray-200"
                        fallback={
                            <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-xl font-bold">
                                {initials(customer.name)}
                            </div>
                        }
                    />
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
                            <span className="text-sm font-semibold bg-blue-50 text-blue-800 px-2 py-0.5 rounded">
                                ID {customer.customerID}
                            </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-0.5">{lastVisitText(stats.lifetime.lastOrder)}</p>
                        <CustomerKind customer={customer} shopCount={companies.length} onSaved={loadProfile} />
                        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-700 mt-2">
                            {customer.contact && <span>{formatContactForDisplay(customer.contact)}</span>}
                            {customer.address && <span>{customer.address}</span>}
                            {since && <span>Customer since {monthName(new Date(since).toISOString().slice(0, 7), "short")}</span>}
                        </div>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Link
                        to={`/hallmark?customer=${customer.customerID}`}
                        className="px-4 py-2 rounded-lg bg-blue-700 text-white font-semibold hover:bg-blue-800"
                    >
                        + Hallmark order
                    </Link>
                    <Link
                        to={`/xray?customer=${customer.customerID}`}
                        className="px-4 py-2 rounded-lg bg-purple-700 text-white font-semibold hover:bg-purple-800"
                    >
                        + X-ray order
                    </Link>
                    <button
                        onClick={() => setEditOpen(true)}
                        className="px-4 py-2 rounded-lg border border-gray-300 text-gray-800 font-semibold hover:bg-gray-50"
                    >
                        Edit
                    </button>
                </div>
            </div>

            {/* Numbers */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatBox
                    label={`This month (${monthShort(stats.thisMonth.month)})`}
                    amount={stats.thisMonth.amount}
                    sub={`${stats.thisMonth.orders} orders · ${stats.thisMonth.pieces} pcs`}
                />
                <StatBox
                    label={`Last month (${monthShort(stats.lastMonth.month)})`}
                    amount={stats.lastMonth.amount}
                    sub={`${stats.lastMonth.orders} orders · ${stats.lastMonth.pieces} pcs`}
                />
                <StatBox
                    label="All time"
                    amount={stats.lifetime.amount}
                    sub={`${stats.lifetime.orders} orders${since ? ` · since ${monthName(new Date(since).toISOString().slice(0, 7), "short")}` : ""}`}
                />
            </div>

            <CustomerPayments customerID={customerID} balance={profile.balance} />

            {profile.portal && (
                <CustomerPortal
                    customer={customer}
                    portal={profile.portal}
                    shopChoices={[
                        ...profile.portal.shops,
                        ...companies.filter((c) => !profile.portal.shops.some((s) => s.id === c.id)).map((c) => ({ id: c.id, name: c.name })),
                    ]}
                    onChange={loadProfile}
                />
            )}

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                {/* Order history */}
                <div className="xl:col-span-2 bg-white rounded-xl border border-gray-200">
                    <div className="p-4 border-b border-gray-200 flex flex-wrap items-end gap-3">
                        <h2 className="text-lg font-bold text-gray-900 mr-auto">Order history</h2>
                        <label className="text-sm text-gray-600">
                            Month
                            <select
                                value={month}
                                onChange={changeFilter(setMonth)}
                                className="ml-2 border border-gray-300 rounded-lg px-2 py-1.5 text-gray-900"
                            >
                                <option value="">All months</option>
                                {stats.months.map((m) => (
                                    <option key={m.month} value={m.month}>
                                        {monthName(m.month)} ({m.orders})
                                    </option>
                                ))}
                            </select>
                        </label>
                        {companies.length > 1 && (
                            <label className="text-sm text-gray-600">
                                Shop
                                <select
                                    value={company}
                                    onChange={changeFilter(setCompany)}
                                    className="ml-2 border border-gray-300 rounded-lg px-2 py-1.5 text-gray-900 max-w-[14rem]"
                                >
                                    <option value="">All shops ({companies.length})</option>
                                    {companies.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        )}
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-600 uppercase">
                                    <th className="px-4 py-3">Date</th>
                                    <th className="px-4 py-3">Memo</th>
                                    <th className="px-4 py-3">Shop</th>
                                    <th className="px-4 py-3">Item</th>
                                    <th className="px-4 py-3">Type</th>
                                    <th className="px-4 py-3 text-right">Taka</th>
                                    <th className="px-4 py-3"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {ordersLoading ? (
                                    <tr><td colSpan="7" className="px-4 py-8 text-center text-gray-500">Load hocche...</td></tr>
                                ) : orders.error ? (
                                    <tr><td colSpan="7" className="px-4 py-8 text-center text-red-700">Order load hoy ni</td></tr>
                                ) : orders.orders.length === 0 ? (
                                    <tr><td colSpan="7" className="px-4 py-8 text-center text-gray-500">No orders</td></tr>
                                ) : (
                                    orders.orders.map((o) => (
                                        <tr key={o._id} className="hover:bg-gray-50 align-top">
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <div className="text-gray-900">{fmtDate(o.createdAt)}</div>
                                                <div className="text-xs text-gray-500">{fmtTime(o.createdAt)}</div>
                                            </td>
                                            <td className="px-4 py-3 text-gray-700">{o.voucher ? `#${o.voucher}` : "—"}</td>
                                            <td className="px-4 py-3 text-gray-700">{o.company || "—"}</td>
                                            <td className="px-4 py-3">
                                                <div className="text-gray-900">{itemSummary(o.items)}</div>
                                                <div className="text-xs text-gray-500">{weightSummary(o.items)}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                {o.type === "xray" ? (
                                                    <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 text-xs font-semibold">X-ray</span>
                                                ) : o.type === "hallmark" ? (
                                                    <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-xs font-semibold">Hallmark</span>
                                                ) : (
                                                    <span className="text-gray-400">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right font-semibold text-gray-900">{taka(o.totalAmount)}</td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <Link
                                                    to={`/invoice/${o._id}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-blue-700 hover:underline"
                                                >
                                                    Memo
                                                </Link>
                                                <Link
                                                    to={`/orders/${o._id}/edit`}
                                                    className="ml-3 text-blue-700 hover:underline"
                                                >
                                                    Edit
                                                </Link>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="p-4 border-t border-gray-200 flex items-center justify-between text-sm text-gray-600">
                        <span>
                            {orders.total} order
                            {orders.pages > 1 && ` · page ${orders.page} / ${orders.pages}`}
                        </span>
                        {orders.pages > 1 && (
                            <div className="flex gap-2">
                                <button
                                    disabled={page <= 1}
                                    onClick={() => setPage((p) => p - 1)}
                                    className="px-3 py-1.5 rounded-lg border border-gray-300 disabled:opacity-40"
                                >
                                    ← Previous
                                </button>
                                <button
                                    disabled={page >= orders.pages}
                                    onClick={() => setPage((p) => p + 1)}
                                    className="px-3 py-1.5 rounded-lg border border-gray-300 disabled:opacity-40"
                                >
                                    Next →
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Side panels */}
                <div className="space-y-5">
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                        <h2 className="text-lg font-bold text-gray-900">Last 6 months</h2>
                        <div className="flex items-end gap-3 h-36 mt-4">
                            {stats.lastSixMonths.map((m, i) => (
                                <div key={m.month} className="flex-1 flex flex-col items-center justify-end h-full">
                                    <span className="text-xs text-gray-700 mb-1">{m.orders}</span>
                                    <div
                                        className={`w-full rounded-t ${i === stats.lastSixMonths.length - 1 ? "bg-blue-700" : "bg-blue-300"}`}
                                        style={{ height: `${Math.round((m.orders / maxBar) * 92)}px`, minHeight: m.orders ? 2 : 0 }}
                                        title={`${monthName(m.month)}: ${m.orders} order, ${taka(m.amount)}`}
                                    />
                                    <span className="text-xs text-gray-500 mt-1">{monthShort(m.month)}</span>
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-gray-500 mt-3">
                            Bars show number of orders.
                            {busiest.orders > 0 && ` ${monthShort(busiest.month)} was the busiest (${busiest.orders}).`}
                        </p>
                    </div>

                    {companies.length > 0 && (
                        <div className="bg-white rounded-xl border border-gray-200 p-4">
                            <h2 className="text-lg font-bold text-gray-900">Shops ({companies.length})</h2>
                            <ul className="mt-3 space-y-2 text-sm">
                                {companies.slice(0, 8).map((c) => (
                                    <li key={c.id} className="flex justify-between gap-3">
                                        <button
                                            onClick={() => {
                                                setCompany(c.id);
                                                setPage(1);
                                            }}
                                            className="text-left text-blue-700 hover:underline truncate"
                                        >
                                            {c.name}
                                        </button>
                                        <span className="text-gray-500 whitespace-nowrap">{c.orders} order</span>
                                    </li>
                                ))}
                            </ul>
                            {companies.length > 8 && (
                                <p className="text-xs text-gray-500 mt-2">{companies.length - 8} more shops. Use the Shop filter above.</p>
                            )}
                        </div>
                    )}

                    {stats.topItems.length > 0 && (
                        <div className="bg-white rounded-xl border border-gray-200 p-4">
                            <h2 className="text-lg font-bold text-gray-900">Beshi ana item</h2>
                            <ul className="mt-3 space-y-2 text-sm">
                                {stats.topItems.map((t) => (
                                    <li key={t.item} className="flex justify-between">
                                        <span className="text-gray-800">{t.item}</span>
                                        <span className="text-gray-500">{t.quantity}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>

            {editOpen && (
                <UpdateUserModal
                    isOpen={editOpen}
                    onClose={() => {
                        setEditOpen(false);
                        loadProfile();
                    }}
                    customerId={customer._id}
                />
            )}
        </div>
    );
};

export default CustomerProfile;
