import { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import axios from "axios";
import { toast } from "react-toastify";
import { apiUrl } from "../context/UserContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { Button } from "./ui/index.jsx";
import { formatDay, formatTime, taka } from "../utils/format.js";

// Customer's dues (baki): the balance, "Receive payment", and the payment list.
// Plan: plans/11-payments.md
function CustomerPayments({ customerID, balance: initialBalance, onChange }) {
    const { isOwner } = useAuth();
    const [balance, setBalance] = useState(initialBalance);
    const [payments, setPayments] = useState(null);
    const [amount, setAmount] = useState("");
    const [note, setNote] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => setBalance(initialBalance), [initialBalance]);

    const loadPayments = useCallback(async () => {
        try {
            const res = await axios.get(`${apiUrl}/users/${customerID}/payments`);
            setPayments(res.data);
        } catch {
            setPayments([]);
        }
    }, [customerID]);
    useEffect(() => {
        loadPayments();
    }, [loadPayments]);

    const receive = async (event) => {
        event.preventDefault();
        if (saving) return;
        const value = Number(amount);
        if (!(value > 0)) {
            toast.warn("Enter the amount received.");
            return;
        }
        setSaving(true);
        try {
            const res = await axios.post(`${apiUrl}/users/${customerID}/payments`, { amount: value, note });
            setBalance(res.data.balance);
            setAmount("");
            setNote("");
            toast.success(`Received ${taka(value)}.`);
            loadPayments();
            onChange?.();
        } catch (err) {
            toast.error(err.response?.data?.error || "Payment was NOT saved.");
        } finally {
            setSaving(false);
        }
    };

    const remove = async (p) => {
        if (!window.confirm(`Remove the payment of ${taka(p.amount)} from ${formatDay(p.at)}?\n\nUse this only for a wrong entry.`)) return;
        try {
            const res = await axios.delete(`${apiUrl}/users/payments/${p._id}`);
            setBalance(res.data.balance);
            toast.success("Payment removed.");
            loadPayments();
            onChange?.();
        } catch (err) {
            toast.error(err.response?.data?.error || "Could not remove the payment.");
        }
    };

    const due = balance?.due ?? 0;
    const field = "rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200";

    return (
        <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-4" aria-label="Dues and payments">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <p className="text-sm text-gray-500">{due < 0 ? "Advance (paid extra)" : "Due (baki)"}</p>
                    <p className={`text-2xl font-bold tabular-nums ${due > 0 ? "text-red-700" : due < 0 ? "text-green-700" : "text-gray-900"}`}>
                        {taka(Math.abs(due))}
                    </p>
                    {balance && (
                        <p className="text-xs text-gray-500">
                            Billed {taka(balance.billed)} · paid with orders {taka(balance.paidAtOrder)} · paid later {taka(balance.paidLater)}
                        </p>
                    )}
                </div>
                <form onSubmit={receive} className="flex flex-wrap items-end gap-2">
                    <label className="text-sm">
                        <span className="block text-gray-600">Receive payment (৳)</span>
                        <input type="number" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)}
                            onWheel={(e) => e.target.blur()} className={`${field} w-32`} aria-label="Amount received" />
                    </label>
                    <label className="text-sm">
                        <span className="block text-gray-600">Note</span>
                        <input value={note} onChange={(e) => setNote(e.target.value)} className={`${field} w-40`} placeholder="cash, bKash…" />
                    </label>
                    <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Receive"}</Button>
                </form>
            </div>

            {payments && payments.length > 0 && (
                <div>
                    <p className="text-sm font-semibold text-gray-700 mb-1">Payments received</p>
                    <ul className="divide-y divide-gray-100 text-sm">
                        {payments.map((p) => (
                            <li key={p._id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                                <span>
                                    <span className="font-semibold tabular-nums">{taka(p.amount)}</span>{" "}
                                    <span className="text-gray-500">
                                        {formatDay(p.at)}, {formatTime(p.at)}{p.staffName ? ` · ${p.staffName}` : ""}{p.note ? ` · ${p.note}` : ""}
                                    </span>
                                </span>
                                {isOwner && (
                                    <Button variant="danger" size="sm" onClick={() => remove(p)}>Remove</Button>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </section>
    );
}

CustomerPayments.propTypes = {
    customerID: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    balance: PropTypes.object,
    onChange: PropTypes.func,
};

export default CustomerPayments;
