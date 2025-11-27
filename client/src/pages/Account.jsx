import React, { useState, useEffect } from "react";
import axios from "axios";
import { apiUrl } from "../context/UserContext.jsx";

const Account = () => {
    const [stats, setStats] = useState({
        totalCustomers: 0,
        totalOrders: 0,
        totalRevenue: 0,
        todayRevenue: 0,
        thisMonthRevenue: 0,
        thisYearRevenue: 0
    });
    const [loading, setLoading] = useState(true);
    const [recentActivity, setRecentActivity] = useState([]);

    useEffect(() => {
        fetchAccountData();
    }, []);

    const fetchAccountData = async () => {
        try {
            // Fetch customers
            const customersResponse = await axios.get(`${apiUrl}/users`);
            const customers = customersResponse.data || [];
            
            // Fetch orders
            const ordersResponse = await axios.get(`${apiUrl}/orders`);
            const orders = ordersResponse.data || [];
            
            // Calculate today's date
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayEnd = new Date();
            todayEnd.setHours(23, 59, 59, 999);
            
            // Calculate this month
            const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
            const thisMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
            
            // Calculate this year
            const thisYearStart = new Date(today.getFullYear(), 0, 1);
            const thisYearEnd = new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999);
            
            // Calculate revenues
            const totalRevenue = orders.reduce((sum, order) => {
                const amount = parseFloat(order.totalAmount) || parseFloat(order.amount) || 0;
                return sum + amount;
            }, 0);
            
            const todayOrders = orders.filter(order => {
                if (!order.createdAt) return false;
                const orderDate = new Date(order.createdAt);
                return orderDate >= today && orderDate <= todayEnd;
            });
            
            const todayRevenue = todayOrders.reduce((sum, order) => {
                const amount = parseFloat(order.totalAmount) || parseFloat(order.amount) || 0;
                return sum + amount;
            }, 0);
            
            const thisMonthOrders = orders.filter(order => {
                if (!order.createdAt) return false;
                const orderDate = new Date(order.createdAt);
                return orderDate >= thisMonthStart && orderDate <= thisMonthEnd;
            });
            
            const thisMonthRevenue = thisMonthOrders.reduce((sum, order) => {
                const amount = parseFloat(order.totalAmount) || parseFloat(order.amount) || 0;
                return sum + amount;
            }, 0);
            
            const thisYearOrders = orders.filter(order => {
                if (!order.createdAt) return false;
                const orderDate = new Date(order.createdAt);
                return orderDate >= thisYearStart && orderDate <= thisYearEnd;
            });
            
            const thisYearRevenue = thisYearOrders.reduce((sum, order) => {
                const amount = parseFloat(order.totalAmount) || parseFloat(order.amount) || 0;
                return sum + amount;
            }, 0);
            
            setStats({
                totalCustomers: customers.length,
                totalOrders: orders.length,
                totalRevenue: totalRevenue,
                todayRevenue: todayRevenue,
                thisMonthRevenue: thisMonthRevenue,
                thisYearRevenue: thisYearRevenue
            });
            
            // Get recent activity (last 10 orders)
            const sortedOrders = [...orders].sort((a, b) => {
                const dateA = new Date(a.createdAt || a.customerFrom || 0);
                const dateB = new Date(b.createdAt || b.customerFrom || 0);
                return dateB - dateA;
            });
            setRecentActivity(sortedOrders.slice(0, 10));
            
        } catch (error) {
            console.error("Error fetching account data:", error);
        } finally {
            setLoading(false);
        }
    };

    const StatCard = ({ title, value, icon, bgColor, subtitle }) => (
        <div className={`${bgColor} rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1`}>
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-white/80 text-sm font-medium mb-1">{title}</p>
                    <h3 className="text-3xl font-bold">{value}</h3>
                    {subtitle && <p className="text-white/60 text-xs mt-1">{subtitle}</p>}
                </div>
                <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                    {icon}
                </div>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Account Overview</h1>
                    <p className="text-gray-500 mt-1">Complete financial and business account summary</p>
                </div>
                <button
                    onClick={fetchAccountData}
                    disabled={loading}
                    className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium shadow-sm hover:shadow-md transition-all duration-200 flex items-center gap-2 disabled:opacity-50"
                    title="Refresh data"
                >
                    <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh
                </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <StatCard 
                    title="Total Customers" 
                    value={stats.totalCustomers}
                    subtitle="Registered customers"
                    bgColor="bg-gradient-to-br from-blue-500 to-blue-700"
                    icon={
                        <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                    }
                />
                <StatCard 
                    title="Total Orders" 
                    value={stats.totalOrders}
                    subtitle="All time orders"
                    bgColor="bg-gradient-to-br from-teal-500 to-cyan-600"
                    icon={
                        <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                        </svg>
                    }
                />
                <StatCard 
                    title="Total Revenue" 
                    value={`৳${stats.totalRevenue.toLocaleString()}`}
                    subtitle="All time earnings"
                    bgColor="bg-gradient-to-br from-purple-500 to-indigo-700"
                    icon={
                        <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    }
                />
                <StatCard 
                    title="Today's Revenue" 
                    value={`৳${stats.todayRevenue.toLocaleString()}`}
                    subtitle="Revenue today"
                    bgColor="bg-gradient-to-br from-green-600 to-emerald-700"
                    icon={
                        <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    }
                />
                <StatCard 
                    title="This Month" 
                    value={`৳${stats.thisMonthRevenue.toLocaleString()}`}
                    subtitle="Current month revenue"
                    bgColor="bg-gradient-to-br from-amber-500 to-orange-600"
                    icon={
                        <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    }
                />
                <StatCard 
                    title="This Year" 
                    value={`৳${stats.thisYearRevenue.toLocaleString()}`}
                    subtitle="Current year revenue"
                    bgColor="bg-gradient-to-br from-green-600 to-pink-700"
                    icon={
                        <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    }
                />
            </div>

            {/* Revenue Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Revenue Summary */}
                <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
                        <h3 className="text-lg font-bold text-white">Revenue Summary</h3>
                        <p className="text-blue-100 text-sm">Financial breakdown</p>
                    </div>
                    <div className="p-6 space-y-4 bg-gray-50">
                        <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-700">Total Revenue</p>
                                    <p className="text-lg font-bold text-gray-900">৳{stats.totalRevenue.toLocaleString()}</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                                    <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-700">Today's Revenue</p>
                                    <p className="text-lg font-bold text-gray-900">৳{stats.todayRevenue.toLocaleString()}</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                                    <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-700">This Month</p>
                                    <p className="text-lg font-bold text-gray-900">৳{stats.thisMonthRevenue.toLocaleString()}</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-rose-100 rounded-lg flex items-center justify-center">
                                    <svg className="w-5 h-5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-700">This Year</p>
                                    <p className="text-lg font-bold text-gray-900">৳{stats.thisYearRevenue.toLocaleString()}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
                        <h3 className="text-lg font-bold text-white">Recent Activity</h3>
                        <p className="text-blue-100 text-sm">Latest transactions</p>
                    </div>
                    <div className="p-6">
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                            </div>
                        ) : recentActivity.length === 0 ? (
                            <div className="text-center py-12 text-gray-400">
                                <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                                <p className="text-lg font-medium">No recent activity</p>
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-96 overflow-y-auto">
                                {recentActivity.map((order, index) => {
                                    const orderDate = order.createdAt 
                                        ? new Date(order.createdAt)
                                        : order.customerFrom 
                                            ? new Date(order.customerFrom)
                                            : null;
                                    
                                    const orderDateStr = orderDate 
                                        ? orderDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                        : 'N/A';
                                    
                                    const orderTime = orderDate 
                                        ? orderDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
                                        : '';
                                    
                                    const orderAmount = parseFloat(order.totalAmount) || parseFloat(order.amount) || 0;
                                    
                                    return (
                                        <div key={order._id || index} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors shadow-sm">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                                                    order.type === 'hallmark' 
                                                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600' 
                                                        : order.type === 'xray' 
                                                            ? 'bg-gradient-to-r from-purple-600 to-indigo-600'
                                                            : 'bg-gradient-to-r from-gray-600 to-gray-700'
                                                }`}>
                                                    {order.name?.charAt(0)?.toUpperCase() || 'O'}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-gray-900 text-sm">{order.name || 'Unknown'}</p>
                                                    <p className="text-xs text-gray-600">{orderDateStr} {orderTime && `• ${orderTime}`}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-gray-900">৳{orderAmount.toLocaleString()}</p>
                                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                                    order.type === 'hallmark' 
                                                        ? 'bg-blue-100 text-blue-700' 
                                                        : order.type === 'xray' 
                                                            ? 'bg-purple-100 text-purple-700'
                                                            : 'bg-gray-100 text-gray-700'
                                                }`}>
                                                    {order.type ? order.type.toUpperCase() : 'ORDER'}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Account;

