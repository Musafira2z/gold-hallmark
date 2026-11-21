import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";

// Login page. When the app has no accounts yet (first run) the same page
// asks the owner to create their account instead.
function Login() {
    const { status, error: startError, login, setup } = useAuth();
    const isSetup = status === "setup";
    const [name, setName] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [password2, setPassword2] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    const submit = async (event) => {
        event.preventDefault();
        if (busy) return;
        setError("");
        if (isSetup && password !== password2) {
            setError("The two passwords are not the same.");
            return;
        }
        setBusy(true);
        try {
            if (isSetup) await setup(name, username, password);
            else await login(username, password);
        } catch (err) {
            setError(err.response?.data?.error || "Could not reach the server.");
        } finally {
            setBusy(false);
        }
    };

    const field = "w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200";

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                    <img src="/logo.png" alt="" className="h-12 w-12 rounded-full object-cover" />
                    <div>
                        <h1 className="text-lg font-bold text-gray-900">Sylhet Gold Hallmark Center</h1>
                        <p className="text-sm text-gray-500">{isSetup ? "First time: create the owner account" : "Log in"}</p>
                    </div>
                </div>

                {isSetup && (
                    <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">
                        This account can do everything, including adding staff. Keep the password safe.
                    </p>
                )}

                {isSetup && (
                    <label className="block text-sm">
                        <span className="font-medium text-gray-700">Your name</span>
                        <input className={`${field} mt-1`} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required autoFocus />
                    </label>
                )}
                <label className="block text-sm">
                    <span className="font-medium text-gray-700">Username</span>
                    <input className={`${field} mt-1`} value={username} onChange={(e) => setUsername(e.target.value)}
                        autoComplete="username" autoCapitalize="none" spellCheck={false} required autoFocus={!isSetup} />
                </label>
                <label className="block text-sm">
                    <span className="font-medium text-gray-700">Password</span>
                    <input type="password" className={`${field} mt-1`} value={password} onChange={(e) => setPassword(e.target.value)}
                        autoComplete={isSetup ? "new-password" : "current-password"} required />
                </label>
                {isSetup && (
                    <label className="block text-sm">
                        <span className="font-medium text-gray-700">Password again</span>
                        <input type="password" className={`${field} mt-1`} value={password2} onChange={(e) => setPassword2(e.target.value)} autoComplete="new-password" required />
                    </label>
                )}

                {(error || startError) && (
                    <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error || startError}</p>
                )}

                <button type="submit" disabled={busy}
                    className="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                    {busy ? "Please wait…" : isSetup ? "Create owner account" : "Log in"}
                </button>
            </form>
        </div>
    );
}

export default Login;
