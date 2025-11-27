import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { apiUrl } from "../context/UserContext.jsx";

const Orders = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // 'all', 'hallmark', 'xray'
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        try {
            const response = await axios.get(`${apiUrl}/orders`);
            const sortedOrders = [...(response.data || [])].sort((a, b) => {
                const dateA = new Date(a.createdAt || a.customerFrom || 0);
                const dateB = new Date(b.createdAt || b.customerFrom || 0);
                return dateB - dateA;
            });
            setOrders(sortedOrders);
        } catch (error) {
            console.error("Error fetching orders:", error);
        } finally {
            setLoading(false);
        }
    };

    const filteredOrders = orders.filter(order => {
        const matchesFilter = filter === 'all' || order.type === filter;
        const matchesSearch = searchTerm === '' || 
            order.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.customerID?.toString().includes(searchTerm) ||
            order.voucher?.toString().includes(searchTerm) ||
            order.contact?.toString().includes(searchTerm);
        return matchesFilter && matchesSearch;
    });

    const getTotalRevenue = () => {
        return filteredOrders.reduce((sum, order) => {
            const amount = parseFloat(order.totalAmount) || parseFloat(order.amount) || 0;
            return sum + amount;
        }, 0);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">All Orders</h1>
                    <p className="text-gray-500 mt-1">View and manage all customer orders</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={fetchOrders}
                        disabled={loading}
                        className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium shadow-sm hover:shadow-md transition-all duration-200 flex items-center gap-2 disabled:opacity-50"
                        title="Refresh orders"
                    >
                        <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Refresh
                    </button>
                </div>
            </div>

            {/* Stats and Filters */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                    <div className="flex gap-3">
                        <button
                            onClick={() => setFilter('all')}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                                filter === 'all'
                                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            All Orders ({orders.length})
                        </button>
                        <button
                            onClick={() => setFilter('hallmark')}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                                filter === 'hallmark'
                                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            Hallmark ({orders.filter(o => o.type === 'hallmark').length})
                        </button>
                        <button
                            onClick={() => setFilter('xray')}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                                filter === 'xray'
                                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            X-Ray ({orders.filter(o => o.type === 'xray').length})
                        </button>
                    </div>
                    <div className="flex-1 max-w-md">
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search by name, ID, voucher, or contact..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                            />
                            <svg className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                    </div>
                </div>
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg">
                    <div>
                        <p className="text-sm text-gray-600">Total Revenue</p>
                        <p className="text-2xl font-bold text-gray-800">৳{getTotalRevenue().toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-gray-600">Filtered Orders</p>
                        <p className="text-2xl font-bold text-gray-800">{filteredOrders.length}</p>
                    </div>
                </div>
            </div>

            {/* Orders Table */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
                    <h3 className="text-lg font-bold text-white">Order Details</h3>
                    <p className="text-blue-100 text-sm">Complete list of all orders</p>
                </div>
                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                        </div>
                    ) : filteredOrders.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">
                            <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            <p className="text-lg font-medium">No orders found</p>
                            <p className="text-sm">Try adjusting your filters or search term</p>
                        </div>
                    ) : (
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Order Info</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Customer</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Type</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date & Time</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Amount</th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredOrders.map((order, index) => {
                                    const orderDate = order.createdAt 
                                        ? new Date(order.createdAt)
                                        : order.customerFrom 
                                            ? new Date(order.customerFrom)
                                            : null;
                                    
                                    const orderDateStr = orderDate 
                                        ? orderDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                        : 'N/A';
                                    
                                    const orderTime = orderDate 
                                        ? orderDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
                                        : '';
                                    
                                    const orderAmount = parseFloat(order.totalAmount) || parseFloat(order.amount) || 0;
                                    
                                    return (
                                        <tr key={order._id || index} className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-200 group">
                                            <td className="px-6 py-4">
                                                <div>
                                                    <p className="font-semibold text-gray-800">#{order.voucher || 'N/A'}</p>
                                                    <p className="text-xs text-gray-500">ID: {order.customerID}</p>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div>
                                                    <p className="font-semibold text-gray-800">{order.name || 'Unknown'}</p>
                                                    <p className="text-sm text-gray-500">{order.contact || 'N/A'}</p>
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
                                            </td>
                                            <td className="px-6 py-4">
                                                <div>
                                                    <p className="text-sm font-medium text-gray-800">{orderDateStr}</p>
                                                    {orderTime && (
                                                        <p className="text-xs text-gray-500 flex items-center gap-1">
                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                            </svg>
                                                            {orderTime}
                                                        </p>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="font-bold text-gray-800 text-lg">৳{orderAmount.toLocaleString()}</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-center gap-2">
                                                    <Link
                                                        to={`/invoice/${order._id}`}
                                                        target="_blank"
                                                        className="p-2 bg-blue-100 hover:bg-blue-200 rounded-lg transition-all duration-200 group/view"
                                                        title="View Invoice"
                                                    >
                                                        <svg className="w-5 h-5 text-blue-600 group-hover/view:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                        </svg>
                                                    </Link>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Orders;

