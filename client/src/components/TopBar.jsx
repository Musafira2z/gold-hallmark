import { Link } from "react-router-dom";
import GlobalSearch from "./GlobalSearch.jsx";

// One thin bar: logo + name, customer search, today's date.
function TopBar() {
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
            <span className="hidden sm:block flex-shrink-0 text-sm text-gray-600">{today}</span>
        </header>
    );
}

export default TopBar;
