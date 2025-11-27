import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import axios from "axios";
import ProfileImageUploader from "./ProfileImageUploader";
import { apiUrl } from "../context/UserContext.jsx";

function CustomerInfoForm({ onAddCustomer }) {
    const [customerID, setCustomerId] = useState(1);
    const [name, setName] = useState('');
    const [contact, setContact] = useState('');
    const [contactError, setContactError] = useState('');
    const [company, setCompany] = useState([]); // Updated for multiple companies
    const [companyInput, setCompanyInput] = useState(''); // Track company input field value
    const [address, setAddress] = useState('');
    const [selectedImage, setSelectedImage] = useState(null);

    useEffect(() => {
        const fetchLastCustomerID = async () => {
            try {
                const response = await axios.get(`${apiUrl}/users/lastCustomerID`);
                setCustomerId(response.data.lastCustomerID + 1);
            } catch (error) {
                console.error("Error fetching last customer ID:", error);
            }
        };

        fetchLastCustomerID();
    }, []);

    const handleImageSelect = (imageFile) => {
        setSelectedImage(imageFile);
    };

    const handleAddTag = (e) => {
        if (e.key === "," && e.target.value.trim() !== "") {
            setCompany([...company, e.target.value.trim()]);
            setCompanyInput(""); // Clear the input
            e.target.value = ""; // Clear the input
        }
    };

    const handleCompanyInputChange = (e) => {
        setCompanyInput(e.target.value);
    };

    const handleRemoveTag = (index) => {
        setCompany(company.filter((_, i) => i !== index));
    };

    const handleContactChange = (e) => {
        const value = e.target.value;
        // Only allow digits
        const digitsOnly = value.replace(/\D/g, '');
        
        // Limit to 11 digits
        if (digitsOnly.length <= 11) {
            setContact(digitsOnly);
            
            // Validation
            if (digitsOnly.length > 0 && digitsOnly.length < 11) {
                setContactError('Phone number must be exactly 11 digits');
            } else if (digitsOnly.length === 11) {
                setContactError('');
            } else {
                setContactError('');
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Add company from input field if it has text (even without comma)
        let finalCompanyList = [...company];
        if (companyInput.trim() !== "") {
            finalCompanyList.push(companyInput.trim());
        }
        
        // Validate all required fields
        if (!name.trim()) {
            alert('Please enter customer name');
            return;
        }
        
        // Validate contact before submission
        const contactDigits = contact.replace(/\D/g, '');
        if (contactDigits.length !== 11) {
            setContactError('Phone number must be exactly 11 digits');
            return;
        }
        
        if (finalCompanyList.length === 0) {
            alert('Please add at least one company');
            return;
        }
        
        if (!address.trim()) {
            alert('Please enter address');
            return;
        }
        
        try {
            const formData = new FormData();
            formData.append("customerID", customerID);
            formData.append("name", name);
            formData.append("contact", contactDigits); // Send as string to preserve leading zeros

            // Append each company as a separate entry
            finalCompanyList.forEach((comp, index) => formData.append(`company[]`, comp));

            formData.append("address", address);
            if (selectedImage) {
                formData.append("image", selectedImage);
            }

            const userResponse = await axios.post(`${apiUrl}/users/create`, formData);
            console.log("Full User Created: ", userResponse.data);

            if (onAddCustomer) onAddCustomer(userResponse.data);

            // Reset the form
            setCustomerId((prevID) => prevID + 1);
            setName('');
            setContact('');
            setCompany([]);
            setCompanyInput('');
            setAddress('');
            setSelectedImage(null);
        } catch (error) {
            console.error("Error adding customer:", error.response ? error.response.data : error.message);
        }
    };
    // Handle Enter key press - submit form if all fields are filled
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
            e.preventDefault();
            
            // Check if all required fields are filled (including company input)
            const contactDigits = contact.replace(/\D/g, '');
            const hasCompany = company.length > 0 || companyInput.trim() !== '';
            const allFieldsFilled = 
                name.trim() !== '' && 
                contactDigits.length === 11 && 
                hasCompany && 
                address.trim() !== '';
            
            if (allFieldsFilled) {
                // Create a synthetic event for form submission
                const syntheticEvent = {
                    preventDefault: () => {},
                    target: e.target.form || e.target.closest('form')
                };
                handleSubmit(syntheticEvent);
            } else {
                // Show alert if fields are not filled
                if (!name.trim()) {
                    alert('Please enter customer name');
                } else if (contactDigits.length !== 11) {
                    alert('Please enter a valid 11-digit phone number');
                } else if (company.length === 0) {
                    alert('Please add at least one company');
                } else if (!address.trim()) {
                    alert('Please enter address');
                }
            }
        }
    };

    return (
        <div className="w-full">
            <form
                onSubmit={handleSubmit}
                onKeyDown={handleKeyDown}
                className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden"
            >
                {/* Header Section */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5">
                    <h2 className="text-2xl font-bold text-white mb-1">
                        Add New Customer
                    </h2>
                    <p className="text-blue-100 text-sm">Fill in the customer details below to add them to the system</p>
                </div>

                {/* User Info Form Section - Full Width */}
                <div className="px-6 py-6 space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        {/* Customer ID */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Customer ID
                                <span className="ml-2 text-xs text-gray-500 font-normal">(Auto)</span>
                            </label>
                            <input
                                type="text"
                                name="customerId"
                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-gray-50"
                                placeholder="Customer ID"
                                value={customerID}
                                readOnly
                            />
                        </div>

                        {/* Customer Name */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Customer Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                name="name"
                                placeholder="Enter full customer name"
                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                            />
                        </div>

                        {/* Contact Number */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Contact Number <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                name="contact"
                                placeholder="Enter 11-digit phone number"
                                className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 transition-all ${
                                    contactError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                                }`}
                                value={contact}
                                onChange={handleContactChange}
                                maxLength={11}
                                required
                            />
                            {contactError && (
                                <p className="text-red-500 text-xs mt-1 font-medium">{contactError}</p>
                            )}
                            {contact && contact.length > 0 && contact.length < 11 && (
                                <p className="text-amber-600 text-xs mt-1 font-medium">
                                    {11 - contact.length} more digit(s) required
                                </p>
                            )}
                            {contact && contact.length === 11 && (
                                <p className="text-green-600 text-xs mt-1 font-medium flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                    Valid phone number
                                </p>
                            )}
                        </div>

                        {/* Company Names - Takes 2 columns */}
                        <div className="md:col-span-2">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Company Names <span className="text-red-500">*</span>
                                <span className="ml-2 text-xs text-gray-500 font-normal">(Press comma to add multiple)</span>
                            </label>
                            <div className="flex flex-wrap gap-2 border border-gray-300 rounded-lg p-3 bg-white hover:border-blue-400 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500 transition-colors min-h-[46px]">
                                {company.map((tag, index) => (
                                    <span
                                        key={index}
                                        className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-3 py-1 rounded-full flex items-center gap-2 text-sm font-medium shadow-sm"
                                    >
                                        {tag}
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveTag(index)}
                                            className="text-sm bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full px-1.5 transition-colors"
                                        >
                                            ×
                                        </button>
                                    </span>
                                ))}
                                <input
                                    type="text"
                                    placeholder="Type company name..."
                                    className="flex-1 px-2 py-1 bg-transparent outline-none text-gray-700 placeholder:text-gray-400 min-w-[150px]"
                                    value={companyInput}
                                    onChange={handleCompanyInputChange}
                                    onKeyDown={handleAddTag}
                                />
                            </div>
                        </div>

                        {/* Profile Image - Single column */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Profile Image <span className="text-gray-400 text-xs font-normal">(Optional)</span>
                            </label>
                            <div className="flex items-center gap-3 border border-gray-300 rounded-lg p-2 bg-white hover:border-blue-400 transition-colors">
                                <ProfileImageUploader onImageSelect={handleImageSelect} compact={true} />
                            </div>
                        </div>

                        {/* Address - Full Width */}
                        <div className="md:col-span-3">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Address <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                name="address"
                                placeholder="Enter complete customer address"
                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none"
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                rows="2"
                                required
                            ></textarea>
                        </div>
                    </div>

                    {/* Submit Button */}
                    <div className="pt-2">
                        <button
                            type="submit"
                            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-lg font-semibold text-base shadow-md hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg transition-all duration-200"
                        >
                            <span className="flex items-center justify-center gap-2">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Add Customer
                            </span>
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}

CustomerInfoForm.propTypes = {
    onAddCustomer: PropTypes.func,
};

export default CustomerInfoForm;
