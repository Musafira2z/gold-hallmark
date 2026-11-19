import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PropTypes from "prop-types";
import imageDefault from "../assets/imageDefault.png";
import axios from "axios";
import { Bounce, toast, ToastContainer } from "react-toastify";
import {apiUrl} from "../context/UserContext.jsx";
import UpdateUserModal from "./UpdateUserModal.jsx";
import { formatContactForDisplay } from "../utils/formatContact.js";

const PAGE_SIZE = 50;
const digits = (v) => String(v ?? "").replace(/\D/g, "");

// Match name, ID, phone (with or without the leading 0) or shop name.
const matches = (c, q) => {
    const text = q.trim().toLowerCase();
    if (!text) return true;
    if (String(c.name || "").toLowerCase().includes(text)) return true;
    if (String(c.customerID) === text) return true;
    const companies = Array.isArray(c.company) ? c.company : [c.company];
    if (companies.some((co) => String(co || "").toLowerCase().includes(text))) return true;
    const qd = digits(text);
    // Phone is shown with its leading 0 even when the DB lost it, so "0171..." and "171..." both match.
    return qd.length >= 3 && digits(formatContactForDisplay(c.contact)).includes(qd);
};

export function CustomerDetailTable({ customers, onRemoveCustomer }) {
    const [selectedCustomerId, setSelectedCustomerId] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);

    // Newest customers first (an exact ID match goes on top), then search, then 50 per page.
    const filtered = useMemo(() => {
        const exactId = (c) => String(c.customerID) === search.trim();
        return [...customers]
            .sort((a, b) => exactId(b) - exactId(a) || Number(b.customerID) - Number(a.customerID))
            .filter((c) => matches(c, search));
    }, [customers, search]);
    const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const currentPage = Math.min(page, pages);
    const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    const handleEdit = (id) => {
        setSelectedCustomerId(id);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedCustomerId(null);
    };

    const handleDelete = async (id) => {
        try {
            const response = await axios.delete(`${apiUrl}/users/delete/${id}`);
            toast('Delete Successful', {
                position: "top-right",
                autoClose: 500,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
                progress: undefined,
                theme: "light",
                transition: Bounce,
            });
            console.log(response.data.message);
            onRemoveCustomer(id);
        } catch (error) {
            console.error("Error deleting customer:", error);
        }
    };

    return (
        <div className="w-full bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Customer List
                </h3>
                <p className="text-blue-100 text-sm mt-1">{customers.length} customers registered</p>
            </div>

            {/* Search */}
            <div className="px-6 py-4 border-b border-gray-200 flex flex-wrap items-center gap-3">
                <input
                    type="search"
                    value={search}
                    onChange={(e) => {
                        setSearch(e.target.value);
                        setPage(1);
                    }}
                    placeholder="Nam, ID, phone ba dokan diye khujun"
                    className="flex-1 min-w-[16rem] border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    aria-label="Search customers"
                />
                {search && (
                    <span className="text-sm text-gray-600">{filtered.length} jon pawa geche</span>
                )}
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                Customer
                            </th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                Contact
                            </th>
                            <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {customers.length > 0 && filtered.length === 0 ? (
                            <tr>
                                <td colSpan="3" className="px-6 py-10 text-center text-gray-500">
                                    &quot;{search}&quot; diye kono customer pawa jay ni
                                </td>
                            </tr>
                        ) : customers.length === 0 ? (
                            <tr>
                                <td colSpan="3" className="px-6 py-12 text-center">
                                    <div className="flex flex-col items-center justify-center text-gray-400">
                                        <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                        </svg>
                                        <p className="text-lg font-medium">No customers yet</p>
                                        <p className="text-sm">Add your first customer using the form above</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            visible.map(({ _id, customerID, name, contact, image, address }) => {
                                const normalizedApiUrl = apiUrl?.endsWith("/") ? apiUrl.slice(0, -1) : apiUrl;
                                const imagePath = typeof image === "string" ? image.trim() : "";
                                const isAbsoluteUrl = /^https?:\/\//i.test(imagePath);
                                const relativePath = imagePath.startsWith("/") ? imagePath : `/${imagePath}`;
                                const imageSrc = imagePath
                                    ? (isAbsoluteUrl ? imagePath : `${normalizedApiUrl}${relativePath}`)
                                    : imageDefault;

                                return (
                                    <tr 
                                        key={_id} 
                                        className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-200 group"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-4">
                                                <div className="relative">
                                                    <img 
                                                        className="w-12 h-12 rounded-full object-cover border-2 border-gray-200 group-hover:border-blue-400 transition-colors shadow-sm" 
                                                        src={imageSrc} 
                                                        alt={`Customer ${name}`} 
                                                    />
                                                    <span className="absolute -top-1 -right-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-sm">
                                                        #{customerID}
                                                    </span>
                                                </div>
                                                <div>
                                                    <Link
                                                        to={`/customers/${customerID}`}
                                                        className="font-semibold text-gray-800 hover:text-blue-700 hover:underline transition-colors"
                                                    >
                                                        {name}
                                                    </Link>
                                                    <p className="text-xs text-gray-400">Customer ID: {customerID}</p>
                                                    {address && (
                                                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                            </svg>
                                                            {address.length > 30 ? `${address.substring(0, 30)}...` : address}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                                    </svg>
                                                </div>
                                                <span className="font-medium text-gray-700">{formatContactForDisplay(contact)}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-center gap-2">
                                                <button 
                                                    onClick={() => handleEdit(_id)}
                                                    className="p-2 bg-amber-100 hover:bg-amber-200 rounded-lg transition-all duration-200 group/edit"
                                                    title="Edit Customer"
                                                >
                                                    <svg className="w-5 h-5 text-amber-600 group-hover/edit:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                    </svg>
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(_id)}
                                                    className="p-2 bg-red-100 hover:bg-red-200 rounded-lg transition-all duration-200 group/delete"
                                                    title="Delete Customer"
                                                >
                                                    <svg className="w-5 h-5 text-red-600 group-hover/delete:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Paging */}
            {pages > 1 && (
                <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between text-sm text-gray-600">
                    <span>
                        {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} / {filtered.length}
                    </span>
                    <div className="flex gap-2">
                        <button
                            disabled={currentPage <= 1}
                            onClick={() => setPage(currentPage - 1)}
                            className="px-3 py-1.5 rounded-lg border border-gray-300 disabled:opacity-40"
                        >
                            ‹ Ager
                        </button>
                        <button
                            disabled={currentPage >= pages}
                            onClick={() => setPage(currentPage + 1)}
                            className="px-3 py-1.5 rounded-lg border border-gray-300 disabled:opacity-40"
                        >
                            Porer ›
                        </button>
                    </div>
                </div>
            )}

            {/* Update User Modal */}
            {selectedCustomerId && (
                <UpdateUserModal
                    isOpen={isModalOpen}
                    onClose={handleCloseModal}
                    customerId={selectedCustomerId}
                />
            )}
            
            <ToastContainer />
        </div>
    );
}

CustomerDetailTable.propTypes = {
    customers: PropTypes.arrayOf(
        PropTypes.shape({
            _id: PropTypes.string.isRequired,
            customerID: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
            name: PropTypes.string.isRequired,
            contact: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
            image: PropTypes.string,
            address: PropTypes.string,
        })
    ).isRequired,
    onRemoveCustomer: PropTypes.func.isRequired,
};

export default CustomerDetailTable;
