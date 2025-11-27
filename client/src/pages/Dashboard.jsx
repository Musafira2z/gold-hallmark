import React, { useContext, useState, useEffect, useCallback } from "react";
import { UserContext } from "../context/UserContext.jsx";
import { Link, useLocation } from "react-router-dom";
import axios from "axios";
import { apiUrl } from "../context/UserContext.jsx";
import GoldAnimation from "../components/GoldAnimation.jsx";

const Dashboard = () => {
    const { customers } = useContext(UserContext);
    const [stats, setStats] = useState({
        totalOrders: 0,
        todayOrders: 0,
        totalRevenue: 0,
        pendingOrders: 0
    });
    const [recentOrders, setRecentOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [revenueData, setRevenueData] = useState([]); // For chart
    const [revenuePeriod, setRevenuePeriod] = useState('7days'); // Filter period: '7days', '30days', '1year'

    const calculateRevenueData = useCallback((orders, period) => {
        const data = [];
        let days = 0;
        let dateFormat = {};
        
        if (period === '7days') {
            days = 7;
            dateFormat = { month: 'short', day: 'numeric' };
        } else if (period === '30days') {
            days = 30;
            dateFormat = { month: 'short', day: 'numeric' };
        } else if (period === '1year') {
            days = 12; // 12 months
            dateFormat = { month: 'short' };
        }
        
        if (period === '1year') {
            // Monthly data for 1 year
            for (let i = 11; i >= 0; i--) {
                const date = new Date();
                date.setMonth(date.getMonth() - i);
                date.setDate(1);
                date.setHours(0, 0, 0, 0);
                
                const nextMonth = new Date(date);
                nextMonth.setMonth(nextMonth.getMonth() + 1);
                const dateEnd = new Date(nextMonth.getTime() - 1);
                dateEnd.setHours(23, 59, 59, 999);
                
                const monthOrders = orders.filter(order => {
                    if (!order.createdAt) return false;
                    const orderDate = new Date(order.createdAt);
                    return orderDate >= date && orderDate <= dateEnd;
                });
                
                const monthRevenue = monthOrders.reduce((sum, order) => {
                    const amount = parseFloat(order.totalAmount) || parseFloat(order.amount) || 0;
                    return sum + amount;
                }, 0);
                
                data.push({
                    date: date.toLocaleDateString('en-US', dateFormat),
                    revenue: monthRevenue
                });
            }
        } else {
            // Daily data for 7 or 30 days
            for (let i = days - 1; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                date.setHours(0, 0, 0, 0);
                const dateEnd = new Date(date);
                dateEnd.setHours(23, 59, 59, 999);
                
                const dayOrders = orders.filter(order => {
                    if (!order.createdAt) return false;
                    const orderDate = new Date(order.createdAt);
                    return orderDate >= date && orderDate <= dateEnd;
                });
                
                const dayRevenue = dayOrders.reduce((sum, order) => {
                    const amount = parseFloat(order.totalAmount) || parseFloat(order.amount) || 0;
                    return sum + amount;
                }, 0);
                
                data.push({
                    date: date.toLocaleDateString('en-US', dateFormat),
                    revenue: dayRevenue
                });
            }
        }
        
        return data;
    }, []);

    const fetchDashboardData = useCallback(async () => {
        try {
            const response = await axios.get(`${apiUrl}/orders`);
            const orders = response.data || [];
            
            // Calculate stats
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayEnd = new Date();
            todayEnd.setHours(23, 59, 59, 999);
            
            const todayOrders = orders.filter(order => {
                if (!order.createdAt) return false;
                const orderDate = new Date(order.createdAt);
                return orderDate >= today && orderDate <= todayEnd;
            });
            
            // Use totalAmount instead of amount
            const totalRevenue = orders.reduce((sum, order) => {
                const amount = parseFloat(order.totalAmount) || parseFloat(order.amount) || 0;
                return sum + amount;
            }, 0);
            
            setStats({
                totalOrders: orders.length,
                todayOrders: todayOrders.length,
                totalRevenue: totalRevenue,
                pendingOrders: orders.filter(o => o.status === 'pending').length
            });
            
            // Get recent 5 orders sorted by createdAt
            const sortedOrders = [...orders].sort((a, b) => {
                const dateA = new Date(a.createdAt || a.customerFrom || 0);
                const dateB = new Date(b.createdAt || b.customerFrom || 0);
                return dateB - dateA;
            });
            setRecentOrders(sortedOrders.slice(0, 5));
            
            // Calculate revenue data based on current period
            setRevenueData(calculateRevenueData(orders, revenuePeriod));
        } catch (error) {
            console.error("Error fetching dashboard data:", error);
        } finally {
            setLoading(false);
        }
    }, [calculateRevenueData, revenuePeriod]);

    useEffect(() => {
        fetchDashboardData();
        
        // Auto-refresh every 30 seconds for real-time updates
        const interval = setInterval(() => {
            fetchDashboardData();
        }, 30000);
        
        return () => clearInterval(interval);
    }, [fetchDashboardData, revenuePeriod]);

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

    // Revenue Chart Component
    const RevenueChart = () => {
        const chartHeight = 200;
        const maxRevenue = revenueData.length > 0 
            ? Math.max(...revenueData.map(d => d.revenue), 1) 
            : 1;
        
        const getPeriodLabel = () => {
            if (revenuePeriod === '7days') return 'Last 7 days';
            if (revenuePeriod === '30days') return 'Last 30 days';
            if (revenuePeriod === '1year') return 'Last 12 months';
            return 'Revenue';
        };
        
        const getTotalLabel = () => {
            if (revenuePeriod === '7days') return 'Total (7 days)';
            if (revenuePeriod === '30days') return 'Total (30 days)';
            if (revenuePeriod === '1year') return 'Total (12 months)';
            return 'Total';
        };
        
        return (
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
                <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-bold text-white">Revenue Trend</h3>
                            <p className="text-emerald-100 text-sm">{getPeriodLabel()} revenue</p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setRevenuePeriod('7days')}
                                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                                    revenuePeriod === '7days'
                                        ? 'bg-gray-200 text-emerald-700 shadow-md hover:bg-gray-300'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                            >
                                7 Days
                            </button>
                            <button
                                onClick={() => setRevenuePeriod('30days')}
                                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                                    revenuePeriod === '30days'
                                        ? 'bg-gray-200 text-emerald-700 shadow-md hover:bg-gray-300'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                            >
                                30 Days
                            </button>
                            <button
                                onClick={() => setRevenuePeriod('1year')}
                                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                                    revenuePeriod === '1year'
                                        ? 'bg-gray-200 text-emerald-700 shadow-md hover:bg-gray-300'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                            >
                                1 Year
                            </button>
                        </div>
                    </div>
                </div>
                <div className="p-6">
                    {revenueData.length === 0 ? (
                        <div className="flex items-center justify-center h-64 text-gray-400">
                            <div className="text-center">
                                <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                                <p className="text-lg font-medium">No revenue data available</p>
                                <p className="text-sm">Revenue will appear here once orders are created</p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-end justify-between gap-2 h-64">
                            {revenueData.map((day, index) => {
                            const barHeight = maxRevenue > 0 ? (day.revenue / maxRevenue) * chartHeight : 0;
                            const dateParts = day.date.split(' ');
                            const actualHeight = Math.max(barHeight, day.revenue > 0 ? 8 : 0); // Minimum 8px for visibility
                            return (
                                <div key={index} className="flex-1 flex flex-col items-center gap-2">
                                    <div className="relative w-full flex items-end justify-center" style={{ height: `${chartHeight}px` }}>
                                        {day.revenue > 0 ? (
                                            <div 
                                                className="w-full bg-gradient-to-t from-purple-600 to-indigo-600 rounded-t-lg transition-all duration-300 hover:from-purple-700 hover:to-indigo-700 cursor-pointer shadow-md"
                                                style={{ 
                                                    height: `${actualHeight}px`,
                                                    minHeight: '8px'
                                                }}
                                                title={`${day.date}: ৳${day.revenue.toLocaleString()}`}
                                            />
                                        ) : (
                                            <div 
                                                className="w-full bg-gray-200 rounded-t-lg opacity-30"
                                                style={{ 
                                                    height: '4px'
                                                }}
                                                title={`${day.date}: No revenue`}
                                            />
                                        )}
                                    </div>
                                    <div className="text-xs text-gray-600 font-medium mt-2 text-center">
                                        {revenuePeriod === '1year' ? (
                                            <div className="font-semibold">{day.date}</div>
                                        ) : (
                                            <>
                                                <div className="text-gray-400 text-[10px]">{dateParts[0]}</div>
                                                <div className="font-semibold">{dateParts[1]}</div>
                                            </>
                                        )}
                                    </div>
                                    {day.revenue > 0 && (
                                        <div className="text-xs font-bold text-purple-600 mt-1">
                                            {day.revenue >= 1000000 
                                                ? `৳${(day.revenue / 1000000).toFixed(1)}M`
                                                : day.revenue >= 1000
                                                    ? `৳${(day.revenue / 1000).toFixed(1)}k`
                                                    : `৳${day.revenue}`
                                            }
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        </div>
                    )}
                    {revenueData.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between text-sm">
                            <span className="text-gray-600">{getTotalLabel()}:</span>
                            <span className="font-bold text-gray-800">
                                ৳{revenueData.reduce((sum, d) => sum + d.revenue, 0).toLocaleString()}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const location = useLocation();
    const [showGoldAnimation, setShowGoldAnimation] = useState(false);

    useEffect(() => {
        // Show animation when Dashboard loads
        if (location.pathname === '/') {
            setShowGoldAnimation(true);
            const timer = setTimeout(() => {
                setShowGoldAnimation(false);
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [location.pathname]);

    return (
        <div className="space-y-6 relative">
            {/* Gold Animation */}
            {showGoldAnimation && <GoldAnimation />}
            
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
                    <p className="text-gray-500 mt-1">Welcome back! Here's what's happening today.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={fetchDashboardData}
                        disabled={loading}
                        className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium shadow-sm hover:shadow-md transition-all duration-200 flex items-center gap-2 disabled:opacity-50"
                        title="Refresh data"
                    >
                        <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Refresh
                    </button>
                    <Link 
                        to="/orders" 
                        className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-teal-600 text-white rounded-lg font-medium shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                        </svg>
                        All Orders
                    </Link>
                    <Link 
                        to="/add-customer" 
                        className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add Customer
                    </Link>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                    title="Total Customers" 
                    value={customers.length}
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
                    title="Today's Orders" 
                    value={stats.todayOrders}
                    subtitle="Orders received today"
                    bgColor="bg-gradient-to-br from-amber-500 to-orange-600"
                    icon={
                        <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
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
            </div>

            {/* Revenue Chart */}
            <RevenueChart />

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Orders */}
                <div className="lg:col-span-2 bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
                        <h3 className="text-lg font-bold text-white">Recent Orders</h3>
                        <p className="text-blue-100 text-sm">Latest transactions</p>
                    </div>
                    <div className="p-6">
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                            </div>
                        ) : recentOrders.length === 0 ? (
                            <div className="text-center py-12 text-gray-400">
                                <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                                <p className="text-lg font-medium">No orders yet</p>
                                <p className="text-sm">Orders will appear here</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {recentOrders.map((order, index) => {
                                    const orderDateTime = order.createdAt 
                                        ? new Date(order.createdAt)
                                        : order.customerFrom 
                                            ? new Date(order.customerFrom)
                                            : null;
                                    
                                    const orderDate = orderDateTime 
                                        ? orderDateTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                        : 'N/A';
                                    
                                    const orderTime = orderDateTime 
                                        ? orderDateTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
                                        : '';
                                    
                                    const orderAmount = parseFloat(order.totalAmount) || parseFloat(order.amount) || 0;
                                    
                                    return (
                                        <div key={order._id || index} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                                    {order.name?.charAt(0)?.toUpperCase() || 'O'}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-gray-800">{order.name || 'Unknown Customer'}</p>
                                                    <p className="text-sm text-gray-500">
                                                        {order.type ? order.type.charAt(0).toUpperCase() + order.type.slice(1) : 'Order'} • {orderDate}
                                                    </p>
                                                    {orderTime && (
                                                        <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                            </svg>
                                                            {orderTime}
                                                        </p>
                                                    )}
                                                    {order.voucher && (
                                                        <p className="text-xs text-gray-400 mt-0.5">Voucher: {order.voucher}</p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-gray-800 text-lg">৳{orderAmount.toLocaleString()}</p>
                                                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
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

                {/* Quick Actions */}
                <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
                        <h3 className="text-lg font-bold text-white">Quick Actions</h3>
                        <p className="text-blue-100 text-sm">Frequently used actions</p>
                    </div>
                    <div className="p-6 space-y-3">
                        <Link to="/add-customer" className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl hover:bg-blue-50 hover:border-blue-200 border border-transparent transition-all group">
                            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                </svg>
                            </div>
                            <div>
                                <p className="font-semibold text-gray-800">Add Customer</p>
                                <p className="text-sm text-gray-500">Register new customer</p>
                            </div>
                        </Link>
                        
                        <Link to="/hallmark" className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl hover:bg-emerald-50 hover:border-emerald-200 border border-transparent transition-all group">
                            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
                                <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                                </svg>
                            </div>
                            <div>
                                <p className="font-semibold text-gray-800">Hallmark</p>
                                <p className="text-sm text-gray-500">Create hallmark order</p>
                            </div>
                        </Link>
                        
                        <Link to="/xray" className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl hover:bg-purple-50 hover:border-purple-200 border border-transparent transition-all group">
                            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <div>
                                <p className="font-semibold text-gray-800">X-Ray</p>
                                <p className="text-sm text-gray-500">Create x-ray order</p>
                            </div>
                        </Link>
                        
                        <Link to="/summary" className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl hover:bg-amber-50 hover:border-amber-200 border border-transparent transition-all group">
                            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center group-hover:bg-amber-200 transition-colors">
                                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <div>
                                <p className="font-semibold text-gray-800">Day Summary</p>
                                <p className="text-sm text-gray-500">View daily report</p>
                            </div>
                        </Link>
                    </div>
                </div>
            </div>

            {/* Customer Overview */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-white">Customer Overview</h3>
                        <p className="text-blue-100 text-sm">Recent customers</p>
                    </div>
                    <Link to="/add-customer" className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm font-medium transition-colors">
                        View All
                    </Link>
                </div>
                <div className="p-6">
                    {customers.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">
                            <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            <p className="text-lg font-medium">No customers yet</p>
                            <p className="text-sm mb-4">Get started by adding your first customer</p>
                            <Link to="/add-customer" className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Add First Customer
                            </Link>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {customers.slice(-4).reverse().map((customer, index) => (
                                <div key={customer._id || index} className="p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold">
                                            {customer.name?.charAt(0) || 'C'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-gray-800 truncate">{customer.name}</p>
                                            <p className="text-xs text-gray-500">ID: {customer.customerID}</p>
                                        </div>
                                    </div>
                                    <div className="text-sm text-gray-600">
                                        <p className="flex items-center gap-1">
                                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                            </svg>
                                            {customer.contact}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;

