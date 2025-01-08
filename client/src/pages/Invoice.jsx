import axios from "axios";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import "./print.css"
import { apiUrl } from "../context/UserContext.jsx";
const Invoice = () => {
    const { id } = useParams(); // Get the order ID from the URL
    const [order, setOrder] = useState(null);

    useEffect(() => {
        const fetchOrderData = async () => {
            try {
                const response = await axios.get(`${apiUrl}/orders/${id}`);
                setOrder(response.data);
                const image = new Image();
                image.src = `${apiUrl}${response.data.image}`;
                image.onload = function () {
                    window.print();
                    window.onafterprint = () => {
                        window.close();
                    };
                };
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
            <h2 className="text-center pt-10 font-semibold text-2xl">Hall Mark Cash Memo</h2>
            <div className="bg-white px-20 rounded-lg mt-4 max-w-6xl mx-auto">
                <h2 className="text-lg font-bold">Customer Profile</h2>
                <div className="grid grid-cols-3 gap-2 mb-0 items-center">
                    <div>
                        <p className="text-[12px]">
                            <span className="">ID:</span> {order?.customerID}
                        </p>
                        <p className="text-[12px]">
                            <span className="">Name:</span> {order?.name}
                        </p>
                        <p className="text-[12px]">
                            <span className="">Mobile:</span> {order?.contact}
                        </p>
                        <p className="text-[12px]">
                            <span className="">Address:</span> {order?.address}
                        </p>
                    </div>
                    <div>
                        <p className="text-[12px]">
                            <span className="">Company:</span> {order?.company}
                        </p>
                        <p className="text-[12px]">
                            <span className="">Voucher Number:</span> {order?.voucher}
                        </p>
                        <p className="text-[12px]">
                            <span className="">Delivery Date:</span> {order?.createdAt ? new Date(order.createdAt).toLocaleDateString('en-GB') : 'N/A'}
                        </p>
                        <p className="text-[12px]">
                            <span className="">Delivery Time:</span>
                            {order?.createdAt ? new Date(order.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : 'N/A'}
                        </p>
                    </div>
                    <div className="w-full flex justify-end items-start ">
                        <img className="" src={`${apiUrl}${order.image}`} alt="" />
                    </div>
                </div>

                <h2 className="text-lg font-bold mb-2">Order Details</h2>
                <table className="w-full border-collapse border border-gray-300 text-left">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="border border-gray-300 px-4 py-2">Item Name</th>
                            <th className="border border-gray-300 px-4 py-2">Quantity</th>
                            <th className="border border-gray-300 px-4 py-2">Rate (BDT)</th>
                            <th className="border border-gray-300 px-4 py-2">Weight</th>
                            <th className="border border-gray-300 px-4 py-2">Hall Mark</th>
                            <th className="border border-gray-300 px-4 py-2">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {order.items.map((item, index) => ( // Map over items array
                            <tr key={index}>
                                <td className="border border-gray-300 px-4 py-0">{item.item}</td>
                                <td className="border border-gray-300 px-4 py-0">{item.quantity}</td>
                                <td className="border border-gray-300 px-4 py-0">{item.rate}</td>
                                <td className="border border-gray-300 px-4 py-0">{item.weight} {item.weightUnite}</td>
                                <td className="border border-gray-300 px-4 py-0">{item.xray}</td> {/* Assuming xray applies to all items */}
                                <td className="border border-gray-300 px-4 py-0">{item.amount}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div className="flex justify-between items-center mt-1">
                    <div>
                        <p>
                            <span className="">Total Amount:</span> {order.totalAmount} BDT
                        </p>
                        <p>
                            <span className="">Paid Amount:</span> {order.totalAmount} BDT
                        </p>
                    </div>
                </div>

                <div className="flex justify-between items-center mt-6">
                    <div className="border-t border-gray-300 text-center px-4">
                        <p>Customer Signature</p>
                    </div>
                    <div className="border-t border-gray-300 text-center px-4">
                        <p>Authorized Signature</p>
                    </div>
                </div>
            </div>

        </div>
    );

};

export default Invoice;
