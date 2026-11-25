import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import { apiUrl } from "../context/UserContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { Button, Card, EmptyState, ErrorBox, Loading, PageHeader, Pager } from "../components/ui/index.jsx";
import { formatDay } from "../utils/format.js";

const PAGE_SIZE = 50;

// Shops (Plan 16): every shop customers bring orders for. The owner can rename a
// shop or merge two records that are really one shop.
function Shops() {
    const { isOwner } = useAuth();
    const [search, setSearch] = useState("");
    const [q, setQ] = useState("");
    const [page, setPage] = useState(1);
    const [data, setData] = useState(null);
    const [error, setError] = useState("");
    const [renaming, setRenaming] = useState(null); // { id, name }
    const [merging, setMerging] = useState(null);   // the shop that goes away
    const [mergeSearch, setMergeSearch] = useState("");
    const [candidates, setCandidates] = useState([]);
    const [target, setTarget] = useState(null);     // the shop that stays
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => {
            setQ(search.trim());
            setPage(1);
        }, 300);
        return () => clearTimeout(t);
    }, [search]);

    const load = useCallback(async () => {
        setError("");
        try {
            const res = await axios.get(`${apiUrl}/shops`, { params: { q: q || undefined, page, limit: PAGE_SIZE } });
            setData(res.data);
        } catch (err) {
            setError(err.response?.data?.error || "Could not load shops. Is the server running?");
        }
    }, [q, page]);

    useEffect(() => {
        load();
    }, [load]);

    // Shops to merge into, as the owner types.
    useEffect(() => {
        if (!merging) return undefined;
        const text = mergeSearch.trim();
        if (text.length < 2) {
            setCandidates([]);
            return undefined;
        }
        const t = setTimeout(async () => {
            try {
                const res = await axios.get(`${apiUrl}/shops`, { params: { q: text, limit: 8 } });
                setCandidates(res.data.shops.filter((s) => s._id !== merging._id));
            } catch {
                setCandidates([]);
            }
        }, 250);
        return () => clearTimeout(t);
    }, [mergeSearch, merging]);

    const startMerge = (shop) => {
        setRenaming(null);
        setMerging(shop);
        setTarget(null);
        setMergeSearch(shop.name.split(" ")[0] || "");
        window.scrollTo({ top: 0, behavior: "smooth" });
    };
    const stopMerge = () => {
        setMerging(null);
        setTarget(null);
        setCandidates([]);
    };

    const doMerge = async () => {
        setBusy(true);
        try {
            const res = await axios.post(`${apiUrl}/shops/merge`, { keep: target._id, drop: merging._id });
            toast.success(`Merged: ${res.data.moved} orders of "${merging.name}" are now under "${target.name}".`);
            stopMerge();
            load();
        } catch (err) {
            toast.error(err.response?.data?.error || "Merge failed. Nothing was changed.");
        } finally {
            setBusy(false);
        }
    };

    const saveName = async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
            await axios.put(`${apiUrl}/shops/${renaming.id}`, { name: renaming.name });
            toast.success("Shop name saved.");
            setRenaming(null);
            load();
        } catch (err) {
            toast.error(err.response?.data?.error || "Could not save the name.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="space-y-4">
            <PageHeader
                title="Shops"
                subtitle={isOwner
                    ? "Every shop customers bring orders for. Same shop written two ways? Use Merge."
                    : "Every shop customers bring orders for."}
            />

            {merging && (
                <Card bodyClassName="p-4 space-y-3" className="border-amber-300">
                    <p className="text-sm text-gray-800">
                        Merge <strong>{merging.name}</strong> ({merging.orders} orders) into another shop. Find the shop to keep:
                    </p>
                    <input
                        type="search"
                        value={mergeSearch}
                        onChange={(e) => {
                            setMergeSearch(e.target.value);
                            setTarget(null);
                        }}
                        placeholder="Type the other shop's name"
                        aria-label="Shop to keep"
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                        autoFocus
                    />
                    {!target && candidates.length > 0 && (
                        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                            {candidates.map((s) => (
                                <li key={s._id}>
                                    <button type="button" onClick={() => setTarget(s)} className="flex w-full justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-blue-50">
                                        <span className="font-medium text-gray-900">{s.name}</span>
                                        <span className="text-gray-500">{s.orders} orders</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                    {target && (
                        <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900" role="alert">
                            All {merging.orders} orders of <strong>{merging.name}</strong> will move to <strong>{target.name}</strong>.
                            Typing &quot;{merging.name}&quot; will find <strong>{target.name}</strong> from now on.
                        </div>
                    )}
                    <div className="flex gap-2">
                        <Button onClick={doMerge} disabled={!target || busy}>{busy ? "Merging…" : "Merge"}</Button>
                        <Button variant="secondary" onClick={stopMerge} disabled={busy}>Cancel</Button>
                    </div>
                </Card>
            )}

            <Card bodyClassName="p-4">
                <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search shop name"
                    aria-label="Search shops"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
            </Card>

            {error && <ErrorBox text={error} onRetry={load} />}

            <Card title={data ? `${data.total.toLocaleString("en-IN")} shops` : "Shops"} bodyClassName="">
                {!data && !error ? (
                    <Loading />
                ) : data && data.shops.length === 0 ? (
                    <EmptyState title="No shop found" hint="Try another spelling." />
                ) : data ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                                    <th className="px-4 py-2.5">Shop</th>
                                    <th className="px-4 py-2.5 text-right">Orders</th>
                                    <th className="px-4 py-2.5 text-right">Customers</th>
                                    <th className="px-4 py-2.5">Last order</th>
                                    {isOwner && <th className="px-4 py-2.5"><span className="sr-only">Actions</span></th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {data.shops.map((s) => (
                                    <tr key={s._id} className={merging?._id === s._id ? "bg-amber-50" : "hover:bg-gray-50"}>
                                        <td className="px-4 py-2.5">
                                            {renaming?.id === s._id ? (
                                                <form onSubmit={saveName} className="flex gap-2">
                                                    <input
                                                        value={renaming.name}
                                                        onChange={(e) => setRenaming({ ...renaming, name: e.target.value })}
                                                        aria-label="New shop name"
                                                        maxLength={80}
                                                        className="w-full rounded-lg border border-gray-300 px-2 py-1 text-sm"
                                                        autoFocus
                                                    />
                                                    <Button type="submit" size="sm" disabled={busy}>Save</Button>
                                                    <Button type="button" size="sm" variant="secondary" onClick={() => setRenaming(null)}>Cancel</Button>
                                                </form>
                                            ) : (
                                                <>
                                                    <Link to={`/orders?shop=${s._id}&shopName=${encodeURIComponent(s.name)}`} className="font-medium text-blue-700 hover:underline">
                                                        {s.name}
                                                    </Link>
                                                    {s.spellings.length > 0 && (
                                                        <span className="block text-xs text-gray-500">Also written: {s.spellings.join(" · ")}</span>
                                                    )}
                                                </>
                                            )}
                                        </td>
                                        <td className="px-4 py-2.5 text-right tabular-nums">{s.orders.toLocaleString("en-IN")}</td>
                                        <td className="px-4 py-2.5 text-right tabular-nums">{s.customers}</td>
                                        <td className="px-4 py-2.5 whitespace-nowrap text-gray-700">{s.lastOrder ? formatDay(s.lastOrder) : "—"}</td>
                                        {isOwner && (
                                            <td className="px-4 py-2.5">
                                                <div className="flex justify-end gap-2">
                                                    <Button size="sm" variant="secondary" onClick={() => { stopMerge(); setRenaming({ id: s._id, name: s.name }); }}>
                                                        Rename
                                                    </Button>
                                                    <Button size="sm" variant="secondary" onClick={() => startMerge(s)} aria-label={`Merge ${s.name} into another shop`}>
                                                        Merge…
                                                    </Button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : null}
            </Card>
            {data && data.pages > 1 && <Pager page={data.page} pages={data.pages} onChange={setPage} />}
        </div>
    );
}

export default Shops;
