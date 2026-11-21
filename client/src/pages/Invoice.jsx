import axios from "axios";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import "./print.css"
import { apiUrl } from "../context/UserContext.jsx";
import { formatContactForDisplay } from "../utils/formatContact.js";

// Dates on the memo are always Bangladesh time, whatever the PC's clock zone is.
const TZ = "Asia/Dhaka";
const memoDate = (value) => new Date(value).toLocaleDateString("en-GB", { timeZone: TZ });
const memoTime = (value) =>
    new Date(value).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: TZ });
// Delivery date is stored as a calendar day (midnight UTC), so read it as UTC.
const deliveryDay = (value) => new Date(value).toLocaleDateString("en-GB", { timeZone: "UTC" });
const MEMO_TITLE = { hallmark: "Hallmark Cash Memo", xray: "X-ray Cash Memo" };
const Invoice = () => {
    const { id } = useParams(); // Get the order ID from the URL
    const [order, setOrder] = useState(null);
    const didPrint = useRef(false);

    useEffect(() => {
        const fetchOrderData = async () => {
            try {
                const response = await axios.get(`${apiUrl}/orders/${id}`);
                setOrder(response.data); // Update the order state

                // Add this condition check before the print operation
                if (!didPrint.current) {
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
    }, [id]);


    if (!order) {
        return <div>Loading...</div>;
    }
    return (
        <div className="bg-[#E0F2F1] h-[100vh] pt-20 print-content">
            {order.deletedAt && (
                <p className="mx-auto max-w-6xl rounded border-2 border-red-600 py-1 text-center text-lg font-bold text-red-700">
                    DELETED {memoDate(order.deletedAt)}{order.deletedBy ? ` by ${order.deletedBy}` : ""}
                </p>
            )}
            <h2 className="text-center pt-5 font-semibold text-xl -ml-3">{MEMO_TITLE[order.type] || "Cash Memo"}</h2>
            <div className="bg-white px-20 rounded-lg mt-2 max-w-6xl mx-auto">
                <div className="grid grid-cols-3 gap-2 items-start mb-1">
                    <div className="">
                        <h2 className="text-lg font-normal">Customer Profile</h2>
                        <p className="text-sm">
                            <span className="">ID:</span> {order?.customerID}
                        </p>
                        <p className="text-sm">
                            <span className="">Name:</span> {order?.name}
                        </p>
                        <p className="text-sm">
                            <span className="">Mobile:</span> {formatContactForDisplay(order?.contact)}
                        </p>
                        <p className="text-sm">
                            <span className="">Company:</span> {order?.company}
                        </p>
                        <p className="text-sm mb-2">
                            <span className="">Address:</span> {order?.address}
                        </p>
                    </div>
                    <div >
                        {order.image && <img className="w-11/12" src={`${apiUrl}${order.image}`} alt="" />}
                    </div>
                    <div className="ml-2 mt-20">
                        <p className="text-sm">
                            <span className="">Memo No:</span> {order?.voucher ?? "N/A"}
                        </p>
                        <p className="text-sm">
                            <span className="">Date:</span>{" "}
                            {order?.createdAt ? `${memoDate(order.createdAt)}, ${memoTime(order.createdAt)}` : "N/A"}
                        </p>
                        {order?.customerFrom && order?.createdAt && deliveryDay(order.customerFrom) !== memoDate(order.createdAt) && (
                            <p className="text-sm">
                                <span className="">Delivery:</span> {deliveryDay(order.customerFrom)}
                            </p>
                        )}
                    </div>

                </div>

                <h2 className="text-md font-bold">Order Details</h2>
                <table className="w-full border-collapse border border-gray-600 text-left">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="border border-gray-600 text-sm px-4 py-2">Item Name</th>
                            <th className="border border-gray-600 text-sm px-4 py-2">Quantity</th>
                            <th className="border border-gray-600 text-sm px-4 py-2">Rate (BDT)</th>
                            <th className="border border-gray-600 text-sm px-4 py-2">Weight</th>
                            <th className="border border-gray-600 text-sm px-4 py-2">Hall Mark</th>
                            <th className="border border-gray-600 text-sm px-4 py-2">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {order.items.map((item, index) => ( // Map over items array
                            <tr key={index}>
                                <td className="border border-gray-600 px-4 text-sm py-0">{item.item}</td>
                                <td className="border border-gray-600 px-4 text-sm py-0">{item.quantity}</td>
                                <td className="border border-gray-600 px-4 text-sm py-0">{item.rate}</td>
                                <td className="border border-gray-600 px-4 text-sm py-0">{item.weight === null || item.weight === undefined || item.weight === "" ? "—" : `${item.weight} ${item.weightUnite || ""}`}</td>
                                <td className="border border-gray-600 px-4 text-sm py-0">{item.xray}</td> {/* Assuming xray applies to all items */}
                                <td className="border border-gray-600 px-4 text-sm py-0">{item.amount}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div className="flex justify-between items-center mt-1">
                    <div>
                        <p className="text-sm font-bold">
                            <span className="text-sm font-normal">Total Amount:</span> {order.totalAmount} BDT
                        </p>
                        <p className="text-sm font-bold">
                            <span className="text-sm font-normal">Paid Amount:</span> {order.totalAmount} BDT
                        </p>
                        {order.editedAt && (
                            <p className="text-xs text-gray-600">Edited {memoDate(order.editedAt)}</p>
                        )}
                    </div>
                </div>

                <div className="flex justify-between items-center mt-6">
                    <div className="border-t border-gray-600 text-center px-4">
                        <p className="text-sm">Customer Signature</p>
                    </div>
                    <div className="border-t border-gray-600 text-center px-4">
                        <p className="text-sm">Authorized Signature</p>
                    </div>
                </div>
            </div>

        </div>
    );

};

export default Invoice;
