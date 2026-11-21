import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import { apiUrl } from "../context/UserContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { Button, Card, EmptyState, ErrorBox, Loading, PageHeader, Pager } from "../components/ui/index.jsx";
import OrderTable from "../components/OrderTable.jsx";
import { dhakaMonth, dhakaToday, formatDay, formatMonth, taka } from "../utils/format.js";

const PAGE_SIZE = 50;

// All orders, 50 per page, fetched from the server with filters.
// Filters live in the URL (?day=2026-11-19&type=xray&q=441) so a link or
// the browser Back button keeps them. ?day=today means today in Dhaka.
function Orders() {
    const [params, setParams] = useSearchParams();
    const { isOwner } = useAuth();
    const showDeleted = isOwner && params.get("deleted") === "only";
    const dayParam = params.get("day");
    const day = dayParam === "today" ? dhakaToday() : dayParam || "";
    const month = params.get("month") || "";
    const type = params.get("type") || "";
    const q = params.get("q") || "";
    const page = Math.max(1, Number(params.get("page")) || 1);

    const [search, setSearch] = useState(q);
    const [data, setData] = useState(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);

    const update = useCallback(
        (changes) => {
            const next = new URLSearchParams(params);
            Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
            if (!("page" in changes)) next.delete("page");
            setParams(next, { replace: true });
        },
        [params, setParams]
    );

    // Typing in the search box updates the URL after a short pause.
    useEffect(() => {
        if (search === q) return undefined;
        const t = setTimeout(() => update({ q: search.trim() }), 350);
        return () => clearTimeout(t);
    }, [search, q, update]);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const query = { page, limit: PAGE_SIZE };
            if (day) query.day = day;
            else if (month) query.month = month;
            if (type) query.type = type;
            if (q) query.q = q;
            if (showDeleted) query.deleted = "only";
            const res = await axios.get(`${apiUrl}/orders`, { params: query });
            setData(res.data);
        } catch (err) {
            console.error("Error fetching orders:", err);
            setError(err.response?.data?.error || "Could not load orders. Is the server running?");
        } finally {
            setLoading(false);
        }
    }, [day, month, type, q, page, showDeleted]);

    useEffect(() => {
        load();
    }, [load]);

    const handleDelete = async (order) => {
        const label = `memo ${order.voucher ?? ""} for ${order.name || "this customer"}`;
        if (!window.confirm(`Delete ${label}?\n\nIt leaves all lists and totals. You can bring it back from "Deleted".`)) return;
        try {
            await axios.delete(`${apiUrl}/orders/${order._id}`);
            toast.success(`Deleted ${label}`);
            load();
        } catch (err) {
            console.error("Error deleting order:", err);
            toast.error("Delete failed. Nothing was removed.");
        }
    };

    const handleRestore = async (order) => {
        try {
            await axios.post(`${apiUrl}/orders/${order._id}/restore`);
            toast.success(`Memo ${order.voucher ?? ""} is back.`);
            load();
        } catch (err) {
            toast.error(err.response?.data?.message || err.response?.data?.error || "Restore failed.");
        }
    };

    const today = dhakaToday();
    const thisMonth = dhakaMonth();
    const when = day === today ? "today" : !day && month === thisMonth ? "month" : !day && !month ? "all" : "custom";
    const chip = (active) =>
        `rounded-lg px-3 py-1.5 text-sm font-medium border ${active ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`;

    const periodText = day ? formatDay(`${day}T00:00:00+06:00`) : month ? formatMonth(month) : "All time";

    return (
        <div className="space-y-4">
            <PageHeader title="Orders" subtitle="Find any memo by date, type, memo number, customer ID, name or phone." />

            <Card bodyClassName="p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                    <button type="button" className={chip(when === "today")} onClick={() => update({ day: today, month: "" })}>
                        Today
                    </button>
                    <button type="button" className={chip(when === "month")} onClick={() => update({ day: "", month: thisMonth })}>
                        This month
                    </button>
                    <button type="button" className={chip(when === "all")} onClick={() => update({ day: "", month: "" })}>
                        All
                    </button>
                    <label className="flex items-center gap-2 text-sm text-gray-600">
                        <span>Date</span>
                        <input
                            type="date"
                            value={day}
                            max={today}
                            onChange={(e) => update({ day: e.target.value, month: "" })}
                            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                        />
                    </label>
                    <select
                        value={type}
                        onChange={(e) => update({ type: e.target.value })}
                        aria-label="Order type"
                        className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                    >
                        <option value="">Hallmark + X-ray</option>
                        <option value="hallmark">Hallmark only</option>
                        <option value="xray">X-ray only</option>
                    </select>
                    {isOwner && (
                        <button type="button" className={`${chip(showDeleted)} ml-auto`} onClick={() => update({ deleted: showDeleted ? "" : "only" })}>
                            {showDeleted ? "← Back to orders" : "Deleted"}
                        </button>
                    )}
                </div>
                <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Memo number, customer ID, phone, name or shop"
                    aria-label="Search orders"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
            </Card>

            {error && <ErrorBox text={error} onRetry={load} />}

            <Card
                title={
                    data ? (
                        <span>
                            {showDeleted && <span className="text-red-700">Deleted · </span>}
                            {periodText}: {data.total.toLocaleString("en-IN")} orders ·{" "}
                            <span className="text-gray-900">{taka(data.amount)}</span>
                        </span>
                    ) : (
                        periodText
                    )
                }
                bodyClassName=""
            >
                {loading && !data ? (
                    <Loading />
                ) : data && data.orders.length > 0 ? (
                    <div className={loading ? "opacity-50" : ""}>
                        <OrderTable orders={data.orders} showDate={!day} onDelete={isOwner ? handleDelete : undefined} onRestore={isOwner ? handleRestore : undefined} />
                        <Pager page={data.page} pages={data.pages} onChange={(p) => update({ page: String(p) })} />
                    </div>
                ) : (
                    !error && (
                        <EmptyState
                            title="No orders found"
                            hint={q ? `Nothing matches "${q}" here. Try "All" or clear the search.` : "Try another date."}
                            action={
                                (q || type || day || month) && (
                                    <Button variant="secondary" onClick={() => { setSearch(""); setParams({}, { replace: true }); }}>
                                        Clear filters
                                    </Button>
                                )
                            }
                        />
                    )
                )}
            </Card>
        </div>
    );
}

export default Orders;
