import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import axios from "axios";
import { toast } from "react-toastify";
import { apiUrl } from "../context/UserContext.jsx";
import { Button } from "./ui/index.jsx";
import { formatDay } from "../utils/format.js";

// Online login for the portal (Plan 18): the customer sees their tests and dues on their phone.
// Staff make a 6-digit PIN here; it shows once. Only a hash is kept.
function CustomerPortal({ customer, portal, shopChoices, onChange }) {
    const [busy, setBusy] = useState(false);
    const [shown, setShown] = useState(null); // { pin, phone, loginUrl } right after making it
    const [shops, setShops] = useState(() => new Set(portal.shops.map((s) => s.id)));
    const isOwnerKind = customer.kind === "shop_owner";

    useEffect(() => setShops(new Set(portal.shops.map((s) => s.id))), [portal.shops]);
    useEffect(() => setShown(null), [customer.customerID]);

    const makePin = async () => {
        if (portal.on && !window.confirm("Make a new PIN? The old PIN stops working and their phone is logged out.")) return;
        setBusy(true);
        try {
            const res = await axios.post(`${apiUrl}/users/${customer.customerID}/portal/pin`);
            setShown(res.data);
            onChange?.();
        } catch (err) {
            toast.error(err.response?.data?.error || "Could not make the PIN.");
        } finally {
            setBusy(false);
        }
    };

    const turnOff = async () => {
        if (!window.confirm(`Turn off the online login for ${customer.name || "this customer"}? Their phone is logged out.`)) return;
        setBusy(true);
        try {
            await axios.post(`${apiUrl}/users/${customer.customerID}/portal/off`);
            setShown(null);
            toast.success("Online login turned off.");
            onChange?.();
        } catch (err) {
            toast.error(err.response?.data?.error || "Could not turn it off.");
        } finally {
            setBusy(false);
        }
    };

    const saveShops = async () => {
        setBusy(true);
        try {
            await axios.put(`${apiUrl}/users/${customer.customerID}/portal/shops`, { shops: [...shops] });
            toast.success("Shops saved.");
            onChange?.();
        } catch (err) {
            toast.error(err.response?.data?.error || "Could not save the shops.");
        } finally {
            setBusy(false);
        }
    };

    const slipText = shown
        ? `Sylhet Gold Hallmark Center: online login\nWebsite: ${shown.loginUrl || "(website not set up yet)"}\nPhone: ${shown.phone}\nPIN: ${shown.pin}`
        : "";
    const copySlip = async () => {
        try {
            await navigator.clipboard.writeText(slipText);
            toast.success("Copied.");
        } catch {
            toast.info("Select the text and copy it.");
        }
    };

    const savedShops = new Set(portal.shops.map((s) => s.id));
    const shopsChanged = shops.size !== savedShops.size || [...shops].some((id) => !savedShops.has(id));

    return (
        <section className="bg-white rounded-xl border border-gray-200 p-5" aria-labelledby="portal-title">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 id="portal-title" className="text-base font-semibold text-gray-900">Online login</h2>
                    <p className="text-sm text-gray-500 mt-0.5">
                        {portal.on
                            ? `On since ${formatDay(portal.setAt)} · phone ${portal.phone || "?"}`
                            : "Let this customer see their tests, ready items and dues on their phone."}
                    </p>
                </div>
                <div className="flex gap-2">
                    {portal.phone ? (
                        <Button onClick={makePin} disabled={busy} variant={portal.on ? "secondary" : "primary"}>
                            {portal.on ? "New PIN" : "Make PIN"}
                        </Button>
                    ) : (
                        <p className="text-sm text-amber-700">Add a mobile number (01…) first.</p>
                    )}
                    {portal.on && (
                        <Button variant="secondary" onClick={turnOff} disabled={busy}>Turn off</Button>
                    )}
                </div>
            </div>

            {shown && (
                <div className="mt-4 rounded-lg border-2 border-emerald-300 bg-emerald-50 p-4" role="status">
                    <p className="text-sm text-emerald-900">Give this to the customer. <strong>The PIN is shown only now.</strong> The login works in about a minute.</p>
                    <p className="mt-2 font-mono text-3xl font-bold tracking-[0.3em] text-gray-900" aria-label={`PIN ${shown.pin.split("").join(" ")}`}>
                        {shown.pin}
                    </p>
                    <pre className="mt-2 whitespace-pre-wrap text-sm text-gray-700 select-all">{slipText}</pre>
                    <div className="mt-3 flex gap-2">
                        <Button size="sm" variant="secondary" onClick={copySlip}>Copy</Button>
                        <Button size="sm" variant="secondary" onClick={() => setShown(null)}>Done, hide it</Button>
                    </div>
                </div>
            )}

            {portal.on && (
                <div className="mt-4 border-t border-gray-100 pt-4">
                    {isOwnerKind ? (
                        <>
                            <p className="text-sm font-medium text-gray-800">Their shops</p>
                            <p className="text-xs text-gray-500">They also see every order for these shops, whoever brought it (no prices of other customers).</p>
                            {shopChoices.length === 0 ? (
                                <p className="mt-2 text-sm text-gray-500">No shops on their orders yet.</p>
                            ) : (
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {shopChoices.map((s) => (
                                        <label key={s.id} className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${shops.has(s.id) ? "border-blue-300 bg-blue-50 text-blue-900" : "border-gray-200 text-gray-700"}`}>
                                            <input
                                                type="checkbox"
                                                checked={shops.has(s.id)}
                                                onChange={(e) => {
                                                    const next = new Set(shops);
                                                    if (e.target.checked) next.add(s.id); else next.delete(s.id);
                                                    setShops(next);
                                                }}
                                            />
                                            {s.name}
                                        </label>
                                    ))}
                                </div>
                            )}
                            {shopsChanged && (
                                <Button size="sm" className="mt-3" onClick={saveShops} disabled={busy}>Save shops</Button>
                            )}
                        </>
                    ) : (
                        <p className="text-sm text-gray-500">
                            They see the orders they brought. To show a shop&apos;s orders too, set the type to Shop owner.
                        </p>
                    )}
                </div>
            )}
        </section>
    );
}

CustomerPortal.propTypes = {
    customer: PropTypes.object.isRequired,
    portal: PropTypes.shape({
        on: PropTypes.bool,
        setAt: PropTypes.string,
        phone: PropTypes.string,
        shops: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.string, name: PropTypes.string })),
        loginUrl: PropTypes.string,
    }).isRequired,
    shopChoices: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.string, name: PropTypes.string })).isRequired,
    onChange: PropTypes.func,
};

export default CustomerPortal;
