import axios from "axios";
import { useContext, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { UserContext } from "../context/userContext";

const Invoice = () => {

    const { customers } = useContext(UserContext);
    const { id } = useParams(); // Get the order ID from the URL
    const [order, setOrder] = useState(null);
    console.log(order)
    useEffect(() => {
        const fetchOrderData = async () => {
            try {
                const response = await axios.get(`http://localhost:8003/orders/${id}`);
                setOrder(response.data);
            } catch (error) {
                console.error("Error fetching invoice data:", error);
            }
        };

        fetchOrderData();
    }, [id]);
    if (!order) {
        return <div>Loading...</div>;
    }
    return (
        <div className="bg-white px-20 py-10 pt-36 rounded-lg shadow-lg mt-10 max-w-6xl mx-auto border border-gray-200 mb-48">
            <h2 className="text-lg font-bold mb-4">Customer Profile</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <p>
                        <span className="">ID:</span> {order?.customerID}
                    </p>
                    <p>
                        <span className="">Name:</span> {order?.name}
                    </p>
                    <p>
                        <span className="">Mobile:</span> {order?.contact}
                    </p>
                    <p>
                        <span className="">Address:</span> {order?.address}
                    </p>
                    <p>
                        <span className="">Company:</span> {order?.company}
                    </p>
                </div>
                <div>
                    <p>
                        <span className="">Voucher Number:</span> {order?._id}
                    </p>
                    <p>
                        <span className="">Box Number:</span> 0
                    </p>
                    <p>
                        <span className="">Order Date:</span> {order?.createdAt ? new Date(order.createdAt).toLocaleDateString('en-GB') : 'N/A'}
                    </p>
                    <p>
                        <span className="">Order Time:</span>
                        {order?.createdAt ? new Date(order.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : 'N/A'}

                    </p>
                </div>
            </div>

            <h2 className="text-lg font-bold mb-4">Order Details</h2>
            <table className="w-full border-collapse border border-gray-300 text-left">
                <thead className="bg-gray-100">
                    <tr>
                        <th className="border border-gray-300 px-4 py-2">Item Name</th>
                        <th className="border border-gray-300 px-4 py-2">Quantity</th>
                        <th className="border border-gray-300 px-4 py-2">Rate</th>
                        <th className="border border-gray-300 px-4 py-2">Weight</th>
                        <th className="border border-gray-300 px-4 py-2">Hall Mark</th>
                        <th className="border border-gray-300 px-4 py-2">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td className="border border-gray-300 px-4 py-2"> {order?.item} </td>
                        <td className="border border-gray-300 px-4 py-2">{order?.quantity}</td>
                        <td className="border border-gray-300 px-4 py-2">{order?.rate}</td>
                        <td className="border border-gray-300 px-4 py-2">{order?.weight}</td>
                        <td className="border border-gray-300 px-4 py-2">{order?.xray}</td>
                        <td className="border border-gray-300 px-4 py-2">{order?.amount}</td>
                    </tr>
                </tbody>
            </table>

            <div className="flex justify-between items-center mt-4">
                <div>
                    <p>
                        <span className="">Total Amount:</span> 1.56
                    </p>
                    <p>
                        <span className="">Paid Amount:</span> 0.00
                    </p>
                    <p>
                        <span className="">Balance Amount:</span> 0.00
                    </p>
                </div>
                <div>
                    <p>
                        <span className="">Delivery Date:</span>  {order?.customerFrom ? new Date(order.customerFrom).toLocaleDateString('en-GB') : 'N/A'}
                    </p>
                    <p>
                        <span className="">Delivery Time:</span> {order?.customerFrom ? new Date(order.customerFrom).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : 'N/A'}
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
    );
};

export default Invoice;
