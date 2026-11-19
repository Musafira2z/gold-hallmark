import { Link } from "react-router-dom";
import PropTypes from "prop-types";
import { Button, TypeBadge } from "./ui/index.jsx";
import { formatDay, formatTime, taka } from "../utils/format.js";

const pieces = (order) => (order.items || []).reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);

// One table for orders everywhere (Today, Orders). Each row: memo number,
// when, customer (links to the profile), type, pieces, amount, Memo button.
function OrderTable({ orders, showDate = true, onDelete }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        <th className="px-4 py-2.5">Memo</th>
                        <th className="px-4 py-2.5">{showDate ? "Date" : "Time"}</th>
                        <th className="px-4 py-2.5">Customer</th>
                        <th className="px-4 py-2.5">Type</th>
                        <th className="px-4 py-2.5 text-right">Pcs</th>
                        <th className="px-4 py-2.5 text-right">Amount</th>
                        <th className="px-4 py-2.5 text-right">
                            <span className="sr-only">Actions</span>
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {orders.map((order) => (
                        <tr key={order._id} className="hover:bg-gray-50">
                            <td className="px-4 py-2.5 font-mono text-gray-700">{order.voucher ?? "—"}</td>
                            <td className="px-4 py-2.5 whitespace-nowrap text-gray-700">
                                {order.createdAt ? (
                                    <>
                                        {showDate && <span className="block">{formatDay(order.createdAt)}</span>}
                                        <span className={showDate ? "text-xs text-gray-500" : ""}>{formatTime(order.createdAt)}</span>
                                    </>
                                ) : (
                                    "—"
                                )}
                            </td>
                            <td className="px-4 py-2.5">
                                {order.customerID ? (
                                    <Link to={`/customers/${order.customerID}`} className="font-medium text-blue-700 hover:underline">
                                        {order.name || `#${order.customerID}`}
                                    </Link>
                                ) : (
                                    <span className="font-medium text-gray-900">{order.name || "Unknown"}</span>
                                )}
                                <span className="block text-xs text-gray-500">
                                    {order.customerID ? `#${order.customerID}` : ""}
                                    {order.company ? ` · ${order.company}` : ""}
                                </span>
                            </td>
                            <td className="px-4 py-2.5">
                                <TypeBadge type={order.type} />
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums">{pieces(order)}</td>
                            <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-gray-900">{taka(order.totalAmount)}</td>
                            <td className="px-4 py-2.5">
                                <div className="flex justify-end gap-2">
                                    <Button to={`/invoice/${order._id}`} target="_blank" rel="noreferrer" variant="secondary" size="sm">
                                        Memo
                                    </Button>
                                    <Button to={`/orders/${order._id}/edit`} variant="secondary" size="sm" aria-label={`Edit memo ${order.voucher ?? ""}`}>
                                        Edit
                                    </Button>
                                    {onDelete && (
                                        <Button variant="danger" size="sm" onClick={() => onDelete(order)} aria-label={`Delete memo ${order.voucher ?? ""}`}>
                                            Delete
                                        </Button>
                                    )}
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

OrderTable.propTypes = {
    orders: PropTypes.arrayOf(PropTypes.object).isRequired,
    showDate: PropTypes.bool,
    onDelete: PropTypes.func,
};

export default OrderTable;
