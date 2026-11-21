import { NavLink } from "react-router-dom";
import { HomeIcon, PlusCircleIcon, UserGroupIcon, DocumentTextIcon, KeyIcon, ClockIcon } from "@heroicons/react/24/outline";
import { useAuth } from "../context/AuthContext.jsx";

// Five plain links, no dropdowns. On small screens only the icons show.
const LINKS = [
    { to: "/", label: "Today", icon: HomeIcon, end: true },
    { to: "/hallmark", label: "New Hallmark", icon: PlusCircleIcon },
    { to: "/xray", label: "New X-ray", icon: PlusCircleIcon, accent: "text-purple-600" },
    { to: "/customers", label: "Customers", icon: UserGroupIcon },
    { to: "/orders", label: "Orders", icon: DocumentTextIcon },
];
// Owner only.
const OWNER_LINKS = [
    { to: "/staff", label: "Staff", icon: KeyIcon },
    { to: "/activity", label: "Activity", icon: ClockIcon },
];

function Sidebar() {
    const { isOwner } = useAuth();
    const links = isOwner ? [...LINKS, ...OWNER_LINKS] : LINKS;
    return (
        <nav aria-label="Main" className="w-16 lg:w-52 flex-shrink-0 bg-white border-r border-gray-200 overflow-y-auto">
            <ul className="p-2 space-y-1">
                {links.map(({ to, label, icon: Icon, end, accent }) => (
                    <li key={to}>
                        <NavLink
                            to={to}
                            end={end}
                            title={label}
                            className={({ isActive }) =>
                                `flex items-center justify-center lg:justify-start gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                                    isActive ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-100"
                                }`
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    <Icon className={`h-5 w-5 flex-shrink-0 ${isActive ? "text-blue-600" : accent || "text-gray-500"}`} />
                                    <span className="hidden lg:inline">{label}</span>
                                </>
                            )}
                        </NavLink>
                    </li>
                ))}
            </ul>
        </nav>
    );
}

export default Sidebar;
