import { useContext, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import { apiUrl, UserContext } from "../context/UserContext.jsx";
import useItemNames from "../hooks/useItemNames.js";
import { Button, Card, ErrorBox, Loading, PageHeader, TypeBadge } from "../components/ui/index.jsx";
import { formatDay, formatTime, taka } from "../utils/format.js";

const UNITS = ["gm", "ana", "point", "vori/tola"];
const isNumberLike = (text) => /^\s*\d+([.,]\d+)?\s*$/.test(text || "");
const num = (v) => (v === "" || v === null || v === undefined ? NaN : Number(v));
const amountOf = (row) => {
    const q = num(row.quantity);
    const r = num(row.rate);
    return Number.isFinite(q) && Number.isFinite(r) ? Math.round(q * r * 100) / 100 : 0;
};
const toRow = (item) => ({
    item: item.item || "",
    quantity: item.quantity ?? "",
    rate: item.rate ?? "",
    weight: item.weight ?? "",
    weightUnite: item.weightUnite || "gm",
    xray: item.xray || "",
});
const emptyRow = () => toRow({});

// First problem in the rows, as { index, field, text }, or null.
const findProblem = (rows) => {
    if (rows.length === 0) return { index: 0, field: "item", text: "Add at least one item." };
    for (let i = 0; i < rows.length; i += 1) {
        const r = rows[i];
        const label = `Item ${i + 1}${r.item.trim() ? ` (${r.item.trim()})` : ""}`;
        if (!r.item.trim()) return { index: i, field: "item", text: `${label}: choose the item name.` };
        if (isNumberLike(r.item)) return { index: i, field: "item", text: `${label}: a number is not an item name.` };
        if (!(num(r.quantity) > 0)) return { index: i, field: "quantity", text: `${label}: enter Quantity.` };
        if (!(num(r.rate) >= 0)) return { index: i, field: "rate", text: `${label}: enter Rate.` };
    }
    return null;
};

const FIELDS = ["item", "quantity", "rate", "weight", "weightUnite", "xray"];
const focusCell = (index, field) => document.querySelector(`[data-cell="${index}-${field}"]`)?.focus();

// Edit an order's items and shop (BUGS F1). Customer, memo number, date and
// type stay the same. The server keeps the version before each edit.
function EditOrder() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { customers } = useContext(UserContext);
    const [order, setOrder] = useState(null);
    const [rows, setRows] = useState([]);
    const [company, setCompany] = useState("");
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);
    const { itemOptions } = useItemNames(order?.type || "hallmark");

    useEffect(() => {
        axios
            .get(`${apiUrl}/orders/${id}`)
            .then((res) => {
                setOrder(res.data);
                setRows((res.data.items || []).map(toRow));
                setCompany(res.data.company || "");
            })
            .catch((err) => setError(err.response?.status === 404 ? "This order was not found." : "Could not load the order."));
    }, [id]);

    const itemNames = useMemo(() => itemOptions.map((o) => o.label).filter((n) => !isNumberLike(n)), [itemOptions]);
    const shops = useMemo(() => {
        const customer = customers.find((c) => String(c.customerID) === String(order?.customerID));
        const list = Array.isArray(customer?.company) ? customer.company.filter(Boolean) : [];
        return company && !list.includes(company) ? [company, ...list] : list;
    }, [customers, order, company]);
    const total = rows.reduce((sum, r) => sum + amountOf(r), 0);

    const change = (index, field, value) =>
        setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
    const addRow = () => {
        setRows((prev) => [...prev, emptyRow()]);
        setTimeout(() => focusCell(rows.length, "item"), 0);
    };
    const removeRow = (index) => setRows((prev) => prev.filter((_, i) => i !== index));

    // Enter = next box; Enter in the last box of the last row adds a new row.
    const onCellKeyDown = (index, field, event) => {
        if (event.key !== "Enter" || event.ctrlKey || event.metaKey) return;
        event.preventDefault();
        const next = FIELDS[FIELDS.indexOf(field) + 1];
        if (next) focusCell(index, next);
        else if (index + 1 < rows.length) focusCell(index + 1, "item");
        else addRow();
    };

    const save = async (print) => {
        if (saving) return;
        const problem = findProblem(rows);
        if (problem) {
            toast.warn(problem.text);
            focusCell(problem.index, problem.field);
            return;
        }
        setSaving(true);
        try {
            const res = await axios.put(`${apiUrl}/orders/${id}`, {
                company,
                items: rows.map((r) => ({
                    item: r.item.trim(),
                    quantity: num(r.quantity),
                    rate: num(r.rate),
                    weight: r.weight === "" ? null : num(r.weight),
                    weightUnite: r.weightUnite,
                    xray: r.xray,
                })),
            });
            toast.success(`Memo ${res.data.voucher ?? ""} updated. Total ${taka(res.data.totalAmount)}.`);
            if (print) window.open(`/invoice/${id}`, "_blank");
            navigate(-1);
        } catch (err) {
            console.error("Error updating order:", err);
            toast.error(err.response?.data?.error || "Order was NOT updated. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    const onKeyDownPage = (event) => {
        if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            save(false);
        }
    };

    if (error) return <ErrorBox text={error} />;
    if (!order) return <Loading />;

    const cell = "w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200";

    return (
        <div className="space-y-4" onKeyDown={onKeyDownPage}>
            <PageHeader
                title={`Edit memo ${order.voucher ?? ""}`}
                subtitle={
                    <>
                        {formatDay(order.createdAt)}, {formatTime(order.createdAt)} · <TypeBadge type={order.type} />
                        {order.editedAt && <> · last edited {formatDay(order.editedAt)}</>}
                    </>
                }
                actions={<Button variant="secondary" onClick={() => navigate(-1)}>Cancel</Button>}
            />

            <Card>
                <div className="flex flex-wrap items-end gap-6 text-sm">
                    <div>
                        <p className="text-gray-500">Customer</p>
                        <Link to={`/customers/${order.customerID}`} className="font-semibold text-blue-700 hover:underline">
                            #{order.customerID} {order.name}
                        </Link>
                    </div>
                    <label className="block">
                        <span className="text-gray-500">Shop</span>
                        <select value={company} onChange={(e) => setCompany(e.target.value)} className={`${cell} mt-1 min-w-[14rem]`}>
                            {shops.length === 0 && <option value="">—</option>}
                            {shops.map((s) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </label>
                    <p className="text-xs text-gray-500">Customer, memo number and date can&apos;t be changed here.</p>
                </div>
            </Card>

            <Card title="Items" bodyClassName="p-0">
                <datalist id="edit-item-names">
                    {itemNames.map((n) => (
                        <option key={n} value={n} />
                    ))}
                </datalist>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                                <th className="px-3 py-2">Item</th>
                                <th className="px-3 py-2 w-24">Qty</th>
                                <th className="px-3 py-2 w-28">Rate</th>
                                <th className="px-3 py-2 w-24">Weight</th>
                                <th className="px-3 py-2 w-28">Unit</th>
                                <th className="px-3 py-2">{order.type === "xray" ? "X-ray" : "Hallmark"}</th>
                                <th className="px-3 py-2 w-28 text-right">Amount</th>
                                <th className="px-3 py-2 w-20"><span className="sr-only">Remove</span></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {rows.map((r, i) => (
                                <tr key={i}>
                                    <td className="px-3 py-2">
                                        <input list="edit-item-names" value={r.item} data-cell={`${i}-item`} aria-label={`Item ${i + 1} name`}
                                            onChange={(e) => change(i, "item", e.target.value)} onKeyDown={(e) => onCellKeyDown(i, "item", e)} className={cell} />
                                    </td>
                                    <td className="px-3 py-2">
                                        <input type="number" min="0" value={r.quantity} data-cell={`${i}-quantity`} aria-label={`Item ${i + 1} quantity`}
                                            onChange={(e) => change(i, "quantity", e.target.value)} onKeyDown={(e) => onCellKeyDown(i, "quantity", e)}
                                            onWheel={(e) => e.target.blur()} className={cell} />
                                    </td>
                                    <td className="px-3 py-2">
                                        <input type="number" min="0" value={r.rate} data-cell={`${i}-rate`} aria-label={`Item ${i + 1} rate`}
                                            onChange={(e) => change(i, "rate", e.target.value)} onKeyDown={(e) => onCellKeyDown(i, "rate", e)}
                                            onWheel={(e) => e.target.blur()} className={cell} />
                                    </td>
                                    <td className="px-3 py-2">
                                        <input type="number" min="0" value={r.weight} data-cell={`${i}-weight`} aria-label={`Item ${i + 1} weight`}
                                            onChange={(e) => change(i, "weight", e.target.value)} onKeyDown={(e) => onCellKeyDown(i, "weight", e)}
                                            onWheel={(e) => e.target.blur()} className={cell} />
                                    </td>
                                    <td className="px-3 py-2">
                                        <select value={r.weightUnite} data-cell={`${i}-weightUnite`} aria-label={`Item ${i + 1} unit`}
                                            onChange={(e) => change(i, "weightUnite", e.target.value)} onKeyDown={(e) => onCellKeyDown(i, "weightUnite", e)} className={cell}>
                                            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                                        </select>
                                    </td>
                                    <td className="px-3 py-2">
                                        <input value={r.xray} data-cell={`${i}-xray`} aria-label={`Item ${i + 1} note`}
                                            onChange={(e) => change(i, "xray", e.target.value)} onKeyDown={(e) => onCellKeyDown(i, "xray", e)} className={cell} />
                                    </td>
                                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{taka(amountOf(r))}</td>
                                    <td className="px-3 py-2 text-right">
                                        <Button variant="danger" size="sm" onClick={() => removeRow(i)} aria-label={`Remove item ${i + 1}`}>Remove</Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-4 py-3">
                    <Button variant="secondary" onClick={addRow}>+ Add item</Button>
                    <p className="text-sm text-gray-600">
                        Total <span className="ml-2 text-xl font-bold text-gray-900 tabular-nums">{taka(total)}</span>
                        <span className="ml-2 text-xs text-gray-500">(was {taka(order.totalAmount)})</span>
                    </p>
                </div>
            </Card>

            <div className="flex flex-wrap items-center gap-3">
                <Button size="lg" onClick={() => save(false)} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
                <Button size="lg" variant="secondary" onClick={() => save(true)} disabled={saving}>Save &amp; print memo</Button>
                <span className="text-xs text-gray-500">Enter = next box · Ctrl+Enter = Save</span>
            </div>
        </div>
    );
}

export default EditOrder;
