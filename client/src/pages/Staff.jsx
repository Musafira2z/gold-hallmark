import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { apiUrl } from "../context/UserContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { Button, Card, ErrorBox, Loading, PageHeader } from "../components/ui/index.jsx";
import { formatDay, formatTime } from "../utils/format.js";

const field = "rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200";

// Owner only: add staff, set a new password, switch an account off.
function Staff() {
    const { staff: me } = useAuth();
    const [list, setList] = useState(null);
    const [error, setError] = useState("");
    const [form, setForm] = useState({ name: "", username: "", password: "", role: "staff" });
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setError("");
        try {
            const res = await axios.get(`${apiUrl}/admin/staff`);
            setList(res.data);
        } catch (err) {
            setError(err.response?.data?.error || "Could not load accounts.");
        }
    }, []);
    useEffect(() => {
        load();
    }, [load]);

    const add = async (event) => {
        event.preventDefault();
        if (saving) return;
        setSaving(true);
        try {
            await axios.post(`${apiUrl}/admin/staff`, form);
            toast.success(`Account ${form.username} added.`);
            setForm({ name: "", username: "", password: "", role: "staff" });
            load();
        } catch (err) {
            toast.error(err.response?.data?.error || "Could not add the account.");
        } finally {
            setSaving(false);
        }
    };

    const update = async (account, changes, message) => {
        try {
            await axios.put(`${apiUrl}/admin/staff/${account._id}`, changes);
            toast.success(message);
            load();
        } catch (err) {
            toast.error(err.response?.data?.error || "Could not save.");
        }
    };

    const newPassword = (account) => {
        const password = window.prompt(`New password for ${account.username} (at least 6 characters):`);
        if (password) update(account, { password }, `New password set for ${account.username}. They must log in again.`);
    };

    if (error) return <ErrorBox text={error} onRetry={load} />;
    if (!list) return <Loading />;

    return (
        <div className="space-y-5">
            <PageHeader title="Staff accounts" subtitle="Owner can do everything. Staff can take and edit orders, but can't delete." />

            <Card title="Add an account">
                <form onSubmit={add} className="flex flex-wrap items-end gap-3">
                    <label className="text-sm">
                        <span className="block text-gray-600">Name</span>
                        <input className={field} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                    </label>
                    <label className="text-sm">
                        <span className="block text-gray-600">Username</span>
                        <input className={field} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })}
                            autoCapitalize="none" spellCheck={false} required />
                    </label>
                    <label className="text-sm">
                        <span className="block text-gray-600">Password</span>
                        <input type="password" className={field} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                            autoComplete="new-password" required />
                    </label>
                    <label className="text-sm">
                        <span className="block text-gray-600">Role</span>
                        <select className={field} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                            <option value="staff">Staff</option>
                            <option value="owner">Owner</option>
                        </select>
                    </label>
                    <button type="submit" disabled={saving}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                        {saving ? "Adding…" : "Add"}
                    </button>
                </form>
            </Card>

            <Card title={`Accounts (${list.length})`} bodyClassName="">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                                <th className="px-4 py-2.5">Name</th>
                                <th className="px-4 py-2.5">Username</th>
                                <th className="px-4 py-2.5">Role</th>
                                <th className="px-4 py-2.5">Last login</th>
                                <th className="px-4 py-2.5"><span className="sr-only">Actions</span></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {list.map((a) => (
                                <tr key={a._id} className={a.active ? "" : "bg-gray-50 text-gray-400"}>
                                    <td className="px-4 py-2.5 font-medium">
                                        {a.name} {a._id === me?._id && <span className="text-xs text-gray-500">(you)</span>}
                                        {!a.active && <span className="ml-2 rounded bg-gray-200 px-1.5 py-0.5 text-xs text-gray-600">off</span>}
                                    </td>
                                    <td className="px-4 py-2.5 font-mono">{a.username}</td>
                                    <td className="px-4 py-2.5 capitalize">{a.role}</td>
                                    <td className="px-4 py-2.5 whitespace-nowrap">{a.lastLoginAt ? `${formatDay(a.lastLoginAt)}, ${formatTime(a.lastLoginAt)}` : "—"}</td>
                                    <td className="px-4 py-2.5">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="secondary" size="sm" onClick={() => newPassword(a)}>New password</Button>
                                            {a._id !== me?._id && (
                                                a.active ? (
                                                    <Button variant="danger" size="sm"
                                                        onClick={() => window.confirm(`Switch off ${a.username}? They are logged out at once.`) &&
                                                            update(a, { active: false }, `${a.username} switched off.`)}>
                                                        Switch off
                                                    </Button>
                                                ) : (
                                                    <Button variant="secondary" size="sm" onClick={() => update(a, { active: true }, `${a.username} switched on.`)}>
                                                        Switch on
                                                    </Button>
                                                )
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}

export default Staff;
