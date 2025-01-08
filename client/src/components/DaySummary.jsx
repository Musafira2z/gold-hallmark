
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { apiUrl } from '../context/UserContext';
import { PencilSquare, Trash } from 'react-bootstrap-icons';
import dayjs from 'dayjs';
const OrderSummary = () => {
  const [orders, setOrders] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const formatDate = (date) => {
    return dayjs(date).format('YYYY-MM-DD');
  };

  const fetchOrders = async (date) => {
    try {
      const response = await axios.get(`${apiUrl}/orders?date=${formatDate(date)}`);
      const ordersData = Array.isArray(response.data) ? response.data : [];
      setOrders(ordersData);
    } catch (error) {
      console.error('Error fetching orders:', error);
    }
  };

  useEffect(() => {
    fetchOrders(selectedDate);
  }, [selectedDate]);

  const handlePrevDay = () => {
    setSelectedDate(new Date(selectedDate.setDate(selectedDate.getDate() - 1)));
  };

  const handleNextDay = () => {
    setSelectedDate(new Date(selectedDate.setDate(selectedDate.getDate() + 1)));
  };

  return (
    <div className="bg-gray-100 p-6 rounded-lg shadow-md mt-10">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-semibold text-teal-600">Day Summary</h1>
        <p className="text-gray-600">{dayjs(selectedDate).format('MMMM DD, YYYY')}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full table-auto">
          <thead>
            <tr className="bg-gray-200 text-gray-600 uppercase text-sm leading-normal">
              <th className="py-3 px-6 text-left">Service Name</th>
              <th className="py-3 px-6 text-right">Total Amount</th>
              <th className="py-3 px-6 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="text-gray-700 text-sm font-light">
            {orders.length > 0 ? (
              <>
                {orders.map((order) => (
                  <tr key={order._id} className="border-b border-gray-200 hover:bg-gray-100">
                    <td className="py-4 px-6 text-left whitespace-nowrap">
                      {order.name || order.company}
                    </td>
                    <td className="py-4 px-6 text-right">
                      {order.totalAmount.toFixed(2)}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <PencilSquare className="text-blue-500 cursor-pointer h-5 w-5" />
                        <Trash className="text-red-500 cursor-pointer h-5 w-5" />
                      </div>
                    </td>
                  </tr>
                ))}
                <tr className="font-medium bg-gray-200">
                  <td className="py-4 px-6 text-left">Total</td>
                  <td className="py-4 px-6 text-right">
                    {orders.reduce((sum, order) => sum + order.totalAmount, 0).toFixed(2)}
                  </td>
                  <td className="py-4 px-6"></td>
                </tr>
              </>
            ) : (
              <tr className="border-b border-gray-200">
                <td colSpan="3" className="py-4 px-6 text-center text-gray-500">
                  No orders for {dayjs(selectedDate).format('MMMM DD, YYYY')}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex justify-between">
        <button
          onClick={handlePrevDay}
          className="bg-teal-500 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded"
        >
          Previous Day
        </button>
        <button
          onClick={handleNextDay}
          className="bg-teal-500 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded"
        >
          Next Day
        </button>
      </div>
    </div>
  );
};

export default OrderSummary;
