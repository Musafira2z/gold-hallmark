import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { apiUrl } from "../context/UserContext.jsx";
import { Button, Card } from "./ui/index.jsx";
import { formatDay } from "../utils/format.js";

// Owner's phone app (Plan 19): make the code the owner types once on their phone.
// The code is shown once; only a hash is kept.
function OwnerPhoneApp() {
    const [status, setStatus] = useState(null);
    const [shown, setShown] = useState(null); // { code, url }
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        try {
            setStatus((await axios.get(`${apiUrl}/admin/owner-app`)).data);
        } catch {
            setStatus({ on: false, error: true });
        }
    }, []);
    useEffect(() => {
        load();
    }, [load]);

    const make = async () => {
        if (status?.on && !window.confirm("Make a new code? Phones using the old code are logged out.")) return;
        setBusy(true);
        try {
            setShown((await axios.post(`${apiUrl}/admin/owner-app/code`)).data);
            load();
        } catch (err) {
            toast.error(err.response?.data?.error || "Could not make the code.");
        } finally {
            setBusy(false);
        }
    };
    const off = async () => {
        if (!window.confirm("Turn off the phone app? Every phone using it is logged out.")) return;
        setBusy(true);
        try {
            await axios.post(`${apiUrl}/admin/owner-app/off`);
            setShown(null);
            toast.success("Phone app turned off.");
            load();
        } catch (err) {
            toast.error(err.response?.data?.error || "Could not turn it off.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <Card
            title="Owner's phone app"
            actions={status && (
                <>
                    <Button size="sm" variant={status.on ? "secondary" : "primary"} onClick={make} disabled={busy}>
                        {status.on ? "New code" : "Make code"}
                    </Button>
                    {status.on && <Button size="sm" variant="secondary" onClick={off} disabled={busy}>Turn off</Button>}
                </>
            )}
        >
            <p className="text-sm text-gray-600">
                {status?.on
                    ? `On since ${formatDay(status.setAt)}. Today's sales, dues, top customers and whether this PC and its backup are OK, on your phone.`
                    : "See today's sales, dues, top customers, and whether this PC and its backup are OK, on your phone, anywhere."}
            </p>
            {shown && (
                <div className="mt-3 rounded-lg border-2 border-emerald-300 bg-emerald-50 p-4" role="status">
                    <p className="text-sm text-emerald-900"><strong>Shown only now.</strong> It works on the website in about a minute.</p>
                    <p className="mt-2 font-mono text-2xl font-bold tracking-widest text-gray-900">{shown.code}</p>
                    <ol className="mt-2 list-decimal pl-5 text-sm text-gray-700 space-y-0.5">
                        <li>On your phone open <span className="font-mono select-all">{shown.url || "(website not set up yet)"}</span></li>
                        <li>Type the code. You stay logged in for 90 days.</li>
                        <li>Browser menu → <b>Add to Home screen</b>.</li>
                    </ol>
                    <Button size="sm" variant="secondary" className="mt-3" onClick={() => setShown(null)}>Done, hide it</Button>
                </div>
            )}
        </Card>
    );
}

export default OwnerPhoneApp;
