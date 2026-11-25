import axios from "axios";
import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import "./print.css"
import { apiUrl } from "../context/UserContext.jsx";
import { formatContactForDisplay } from "../utils/formatContact.js";
import { loadPhoto } from "../utils/authImage.js";
import { purityText } from "../utils/purity.js";
import QRCode from "qrcode";

// The A4 memo (Plan 20). Drawn as an A4 sheet on screen too, so what staff see is what prints.

// Dates on the memo are always Bangladesh time, whatever the PC's clock zone is.
const TZ = "Asia/Dhaka";
const memoDate = (value) => new Date(value).toLocaleDateString("en-GB", { timeZone: TZ });
const memoTime = (value) =>
    new Date(value).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: TZ });
// Delivery date is stored as a calendar day (midnight UTC), so read it as UTC.
const deliveryDay = (value) => new Date(value).toLocaleDateString("en-GB", { timeZone: "UTC" });
const MEMO_TITLE = { hallmark: "Hallmark Cash Memo", xray: "X-ray Cash Memo" };
// Old orders have no paidAmount: their memo always said fully paid.
const paidOf = (order) => (order.paidAmount === undefined || order.paidAmount === null ? order.totalAmount : order.paidAmount);
const money = (n) => Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const weightText = (item) =>
    item.weight === null || item.weight === undefined || item.weight === "" ? "—" : `${item.weight} ${item.weightUnite || ""}`.trim();
// "sylhethallmark.com/report" from the QR link, so each copy of the app prints its own site.
const lookupAddress = (reportUrl) => {
    try {
        const u = new URL(reportUrl);
        return `${u.host}/report`;
    } catch {
        return null;
    }
};

const Invoice = () => {
    const { id } = useParams(); // Get the order ID from the URL
    const [searchParams] = useSearchParams();
    const viewOnly = searchParams.get("view") === "1"; // look at the memo without the print dialog
    const [order, setOrder] = useState(null);
    const [balance, setBalance] = useState(null);
    const [photo, setPhoto] = useState(null);
    const [qr, setQr] = useState(null);
    const didPrint = useRef(false);

    useEffect(() => {
        const fetchOrderData = async () => {
            try {
                const response = await axios.get(`${apiUrl}/orders/${id}`);
                // The photo needs the login token (BUGS S5). Load it before printing,
                // but never hold the memo up for more than 5 seconds.
                if (response.data?.image) {
                    const photoUrl = await Promise.race([
                        loadPhoto(response.data.image).catch(() => null),
                        new Promise((resolve) => setTimeout(() => resolve(null), 5000)),
                    ]);
                    setPhoto(photoUrl);
                }
                // QR for the online report (Plan 14). Made here, so it is ready before printing.
                if (response.data?.reportUrl) {
                    setQr(await QRCode.toDataURL(response.data.reportUrl, { margin: 0, width: 360, errorCorrectionLevel: "M" }).catch(() => null));
                }
                setOrder(response.data); // Update the order state
                // Customer's total dues, printed under this memo's own numbers.
                if (response.data?.customerID) {
                    axios.get(`${apiUrl}/users/${response.data.customerID}/balance`)
                        .then((b) => setBalance(b.data))
                        .catch(() => setBalance(null));
                }

                if (!didPrint.current && !viewOnly) {
                    didPrint.current = true;

                    // Wait for a short delay to ensure the DOM renders
                    setTimeout(() => {
                        let isClosing = false;

                        // Function to close the window
                        const closeWindow = () => {
                            if (!isClosing) {
                                isClosing = true;
                                try {
                                    window.close();
                                    // If window.close() doesn't work (blocked by browser), try to redirect
                                    if (!window.closed) {
                                        setTimeout(() => {
                                            window.location.href = 'about:blank';
                                        }, 100);
                                    }
                                } catch (error) {
                                    console.log('Could not close window:', error);
                                }
                            }
                        };

                        // Method 1: onafterprint event (most reliable)
                        window.onafterprint = () => {
                            setTimeout(closeWindow, 200);
                        };

                        // Method 2: matchMedia listener for print media query
                        const mediaQueryList = window.matchMedia('print');
                        const handleMediaChange = (mql) => {
                            if (!mql.matches) {
                                // Print dialog closed
                                setTimeout(closeWindow, 200);
                                // Clean up listener
                                if (mediaQueryList.removeListener) {
                                    mediaQueryList.removeListener(handleMediaChange);
                                } else if (mediaQueryList.removeEventListener) {
                                    mediaQueryList.removeEventListener('change', handleMediaChange);
                                }
                            }
                        };

                        // Add listener (support both old and new API)
                        if (mediaQueryList.addListener) {
                            mediaQueryList.addListener(handleMediaChange);
                        } else if (mediaQueryList.addEventListener) {
                            mediaQueryList.addEventListener('change', handleMediaChange);
                        }

                        // Trigger print
                        window.print();
                    }, 500); // Allow DOM to render before printing
                }
            } catch (error) {
                console.error("Error fetching data:", error);
            }
        };

        fetchOrderData();
    }, [id, viewOnly]);


    if (!order) {
        return <div className="p-8 text-gray-600">Loading the memo…</div>;
    }
    const paid = paidOf(order);
    const due = order.totalAmount - paid;
    const lookup = order.reportUrl ? lookupAddress(order.reportUrl) : null;
    const site = lookup ? lookup.replace(/\/report$/, "") : null;
    const items = order.items || [];

    return (
        <div className="memo-page print-content">
            <div className="memo-sheet">
                {order.deletedAt && (
                    <p className="memo-deleted">
                        DELETED {memoDate(order.deletedAt)}{order.deletedBy ? ` by ${order.deletedBy}` : ""} · এই মেমো বাতিল
                    </p>
                )}

                {/* Header */}
                <header className="memo-head">
                    <div className="memo-brand">
                        <img src="/logo.png" alt="" className="memo-logo" />
                        <div>
                            <h1>Sylhet Gold Hallmark Center</h1>
                            <p className="memo-bn">সিলেট গোল্ড হলমার্ক সেন্টার</p>
                            {site && <p className="memo-site">{site}</p>}
                        </div>
                    </div>
                    <div className="memo-no">
                        <p className="memo-title">{MEMO_TITLE[order.type] || "Cash Memo"}</p>
                        <p className="memo-label">Memo No</p>
                        <p className="memo-number">{order.voucher ?? "N/A"}</p>
                        <p className="memo-date">
                            {order.createdAt ? `${memoDate(order.createdAt)}, ${memoTime(order.createdAt)}` : "N/A"}
                        </p>
                        {order.customerFrom && order.createdAt && deliveryDay(order.customerFrom) !== memoDate(order.createdAt) && (
                            <p className="memo-date">Delivery: <b>{deliveryDay(order.customerFrom)}</b></p>
                        )}
                    </div>
                </header>

                {/* Customer */}
                <section className="memo-customer">
                    <dl>
                        <dt>Customer ID</dt><dd>{order.customerID}</dd>
                        <dt>Name</dt><dd className="font-semibold">{order.name}</dd>
                        <dt>Mobile</dt><dd>{formatContactForDisplay(order.contact)}</dd>
                        <dt>Shop</dt><dd>{order.company || "—"}</dd>
                        <dt>Address</dt><dd>{order.address || "—"}</dd>
                    </dl>
                    <div className="memo-photo">
                        {photo && <img src={photo} alt="" />}
                    </div>
                </section>

                {/* Items */}
                <table className="memo-items">
                    <thead>
                        <tr>
                            <th className="w-[8mm] text-center">#</th>
                            <th>Item</th>
                            <th className="text-right">Qty</th>
                            <th className="text-right">Weight</th>
                            <th>Result</th>
                            <th className="text-right">Rate</th>
                            <th className="text-right">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.length === 0 && (
                            <tr><td colSpan={7} className="text-center text-gray-600">No items on this memo · এই মেমোতে কোনো গহনা নেই</td></tr>
                        )}
                        {items.map((item, index) => {
                            const result = purityText(item);
                            return (
                                <tr key={index}>
                                    <td className="text-center">{index + 1}</td>
                                    <td>{item.item}</td>
                                    <td className="text-right">{item.quantity}</td>
                                    <td className="text-right whitespace-nowrap">{weightText(item)}</td>
                                    <td>
                                        {result ? (
                                            <>
                                                <span className="memo-result">{result}</span>
                                                {item.stamp && <span className="memo-stamp"> {item.stamp}</span>}
                                                {item.xray && <span className="memo-typed">({item.xray})</span>}
                                            </>
                                        ) : (
                                            item.xray || "—"
                                        )}
                                    </td>
                                    <td className="text-right">{money(item.rate)}</td>
                                    <td className="text-right">{money(item.amount)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {/* Money + check online */}
                <section className="memo-bottom">
                    <div className="memo-money">
                        <div><span>Total</span><b>{money(order.totalAmount)} BDT</b></div>
                        <div><span>Paid</span><b>{money(paid)} BDT</b></div>
                        {due > 0 && <div className="memo-due"><span>Due · বাকি</span><b>{money(due)} BDT</b></div>}
                        {balance && balance.due > 0 && (
                            <p className="memo-note">Customer&apos;s total due (all memos): {money(balance.due)} BDT</p>
                        )}
                        {order.editedAt && <p className="memo-note">Edited {memoDate(order.editedAt)}</p>}
                    </div>
                    {qr && (
                        <div className="memo-check">
                            <img src={qr} alt="Report QR code" className="memo-qr" />
                            <div>
                                <p className="memo-check-title">Check this memo online</p>
                                <p className="memo-check-bn">স্ক্যান করে রিপোর্ট দেখুন</p>
                                {lookup && (
                                    <p className="memo-check-how">
                                        Or open <b>{lookup}</b> and type
                                        memo <b>{order.voucher}</b>, code <b className="memo-code">{order.reportCode}</b>
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </section>

                {/* Signatures */}
                <section className="memo-sign">
                    <div><span>Customer Signature</span></div>
                    <div><span>Authorized Signature</span></div>
                </section>
                <p className="memo-thanks">Thank you · ধন্যবাদ</p>
            </div>
        </div>
    );

};

export default Invoice;
