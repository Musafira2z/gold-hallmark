import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const Navbar = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [currentTime, setCurrentTime] = useState(new Date());
    const [currentDate, setCurrentDate] = useState(new Date());

    // Update time every second
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    // Update date every minute (in case day changes)
    useEffect(() => {
        const dateTimer = setInterval(() => {
            setCurrentDate(new Date());
        }, 60000);

        return () => clearInterval(dateTimer);
    }, []);

    // Get page name from route
    const getPageName = () => {
        const path = location.pathname;
        if (path === '/') return 'Dashboard';
        if (path === '/add-customer') return 'Add Customer';
        if (path === '/orders') return 'All Orders';
        if (path === '/account') return 'Account Overview';
        if (path === '/hallmark') return 'Hallmark Orders';
        if (path === '/xray') return 'X-Ray Orders';
        if (path === '/summary') return 'Daily Summary';
        if (path.startsWith('/updateuser')) return 'Update Customer';
        return 'Dashboard';
    };

    // Format time
    const formatTime = (date) => {
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
    };

    // Format date
    const formatDate = (date) => {
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    return (
        <div className='w-full bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 border-b border-blue-500/30 shadow-lg'>
            <div className='px-4 lg:px-8 py-3 lg:py-4'>
                <div className='flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 lg:gap-0'>
                    {/* Left Section - Branding */}
                    <div className='flex items-center space-x-4'>
                        <div 
                            onClick={() => navigate('/')}
                            className='flex items-center justify-center w-14 h-14 lg:w-16 lg:h-16 bg-white/20 rounded-full backdrop-blur-sm overflow-hidden cursor-pointer hover:bg-white/30 transition-all duration-200 shadow-lg hover:shadow-xl'
                        >
                            <img 
                                src="/logo.png" 
                                alt="Logo" 
                                className='w-full h-full object-cover rounded-full'
                            />
                        </div>
                        <div>
                            <h1 className='font-extrabold bg-gradient-to-r from-white via-blue-100 to-cyan-200 bg-clip-text text-transparent text-xl lg:text-3xl tracking-wide drop-shadow-2xl' style={{ fontFamily: 'Georgia, serif', textShadow: '0 2px 10px rgba(255,255,255,0.3)' }}>
                                Sylhet Gold Hallmark Center
                            </h1>
                            <p className='text-white/95 text-xs lg:text-sm mt-1 font-semibold flex items-center gap-1.5'>
                                <span className='w-1.5 h-1.5 bg-cyan-300 rounded-full animate-pulse shadow-lg shadow-cyan-300/50'></span>
                                {getPageName()}
                            </p>
                        </div>
                    </div>

                    {/* Right Section - Info Cards */}
                    <div className='flex flex-wrap items-center gap-2 lg:gap-3 w-full lg:w-auto justify-end'>
                        {/* Current Date */}
                        <div className='flex items-center space-x-2 bg-white/10 backdrop-blur-sm px-3 py-2 rounded-lg border border-white/20'>
                            <svg className='w-4 h-4 text-white' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' />
                            </svg>
                            <span className='text-white text-xs lg:text-sm font-medium hidden sm:inline'>
                                {formatDate(currentDate)}
                            </span>
                            <span className='text-white text-xs font-medium sm:hidden'>
                                {currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                        </div>

                        {/* Current Time */}
                        <div className='flex items-center space-x-2 bg-white/10 backdrop-blur-sm px-3 py-2 rounded-lg border border-white/20'>
                            <svg className='w-4 h-4 text-white' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' />
                            </svg>
                            <span className='text-white text-xs lg:text-sm font-mono font-semibold'>
                                {formatTime(currentTime)}
                            </span>
                        </div>

                        {/* System Status */}
                        <div className='flex items-center space-x-2 bg-white/10 backdrop-blur-sm px-3 py-2 rounded-lg border border-white/20'>
                            <div className='w-2 h-2 bg-green-400 rounded-full animate-pulse shadow-lg shadow-green-400/50'></div>
                            <span className='text-white text-xs lg:text-sm font-medium hidden sm:inline'>System Online</span>
                            <span className='text-white text-xs font-medium sm:hidden'>Online</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Navbar;