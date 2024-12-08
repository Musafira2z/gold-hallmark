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
          title: "Add Customers",
          link: "/",
        },
      ],
    },
    {
      id: 2,
      icon: <ShoppingBagIcon className="h-5 w-5" />,
      title: "Service",
      items: [
        {
          id: 1,
          title: "Melting",
        },
        {
          id: 2,
          title: "Normal Melting",
        },
        {
          id: 3,
          title: "XRay",
          link: "/xray",
        },
        {
          id: 4,
          title: "Hallmark",
          link: "/hallmark",
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
          title: "Add Customers",
          link: "/",
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
          title: "Account",
          link: "/",
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
          link: "/",
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
          link: "/",
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
          link: "/",
        },
      ],
    },
  ];

  return (
    <div className="flex">
      {/* Sidebar */}
      <Card
        className={`h-full transition-all ${isCollapsed ? "w-20" : "w-64"
          } max-w-fit lg:max-w-[20rem] p-4 shadow-xl shadow-blue-gray-900/5`}
      >
        {/* Toggle Button */}
        <button
          onClick={toggleSidebar}
          className="p-2 bg-blue-gray-100 rounded hover:bg-blue-gray-200 transition text-[#004D40]"
        >
          {isCollapsed ? "Exp" : "Coll"}
        </button>

        {/* Sidebar Menu */}
        <List
        className=""
        >
          {menuItems.map((menuItem) => (
            <Accordion
              key={menuItem.id}
              open={!isCollapsed && open === menuItem.id}
              className=""
              icon={
                !isCollapsed && (
                  <ChevronDownIcon
                    strokeWidth={2.5}
                    className={`mx-auto h-0 w-4 transition-transform text-[#004D40] ${open === menuItem.id ? "rotate-180" : ""
                      }`}
                  />
                )
              }
            >
              <ListItem
                className={`flex items-center text-[#004D40] text-xl${isCollapsed
                  ? "hover:bg-blue-gray-100 rounded-full px-2 w-12 justify-center text-[#004D40] text-xl"
                  : "hover:bg-blue-gray-50 rounded-lg px-3 text-[#004D40] text-xl"
                  } transition-all`}
                selected={!isCollapsed && open === menuItem.id}
                onClick={() => handleIconClick(menuItem.id)}
              >
                <AccordionHeader
                  className="border-b-0 text-[#004D40] p-0"
                  onClick={(e) => e.preventDefault()} // Prevent auto toggle
                >
                  <ListItemPrefix>
                    {menuItem.icon}
                  </ListItemPrefix>
                  {!isCollapsed && (
                    <Typography
                      
                      className="mr-auto  font-bold text-[#004D40]"
                    >
                      {menuItem.title}
                    </Typography>
                  )}
                </AccordionHeader>
              </ListItem>
              {!isCollapsed && (
                <AccordionBody className="py-0">
                  <List className="p-0">
                    {menuItem.items.map((item) => (
                      <ListItem key={item.id}>
                        <ListItemPrefix>
                          <ChevronRightIcon
                            strokeWidth={3}
                            className="h-3 w-5"
                          />
                        </ListItemPrefix>
                        {item.link ? (
                          <Link to={item.link} className="text-[#004D40]">
                            {item.title} 
                          </Link>
                        ) : (
                          item.title
                        )}
                      </ListItem>
                    ))}
                  </List>
                </AccordionBody>
              )}
            </Accordion>
          ))}
        </List>
      </Card>
    </div>
  );
}

export default Sidebar;