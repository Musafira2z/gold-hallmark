import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext.jsx";
import { Card, PageHeader } from "../components/ui/index.jsx";

const field = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200";

// Anyone can change their own password. Other logins of this account end.
function ChangePassword() {
    const { changePassword } = useAuth();
    const navigate = useNavigate();
    const [current, setCurrent] = useState("");
    const [next, setNext] = useState("");
    const [again, setAgain] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    const submit = async (event) => {
        event.preventDefault();
        setError("");
        if (next !== again) {
            setError("The two new passwords are not the same.");
            return;
        }
        setBusy(true);
        try {
            await changePassword(current, next);
            toast.success("Password changed.");
            navigate("/");
        } catch (err) {
            setError(err.response?.data?.error || "Could not change the password.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="max-w-md space-y-5">
            <PageHeader title="Change my password" />
            <Card>
                <form onSubmit={submit} className="space-y-3">
                    <label className="block text-sm">
                        <span className="text-gray-600">Current password</span>
                        <input type="password" className={`${field} mt-1`} value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
                    </label>
                    <label className="block text-sm">
                        <span className="text-gray-600">New password (at least 6 characters)</span>
                        <input type="password" className={`${field} mt-1`} value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" required />
                    </label>
                    <label className="block text-sm">
                        <span className="text-gray-600">New password again</span>
                        <input type="password" className={`${field} mt-1`} value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" required />
                    </label>
                    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
                    <button type="submit" disabled={busy} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                        {busy ? "Saving…" : "Change password"}
                    </button>
                </form>
            </Card>
        </div>
    );
}

export default ChangePassword;
