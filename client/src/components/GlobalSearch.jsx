import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { UserContext } from "../context/UserContext.jsx";
import { searchCustomers, companyText } from "../utils/customerSearch.js";
import { formatContactForDisplay } from "../utils/formatContact.js";

const MAX_RESULTS = 8;

// Search box in the top bar: type an ID, name, phone or shop, press Enter,
// and you land on that customer's page. Press "/" anywhere to jump here.
function GlobalSearch() {
    const { customers, loading } = useContext(UserContext);
    const navigate = useNavigate();
    const inputRef = useRef(null);
    const [text, setText] = useState("");
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);

    const results = useMemo(
        () => (text.trim() ? searchCustomers(customers, text, MAX_RESULTS) : []),
        [customers, text]
    );

    useEffect(() => {
        const onKey = (e) => {
            const tag = document.activeElement?.tagName;
            if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") {
                e.preventDefault();
                inputRef.current?.focus();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    const go = (customer) => {
        setText("");
        setOpen(false);
        inputRef.current?.blur();
        navigate(`/customers/${customer.customerID}`);
    };

    const onKeyDown = (e) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, results.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
        } else if (e.key === "Enter" && results[active]) {
            e.preventDefault();
            go(results[active]);
        } else if (e.key === "Escape") {
            setOpen(false);
            inputRef.current?.blur();
        }
    };

    return (
        <div className="relative w-full max-w-xl">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
                ref={inputRef}
                type="search"
                value={text}
                onChange={(e) => {
                    setText(e.target.value);
                    setActive(0);
                    setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
                onKeyDown={onKeyDown}
                placeholder={loading ? "Loading customers…" : "Find customer: ID, name, phone or shop   ( / )"}
                aria-label="Find customer"
                role="combobox"
                aria-expanded={open && text.trim() !== ""}
                aria-controls="global-search-results"
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            {open && text.trim() !== "" && (
                <ul
                    id="global-search-results"
                    role="listbox"
                    className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg"
                >
                    {results.length === 0 ? (
                        <li className="px-4 py-3 text-sm text-gray-500">
                            {loading ? "Loading customers…" : "No customer found."}{" "}
                            {!loading && (
                                <button
                                    type="button"
                                    className="font-semibold text-blue-700 hover:underline"
                                    onMouseDown={() => navigate("/customers?new=1")}
                                >
                                    Add new customer
                                </button>
                            )}
                        </li>
                    ) : (
                        results.map((c, i) => (
                            <li
                                key={c._id || c.customerID}
                                role="option"
                                aria-selected={i === active}
                                onMouseDown={() => go(c)}
                                onMouseEnter={() => setActive(i)}
                                className={`flex cursor-pointer items-center gap-3 px-4 py-2 text-sm ${i === active ? "bg-blue-50" : ""}`}
                            >
                                <span className="w-12 flex-shrink-0 font-mono text-gray-500">#{c.customerID}</span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate font-medium text-gray-900">{c.name}</span>
                                    <span className="block truncate text-xs text-gray-500">{companyText(c.company)}</span>
                                </span>
                                <span className="hidden sm:block flex-shrink-0 text-xs text-gray-500">
                                    {formatContactForDisplay(c.contact)}
                                </span>
                            </li>
                        ))
                    )}
                </ul>
            )}
        </div>
    );
}

export default GlobalSearch;
