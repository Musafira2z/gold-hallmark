import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import axios from "axios";
import ProfileImageUploader from "./ProfileImageUploader";
import { apiUrl } from "../context/UserContext.jsx";

function CustomerInfoForm({ onAddCustomer }) {
    const [customerID, setCustomerId] = useState(1);
    const [name, setName] = useState('');
    const [contact, setContact] = useState('');
    const [company, setCompany] = useState([]); // Updated for multiple companies
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
            e.target.value = ""; // Clear the input
        }
    };

    const handleRemoveTag = (index) => {
        setCompany(company.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const formData = new FormData();
            formData.append("customerID", customerID);
            formData.append("name", name);
            formData.append("contact", contact);

            // Append each company as a separate entry
            company.forEach((comp, index) => formData.append(`company[]`, comp));

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
            setAddress('');
            setSelectedImage(null);
        } catch (error) {
            console.error("Error adding customer:", error.response ? error.response.data : error.message);
        }
    };
    return (
        <form
            onSubmit={handleSubmit}
            className="flex flex-col xl:flex-row items-center justify-between gap-6 sm:gap-10 xl:gap-16 bg-white p-6 rounded-lg"
        >
            <div className="flex-1 w-full sm:w-2/3 xl:w-1/2 space-y-6">
                <h2 className="text-3xl font-bold text-[#004D40] pb-4">Customer Information</h2>

                <div className="flex flex-col sm:flex-row sm:items-center">
                    <input
                        type="text"
                        name="customerId"
                        className="flex-1 px-3 py-2 bg-gray-200 rounded-lg placeholder:text-gray-500"
                        placeholder="Customer ID"
                        value={customerID}
                        readOnly
                    />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center">
                    <input
                        type="text"
                        name="name"
                        placeholder="Customer Name"
                        className="flex-1 px-3 py-2 bg-[#E0F2F1] rounded-lg focus:ring focus:ring-blue-200 placeholder:text-[#004D40]"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center">
                    <input
                        type="text"
                        name="contact"
                        placeholder="Contact No"
                        className="flex-1 px-3 py-2 bg-[#E0F2F1] rounded-lg focus:ring focus:ring-blue-200 placeholder:text-[#004D40]"
                        value={contact}
                        onChange={(e) => setContact(e.target.value)}
                    />
                </div>

                {/* Custom Tag Input for Company Names */}
                <div className="flex flex-col space-y-2">
                    <label className="text-[#004D40]">Company Names</label>
                    <div className="flex flex-wrap gap-2 border rounded-lg p-2 bg-[#E0F2F1]">
                        {company.map((tag, index) => (
                            <span
                                key={index}
                                className="bg-[#004D40] text-white px-3 py-1 rounded-full flex items-center gap-2"
                            >
                                {tag}
                                <button
                                    type="button"
                                    onClick={() => handleRemoveTag(index)}
                                    className="text-sm bg-red-500 hover:bg-red-600 rounded-full px-2"
                                >
                                    ×
                                </button>
                            </span>
                        ))}
                        <input
                            type="text"
                            placeholder="Add a company and press Comma ( , )"
                            className="flex-1 px-2 py-1 bg-transparent outline-none"
                            onKeyDown={handleAddTag}
                        />
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-start">
                    <textarea
                        name="address"
                        placeholder="Address"
                        className="flex-1 px-3 py-2 bg-[#E0F2F1] rounded-lg focus:ring focus:ring-blue-200 placeholder:text-[#004D40]"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        rows="3"
                    ></textarea>
                </div>

                <button
                    type="submit"
                    className="px-6 py-3 bg-[#004D40] text-white rounded-lg hover:bg-[#00332E] w-full sm:w-auto"
                >
                    Add Customer
                </button>
            </div>

            <div className="w-full sm:w-1/3 flex justify-center items-center">
                <ProfileImageUploader onImageSelect={handleImageSelect} />
            </div>
        </form>
    );
}

CustomerInfoForm.propTypes = {
    onAddCustomer: PropTypes.func,
};

export default CustomerInfoForm;
