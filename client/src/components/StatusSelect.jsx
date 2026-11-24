import { useState } from "react";
import PropTypes from "prop-types";
import axios from "axios";
import { toast } from "react-toastify";
import { apiUrl } from "../context/UserContext.jsx";

// Order status (Plan 15): Received -> Ready -> Delivered. Old orders have none = Delivered.
const STATUS_LABEL = { received: "Received", ready: "Ready", delivered: "Delivered" };
const STYLE = {
    received: "border-amber-300 bg-amber-50 text-amber-800",
    ready: "border-green-400 bg-green-50 text-green-800",
    delivered: "border-gray-200 bg-white text-gray-500",
};

function StatusSelect({ order, onChange }) {
    const [status, setStatus] = useState(order.status || "delivered");
    const [saving, setSaving] = useState(false);

    if (order.deletedAt) return <span className="text-xs text-gray-400">—</span>;

    const change = async (next) => {
        const before = status;
        setStatus(next);
        setSaving(true);
        try {
            const res = await axios.patch(`${apiUrl}/orders/${order._id}/status`, { status: next });
            toast.success(`Memo ${order.voucher ?? ""}: ${STATUS_LABEL[next]}`, { autoClose: 1500 });
            onChange?.(res.data);
        } catch (err) {
            setStatus(before);
            toast.error(err.response?.data?.error || "Could not change the status.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <select
            value={status}
            disabled={saving}
            onChange={(e) => change(e.target.value)}
            aria-label={`Status of memo ${order.voucher ?? ""}`}
            className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${STYLE[status]} ${saving ? "opacity-60" : ""}`}
        >
            <option value="received">Received</option>
            <option value="ready">Ready</option>
            <option value="delivered">Delivered</option>
        </select>
    );
}

StatusSelect.propTypes = {
    order: PropTypes.object.isRequired,
    onChange: PropTypes.func,
};

export default StatusSelect;
