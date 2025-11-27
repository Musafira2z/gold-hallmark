import React, { useState } from "react";
import {
  Card,
  Typography,
  List,
  ListItem,
  ListItemPrefix,
  Accordion,
  AccordionHeader,
  AccordionBody,
} from "@material-tailwind/react";
import {
  ShoppingBagIcon,
  UserCircleIcon,
  InboxIcon,
  UserGroupIcon,
  UserIcon,
  CheckBadgeIcon,
  PencilSquareIcon,
  CircleStackIcon,
  HomeIcon,
} from "@heroicons/react/24/solid";
import { ChevronRightIcon, ChevronDownIcon } from "@heroicons/react/24/outline";
import { Link } from "react-router-dom";
import { UserMinusIcon } from "@heroicons/react/16/solid";
import { TruckIcon } from "@heroicons/react/24/solid";

function Sidebar() {
  const [open, setOpen] = useState(0);
  const [isCollapsed, setIsCollapsed] = useState(false); // Sidebar state

  const handleOpen = (value) => {
    setOpen(open === value ? 0 : value);
  };

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  const handleIconClick = (value) => {
    if (isCollapsed) {
      setIsCollapsed(false); // Expand sidebar on icon click
      setOpen(value); // Open the corresponding section
    } else {
      setOpen(open === value ? 0 : value); // Toggle the section
    }
  };

  const menuItems = [
    {
      id: 1,
      icon: <UserGroupIcon className="h-5 w-5" />,
      title: "Customers Info",
      items: [
        {
          id: 1,
          title: "Add Customer",
          link: "/add-customer",
        },
      ],
    },
    {
      id: 2,
      icon: <ShoppingBagIcon className="h-5 w-5" />,
      title: "Service",
      items: [
        {
          id: 4,
          title: "Hallmark",
          link: "/hallmark",
        },
        {
          id: 3,
          title: "XRay",
          link: "/xray",
        },
        {
          id: 1,
          title: "Melting",
        },
        {
          id: 2,
          title: "Normal Melting",
        }
      ],
    },
    {
      id: 2.5,
      icon: <InboxIcon className="h-5 w-5" />,
      title: "Orders",
      items: [
        {
          id: 1,
          title: "All Orders",
          link: "/orders",
        },
      ],
    },
    {
      id: 3,
      icon: <TruckIcon className="h-5 w-5" />,
      title: "Delivery",
      items: [
        {
          id: 1,
          title: "Delivery List",
          link: "",
        },
      ],
    },
    {
      id: 4,
      icon: <UserCircleIcon className="h-5 w-5" />,
      title: "Account",
      items: [
        {
          id: 1,
          title: "Account Overview",
          link: "/account",
        },
      ],
    },
    {
      id: 5,
      icon: <CheckBadgeIcon className="h-5 w-5" />,
      title: "Confirmation",
      items: [
        {
          id: 1,
          title: "Confirmation",
          link: "",
        },
      ],
    },
    {
      id: 6,
      icon: <PencilSquareIcon className="h-5 w-5" />,
      title: "Daily Summery",
      items: [
        {
          id: 1,
          title: "Day Summary",
          link: "/summary",
        },
      ],
    },
    {
      id: 7,
      icon: <CircleStackIcon className="h-5 w-5" />,
      title: "Database Backup",
      items: [
        {
          id: 1,
          title: "Database",
          link: "",
        },
      ],
    },
    {
      id: 8,
      icon: <UserIcon className="h-5 w-5" />,
      title: "Client",
      items: [
        {
          id: 1,
          title: "Client",
          link: "",
        },
      ],
    },
  ];

  return (
    <div className="flex h-full flex-shrink-0">
      {/* Modern Sidebar with Blue Gradient */}
      <div
        className={`h-full bg-gradient-to-b from-blue-700 via-blue-800 to-indigo-900 transition-all duration-300 ${
          isCollapsed ? "w-20" : "w-64"
        } shadow-2xl z-50 overflow-y-auto`}
      >
        <div className="p-4">
          {/* Toggle Button */}
          <button
            onClick={toggleSidebar}
            className="w-full p-3 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-lg transition-all duration-200 flex items-center justify-center text-white mb-4 shadow-lg border border-white/10"
          >
            {isCollapsed ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            )}
          </button>

          {/* Dashboard Link */}
          <Link
            to="/"
            className={`w-full flex items-center ${
              isCollapsed ? "justify-center px-2 py-3" : "px-4 py-3"
            } rounded-lg transition-all duration-200 text-blue-100 hover:bg-white/10 hover:text-white mb-4`}
          >
            <div className="flex items-center space-x-3">
              <HomeIcon className="h-5 w-5 text-blue-200" />
              {!isCollapsed && (
                <span className="font-semibold text-sm">Dashboard</span>
              )}
            </div>
          </Link>

          {/* Sidebar Menu */}
          <div className="space-y-2">
            {menuItems.map((menuItem) => (
              <div key={menuItem.id} className="mb-2">
                <button
                  onClick={() => handleIconClick(menuItem.id)}
                  className={`w-full flex items-center ${
                    isCollapsed ? "justify-center px-2 py-3" : "justify-between px-4 py-3"
                  } rounded-lg transition-all duration-200 ${
                    !isCollapsed && open === menuItem.id
                      ? "bg-white text-blue-700 shadow-lg"
                      : "text-blue-100 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`${!isCollapsed && open === menuItem.id ? "text-blue-600" : "text-blue-200"}`}>
                      {menuItem.icon}
                    </div>
                    {!isCollapsed && (
                      <span className="font-semibold text-sm">{menuItem.title}</span>
                    )}
                  </div>
                  {!isCollapsed && (
                    <ChevronDownIcon
                      className={`w-4 h-4 transition-transform duration-200 ${
                        open === menuItem.id ? "rotate-180" : ""
                      }`}
                    />
                  )}
                </button>

                {/* Submenu */}
                {!isCollapsed && open === menuItem.id && (
                  <div className="mt-2 ml-4 space-y-1 border-l-2 border-blue-400/30 pl-4">
                    {menuItem.items.map((item) => (
                      <div key={item.id}>
                        {item.link ? (
                          <Link
                            to={item.link}
                            className="flex items-center space-x-2 px-3 py-2 text-sm text-blue-200 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-200"
                          >
                            <ChevronRightIcon className="w-3 h-3" />
                            <span>{item.title}</span>
                          </Link>
                        ) : (
                          <div className="flex items-center space-x-2 px-3 py-2 text-sm text-blue-300/50">
                            <ChevronRightIcon className="w-3 h-3" />
                            <span>{item.title}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Sidebar;