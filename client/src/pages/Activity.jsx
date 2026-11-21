import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { apiUrl } from "../context/UserContext.jsx";
import { Card, ErrorBox, Loading, PageHeader, Pager } from "../components/ui/index.jsx";
import { formatDay, formatTime } from "../utils/format.js";

const LABELS = {
    "login": "Logged in",
    "login.failed": "Wrong password",
    "logout": "Logged out",
    "order.create": "New order",
    "order.edit": "Edited order",
    "order.delete": "Deleted order",
    "order.restore": "Restored order",
    "customer.create": "New customer",
    "customer.edit": "Edited customer",
    "customer.delete": "Deleted customer",
    "customer.restore": "Restored customer",
    "staff.setup": "Owner account created",
    "staff.create": "Added account",
    "staff.update": "Changed account",
    "staff.password": "Changed own password",
};
const RED = new Set(["login.failed", "order.delete", "customer.delete"]);

// Owner only: who did what, newest first.
function Activity() {
    const [page, setPage] = useState(1);
    const [data, setData] = useState(null);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        setError("");
        try {
            const res = await axios.get(`${apiUrl}/admin/activity`, { params: { page } });
            setData(res.data);
        } catch (err) {
            setError(err.response?.data?.error || "Could not load activity.");
        }
    }, [page]);
    useEffect(() => {
        load();
    }, [load]);

    if (error) return <ErrorBox text={error} onRetry={load} />;
    if (!data) return <Loading />;

    return (
        <div className="space-y-5">
            <PageHeader title="Activity" subtitle={`${data.total.toLocaleString("en-IN")} entries. Who did what, newest first.`} />
            <Card bodyClassName="">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                                <th className="px-4 py-2.5">When</th>
                                <th className="px-4 py-2.5">Who</th>
                                <th className="px-4 py-2.5">What</th>
                                <th className="px-4 py-2.5">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {data.rows.map((r) => (
                                <tr key={r._id}>
                                    <td className="px-4 py-2 whitespace-nowrap text-gray-600">{formatDay(r.at)}, {formatTime(r.at)}</td>
                                    <td className="px-4 py-2">{r.staffName || "—"}</td>
                                    <td className={`px-4 py-2 font-medium ${RED.has(r.action) ? "text-red-700" : "text-gray-900"}`}>{LABELS[r.action] || r.action}</td>
                                    <td className="px-4 py-2 text-gray-700">{r.summary}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <Pager page={data.page} pages={data.pages} onChange={setPage} />
            </Card>
        </div>
    );
}

export default Activity;
