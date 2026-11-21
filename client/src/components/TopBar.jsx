import { Link } from "react-router-dom";
import GlobalSearch from "./GlobalSearch.jsx";
import { useAuth } from "../context/AuthContext.jsx";

// One thin bar: logo + name, customer search, today's date.
function TopBar() {
    const { staff, logout } = useAuth();
    const today = new Date().toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Dhaka",
    });

    return (
        <header className="flex h-14 flex-shrink-0 items-center gap-4 border-b border-gray-200 bg-white px-3 lg:px-4">
            <Link to="/" className="flex flex-shrink-0 items-center gap-2" title="Today">
                <img src="/logo.png" alt="" className="h-9 w-9 rounded-full object-cover" />
                <span className="hidden md:block font-bold text-gray-900 leading-tight">
                    Sylhet Gold
                    <span className="block text-xs font-medium text-gray-500">Hallmark Center</span>
                </span>
            </Link>
            <div className="flex flex-1 justify-center">
                <GlobalSearch />
            </div>
            <span className="hidden lg:block flex-shrink-0 text-sm text-gray-600">{today}</span>
            <div className="flex flex-shrink-0 items-center gap-2 text-sm">
                <Link to="/account/password" className="hidden sm:block text-right leading-tight hover:underline" title="Change my password">
                    <span className="block font-medium text-gray-900">{staff?.name}</span>
                    <span className="block text-xs capitalize text-gray-500">{staff?.role}</span>
                </Link>
                <button type="button" onClick={logout}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-50">
                    Log out
                </button>
            </div>
        </header>
    );
}

export default TopBar;
