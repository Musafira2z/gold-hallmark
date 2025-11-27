
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { apiUrl } from '../context/UserContext';
import { Trash } from 'react-bootstrap-icons';
import dayjs from 'dayjs';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const OrderSummary = () => {
  const [orders, setOrders] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [deleting, setDeleting] = useState(null);

  const formatDate = (date) => {
    return dayjs(date).format('YYYY-MM-DD');
  };

  const fetchOrders = async (date) => {
    try {
      const response = await axios.get(`${apiUrl}/orders?date=${formatDate(date)}`);
      const ordersData = Array.isArray(response.data) ? response.data : [];
      
      // Sort orders by createdAt (newest first)
      const sortedOrders = ordersData.sort((a, b) => {
        const dateA = new Date(a.createdAt || a.customerFrom || 0);
        const dateB = new Date(b.createdAt || b.customerFrom || 0);
        return dateB - dateA; // Descending order (newest first)
      });
      
      setOrders(sortedOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
    }
  };

  const handleDeleteOrder = async (orderId, orderName) => {
    if (!window.confirm(`Are you sure you want to delete order for "${orderName}"? This action cannot be undone.`)) {
      return;
    }

    setDeleting(orderId);
    try {
      await axios.delete(`${apiUrl}/orders/${orderId}`);
      toast.success('Order deleted successfully', {
        position: "top-right",
        autoClose: 2000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      // Refresh orders after deletion
      fetchOrders(selectedDate);
    } catch (error) {
      console.error('Error deleting order:', error);
      toast.error('Failed to delete order', {
        position: "top-right",
        autoClose: 2000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } finally {
      setDeleting(null);
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

  const totalAmount = orders.reduce((sum, order) => {
    const amount = parseFloat(order.totalAmount) || parseFloat(order.amount) || 0;
    return sum + amount;
  }, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Day Summary</h1>
          <p className="text-gray-500 mt-1">View daily order summary and revenue</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-semibold">
            {dayjs(selectedDate).format('MMMM DD, YYYY')}
          </div>
        </div>
      </div>

      {/* Summary Card */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl p-4 text-white">
            <p className="text-white/80 text-sm font-medium mb-1">Total Orders</p>
            <h3 className="text-2xl font-bold">{orders.length}</h3>
          </div>
          <div className="bg-gradient-to-br from-blue-500 to-green-700 rounded-xl p-4 text-white">
            <p className="text-white/80 text-sm font-medium mb-1">Total Revenue</p>
            <h3 className="text-2xl font-bold">৳{totalAmount.toFixed(2)}</h3>
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-indigo-700 rounded-xl p-4 text-white">
            <p className="text-white/80 text-sm font-medium mb-1">Average Order</p>
            <h3 className="text-2xl font-bold">
              ৳{orders.length > 0 ? (totalAmount / orders.length).toFixed(2) : '0.00'}
            </h3>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
          <h3 className="text-lg font-bold text-white">Order Details</h3>
          <p className="text-blue-100 text-sm">Orders for {dayjs(selectedDate).format('MMMM DD, YYYY')}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Service Name</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Type</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Total Amount</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.length > 0 ? (
                <>
                  {orders.map((order) => {
                    const amount = parseFloat(order.totalAmount) || parseFloat(order.amount) || 0;
                    const orderDate = order.createdAt 
                      ? new Date(order.createdAt)
                      : order.customerFrom 
                        ? new Date(order.customerFrom)
                        : null;
                    const orderTime = orderDate 
                      ? orderDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
                      : '';
                    
                    return (
                      <tr key={order._id} className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-200 group">
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-semibold text-gray-800">{order.name || order.company || 'Unknown'}</p>
                            {order.contact && (
                              <p className="text-sm text-gray-500">{order.contact}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-medium text-gray-800">{order.name || 'N/A'}</p>
                            {order.customerID && (
                              <p className="text-xs text-gray-500">ID: {order.customerID}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            order.type === 'hallmark' 
                              ? 'bg-blue-100 text-blue-700' 
                              : order.type === 'xray' 
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-gray-100 text-gray-700'
                          }`}>
                            {order.type ? order.type.toUpperCase() : 'ORDER'}
                          </span>
                          {orderTime && (
                            <p className="text-xs text-gray-500 mt-1">{orderTime}</p>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <p className="font-bold text-gray-800 text-lg">৳{amount.toFixed(2)}</p>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center">
                            <button
                              onClick={() => handleDeleteOrder(order._id, order.name || order.company || 'Unknown')}
                              disabled={deleting === order._id}
                              className="p-2 bg-red-100 hover:bg-red-200 rounded-lg transition-all duration-200 group/delete disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Delete Order"
                            >
                              {deleting === order._id ? (
                                <svg className="animate-spin h-4 w-4 text-red-600" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                              ) : (
                                <Trash className="text-red-600 h-4 w-4 group-hover/delete:scale-110 transition-transform" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="font-semibold bg-gradient-to-r from-gray-50 to-gray-100 border-t-2 border-gray-300">
                    <td colSpan="3" className="px-6 py-4 text-left">
                      <p className="text-lg font-bold text-gray-800">Total</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-xl font-bold text-gray-900">৳{totalAmount.toFixed(2)}</p>
                    </td>
                    <td className="px-6 py-4"></td>
                  </tr>
                </>
              ) : (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-gray-400">
                      <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <p className="text-lg font-medium">No orders found</p>
                      <p className="text-sm">No orders for {dayjs(selectedDate).format('MMMM DD, YYYY')}</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <button
          onClick={handlePrevDay}
          className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-semibold shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Previous Day
        </button>
        <button
          onClick={handleNextDay}
          className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-semibold shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2"
        >
          Next Day
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
      <ToastContainer />
    </div>
  );
};

export default OrderSummary;
