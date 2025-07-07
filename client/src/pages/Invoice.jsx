import axios from "axios";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import "./print.css"
import { apiUrl } from "../context/UserContext.jsx";
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
                        window.print();
                        window.onafterprint = () => {
                            window.close();
                        };
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
            <h2 className="text-center pt-5 font-semibold text-xl -ml-3">Hallmark Cash Memo</h2>
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
                            <span className="">Mobile:</span> {order?.contact}
                        </p>
                        <p className="text-sm">
                            <span className="">Company:</span> {order?.company}
                        </p>
                        <p className="text-sm mb-2">
                            <span className="">Address:</span> {order?.address}
                        </p>
                    </div>
                    <div >
                        <img className="w-11/12" src={`${apiUrl}${order.image}`} alt="" />
                    </div>
                    <div className="ml-2 mt-20">
                        <p className="text-sm">
                            <span className="">Voucher Number:</span> {order?.voucher}
                        </p>
                        <p className="text-sm">
                            <span className="">Delivery Date:</span> {order?.createdAt ? new Date(order.createdAt).toLocaleDateString('en-GB') : 'N/A'}
                        </p>
                        <p className="text-sm">
                            <span className="">Delivery Time:</span>
                            {order?.createdAt ? new Date(order.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : 'N/A'}
                        </p>
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
                                <td className="border border-gray-600 px-4 text-sm py-0">{item.weight} {item.weightUnite}</td>
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
