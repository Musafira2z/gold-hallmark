import React, { useContext, useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import axios from "axios";
import { Bounce, toast } from "react-toastify";
import { apiUrl, UserContext } from "../context/UserContext.jsx";
import userImg from "../assets/imageDefault.png";

function UpdateUserModal({ isOpen, onClose, customerId }) {
    const { customers, setCustomers } = useContext(UserContext);
    const singleCustomer = customers.find((item) => item._id === customerId);
    const [selectedImage, setSelectedImage] = useState(null);
    const [previewImage, setPreviewImage] = useState(null);
    const [contactError, setContactError] = useState('');
    const fileInputRef = useRef(null);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [isCameraOpen, setIsCameraOpen] = useState(false);

    const [customer, setCustomer] = useState({
        customerID: "",
        name: "",
        contact: "",
        company: [],
        address: "",
        image: null,
    });

    // Pre-fill form when customer is found
    useEffect(() => {
        if (singleCustomer && isOpen) {
            setCustomer({
                ...singleCustomer,
                company: Array.isArray(singleCustomer.company)
                    ? singleCustomer.company
                    : singleCustomer.company ? [singleCustomer.company] : [],
            });
            setSelectedImage(null);
            setPreviewImage(null);
            setContactError('');
            
            // Set preview image from existing customer image
            if (singleCustomer.image) {
                const normalizedApiUrl = apiUrl?.endsWith("/") ? apiUrl.slice(0, -1) : apiUrl;
                const imagePath = typeof singleCustomer.image === "string" ? singleCustomer.image.trim() : "";
                const isAbsoluteUrl = /^https?:\/\//i.test(imagePath);
                const relativePath = imagePath.startsWith("/") ? imagePath : `/${imagePath}`;
                const imageSrc = imagePath
                    ? (isAbsoluteUrl ? imagePath : `${normalizedApiUrl}${relativePath}`)
                    : userImg;
                setPreviewImage(imageSrc);
            } else {
                setPreviewImage(userImg);
            }
        }
    }, [singleCustomer, isOpen, apiUrl]);

    const handleImageClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                setPreviewImage(e.target.result);
            };
            reader.readAsDataURL(file);
            setSelectedImage(file);
        }
    };

    const handleRemoveImage = () => {
        setPreviewImage(userImg);
        setSelectedImage(null);
    };

    const handleOpenCamera = async () => {
        setIsCameraOpen(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();
            }
        } catch (error) {
            console.error("Error accessing camera:", error);
            toast.error("Could not access camera");
        }
    };

    const handleCaptureImage = () => {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        if (!canvas || !video) return;

        const context = canvas.getContext("2d");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        const capturedImage = canvas.toDataURL("image/png");
        setPreviewImage(capturedImage);
        
        fetch(capturedImage)
            .then((res) => res.blob())
            .then((blob) => {
                const file = new File([blob], "captured-image.png", { type: "image/png" });
                setSelectedImage(file);
            });

        const stream = video.srcObject;
        const tracks = stream.getTracks();
        tracks.forEach((track) => track.stop());
        setIsCameraOpen(false);
    };

    const handleCloseCamera = () => {
        const stream = videoRef.current?.srcObject;
        if (stream) {
            const tracks = stream.getTracks();
            tracks.forEach((track) => track.stop());
        }
        setIsCameraOpen(false);
    };

    const handleChange = (e) => {
        setCustomer({ ...customer, [e.target.name]: e.target.value });
    };

    const handleContactChange = (e) => {
        const value = e.target.value;
        const digitsOnly = value.replace(/\D/g, '');
        
        if (digitsOnly.length <= 11) {
            setCustomer({ ...customer, contact: digitsOnly });
            
            if (digitsOnly.length > 0 && digitsOnly.length < 11) {
                setContactError('Phone number must be exactly 11 digits');
            } else if (digitsOnly.length === 11) {
                setContactError('');
            } else {
                setContactError('');
            }
        }
    };

    const handleAddTag = (e) => {
        if ((e.key === "," || e.key === "Enter") && e.target.value.trim() !== "") {
            e.preventDefault();
            setCustomer({
                ...customer,
                company: [...customer.company, e.target.value.trim()],
            });
            e.target.value = "";
        }
    };

    const handleRemoveTag = (index) => {
        setCustomer({
            ...customer,
            company: customer.company.filter((_, i) => i !== index),
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        const contactDigits = String(customer.contact).replace(/\D/g, '');
        if (contactDigits.length !== 11) {
            setContactError('Phone number must be exactly 11 digits');
            return;
        }
        
        try {
            const formData = new FormData();
            formData.append("customerID", customer.customerID);
            formData.append("name", customer.name);
            formData.append("contact", contactDigits);
            customer.company.forEach((comp) => formData.append("company[]", comp));
            formData.append("address", customer.address);
            if (selectedImage) {
                formData.append("image", selectedImage);
            }

            const response = await axios.put(`${apiUrl}/users/update/${customerId}`, formData, {
                headers: {
                    "Content-Type": "multipart/form-data"
                }
            });

            setCustomers((prevCustomers) =>
                prevCustomers.map((cust) => (cust._id === customerId ? response.data : cust))
            );

            toast.success("Customer updated successfully!", {
                position: "top-right",
                autoClose: 2000,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
                transition: Bounce,
            });

            onClose();
        } catch (error) {
            console.error("Error updating customer:", error);
            toast.error("Failed to update customer", {
                position: "top-right",
                autoClose: 2000,
                transition: Bounce,
            });
        }
    };

    if (!isOpen || !singleCustomer) return null;

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col animate-slideUp">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 px-8 py-6 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-white">Update Customer</h2>
                                <p className="text-blue-100 text-sm">Edit customer information</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-white hover:bg-white/20 rounded-xl p-2 transition-all duration-200"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Form Content - Scrollable */}
                    <div className="flex-1 overflow-y-auto p-8">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Profile Image Section - Top */}
                            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100">
                                <label className="block text-sm font-bold text-gray-700 mb-4 uppercase tracking-wide">
                                    Profile Photo
                                </label>
                                <div className="flex flex-col items-center gap-4">
                                    {/* Image Preview */}
                                    <div className="relative group">
                                        <div className="w-40 h-40 rounded-2xl overflow-hidden shadow-xl border-4 border-white ring-4 ring-blue-200">
                                            <img
                                                src={previewImage || userImg}
                                                alt="Profile"
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all rounded-2xl flex items-center justify-center cursor-pointer" onClick={handleImageClick}>
                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-full p-3 shadow-lg">
                                                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Image Upload Buttons */}
                                    <div className="flex gap-3 w-full max-w-md">
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            accept="image/*"
                                            className="hidden"
                                            onChange={handleFileChange}
                                        />
                                        <button
                                            type="button"
                                            onClick={handleImageClick}
                                            className="flex-1 px-5 py-3 bg-white hover:bg-blue-50 border-2 border-blue-300 text-blue-700 rounded-xl font-semibold transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                            </svg>
                                            Upload
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleOpenCamera}
                                            className="flex-1 px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                            Camera
                                        </button>
                                        {previewImage && previewImage !== userImg && (
                                            <button
                                                type="button"
                                                onClick={handleRemoveImage}
                                                className="px-5 py-3 bg-red-50 hover:bg-red-100 border-2 border-red-200 text-red-600 rounded-xl font-semibold transition-all duration-200 shadow-md hover:shadow-lg"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Form Fields Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Customer ID */}
                                <div className="space-y-2">
                                    <label className="block text-sm font-bold text-gray-700 uppercase tracking-wide">
                                        Customer ID
                                    </label>
                                    <input
                                        type="text"
                                        name="customerID"
                                        className="w-full px-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium"
                                        placeholder="Enter Customer ID"
                                        value={customer.customerID}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>

                                {/* Customer Name */}
                                <div className="space-y-2">
                                    <label className="block text-sm font-bold text-gray-700 uppercase tracking-wide">
                                        Customer Name
                                    </label>
                                    <input
                                        type="text"
                                        name="name"
                                        className="w-full px-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium"
                                        placeholder="Enter Customer Name"
                                        value={customer.name}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>

                                {/* Contact */}
                                <div className="space-y-2 md:col-span-2">
                                    <label className="block text-sm font-bold text-gray-700 uppercase tracking-wide">
                                        Contact Number
                                    </label>
                                    <input
                                        type="text"
                                        name="contact"
                                        className={`w-full px-4 py-3.5 bg-gray-50 border-2 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium ${
                                            contactError ? 'border-red-500' : 'border-gray-200'
                                        }`}
                                        placeholder="Enter 11-digit phone number"
                                        value={customer.contact}
                                        onChange={handleContactChange}
                                        maxLength={11}
                                        required
                                    />
                                    {contactError && (
                                        <p className="text-red-500 text-sm font-medium">{contactError}</p>
                                    )}
                                    {customer.contact && customer.contact.length > 0 && customer.contact.length < 11 && (
                                        <p className="text-red-500 text-sm font-medium">
                                            {11 - customer.contact.length} more digit(s) required
                                        </p>
                                    )}
                                </div>

                                {/* Company Names */}
                                <div className="space-y-2 md:col-span-2">
                                    <label className="block text-sm font-bold text-gray-700 uppercase tracking-wide">
                                        Company Names
                                    </label>
                                    <div className="flex flex-wrap gap-2 border-2 border-gray-200 rounded-xl p-4 bg-gray-50 min-h-[80px] focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200 transition-all">
                                        {customer.company.map((tag, index) => (
                                            <span
                                                key={index}
                                                className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold shadow-md"
                                            >
                                                {tag}
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveTag(index)}
                                                    className="hover:bg-white/20 rounded-full p-0.5 transition-colors"
                                                >
                                                    ×
                                                </button>
                                            </span>
                                        ))}
                                        <input
                                            type="text"
                                            placeholder="Add company (press Enter or comma)"
                                            className="flex-1 px-2 py-1 bg-transparent outline-none text-sm font-medium min-w-[150px]"
                                            onKeyDown={handleAddTag}
                                        />
                                    </div>
                                </div>

                                {/* Address */}
                                <div className="space-y-2 md:col-span-2">
                                    <label className="block text-sm font-bold text-gray-700 uppercase tracking-wide">
                                        Address
                                    </label>
                                    <textarea
                                        name="address"
                                        className="w-full px-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none font-medium"
                                        placeholder="Enter full address"
                                        value={customer.address}
                                        onChange={handleChange}
                                        rows="4"
                                    ></textarea>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center justify-end gap-4 pt-6 border-t-2 border-gray-200">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-8 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition-all duration-200 shadow-md hover:shadow-lg"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-8 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold shadow-xl hover:shadow-2xl transition-all duration-200 transform hover:-translate-y-0.5 flex items-center gap-2"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    Update Customer
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            {/* Camera Modal */}
            {isCameraOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
                    <div className="relative bg-white rounded-3xl shadow-2xl p-8 max-w-lg w-full">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-2xl font-bold text-gray-800">Capture Photo</h3>
                            <button
                                onClick={handleCloseCamera}
                                className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-lg"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <video ref={videoRef} className="w-full h-80 bg-black rounded-2xl mb-6" />
                        <canvas ref={canvasRef} className="hidden" />

                        <div className="flex gap-3">
                            <button
                                onClick={handleCaptureImage}
                                className="flex-1 px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                Capture
                            </button>
                            <button
                                onClick={handleCloseCamera}
                                className="flex-1 px-6 py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition-all duration-200 shadow-md hover:shadow-lg"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .animate-fadeIn {
                    animation: fadeIn 0.3s ease-out;
                }
                .animate-slideUp {
                    animation: slideUp 0.3s ease-out;
                }
            `}</style>
        </>
    );
}

UpdateUserModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    customerId: PropTypes.string.isRequired,
};

export default UpdateUserModal;
