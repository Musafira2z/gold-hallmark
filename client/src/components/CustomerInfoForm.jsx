import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import axios from "axios";
import ProfileImageUploader from "./ProfileImageUploader";
import {apiUrl} from "../context/UserContext.jsx"; // Assuming ProfileImageUploader is another component for image upload

function CustomerInfoForm({ onAddCustomer }) {
    // State for form fields
    const [customerID, setCustomerId] = useState(1); // Start from 1
    const [name, setName] = useState('');
    const [contact, setContact] = useState('');
    const [company, setCompany] = useState([]);
    const [address, setAddress] = useState('');
    const [selectedImage, setSelectedImage] = useState(null); // State for the selected image

    // Fetch the last customerID when component mounts
    useEffect(() => {
        const fetchLastCustomerID = async () => {
            try {
                const response = await axios.get(`${apiUrl}/getLastCustomerID`);
                const lastCustomerID = response.data.lastCustomerID;
                setCustomerId(lastCustomerID + 1); // Set the next customer ID
            } catch (error) {
                console.error("Error fetching last customer ID:", error);
            }
        };

        fetchLastCustomerID();
    }, []);

    // Callback to receive image from ProfileImageUploader
    const handleImageSelect = (imageFile) => {
        setSelectedImage(imageFile);
    };

    const handleSubmit = async (e) => {
        e.preventDefault(); // Prevent default form submission
        try {
            // Create FormData for the full user (with image)
            const formData = new FormData();
            formData.append("customerID", customerID);
            formData.append("name", name);
            formData.append("contact", contact);
            formData.append("company", company);
            formData.append("address", address);
            if (selectedImage) {
                formData.append("image", selectedImage); // Append the image if selected
            }

            // First POST request: Add full user details
            const userResponse = await axios.post(`${apiUrl}/createUser`, formData);
            console.log("Full User Created: ", userResponse.data);

            // Second POST request: Add customer data (customerID, name, company) in JSON format
            // const customerData = {
            //     customerID,
            //     name,
            //     company
            // };

            // const customerResponse = await axios.post("${apiUrl}/createCustomer", customerData, {
            //     headers: {
            //         "Content-Type": "application/json" // Set content type to JSON
            //     }
            // });

            // console.log("Customer Data Added: ", customerResponse.data);

            // Callback to notify parent component (if needed)
            if (onAddCustomer) {
                // Add the customer from the response to the context state (parent state)
                onAddCustomer(userResponse.data);
            }

            // Reset the form fields after successful submission
            setCustomerId((prevID) => prevID + 1); // Auto-increment customerID
            setName('');
            setContact('');
            setCompany('');
            setAddress('');
            setSelectedImage(null); // Reset the image
        } catch (error) {
            console.error("Error adding customer:", error.response ? error.response.data : error.message);
        }
    };

    return (
        <form
            onSubmit={handleSubmit}
            className="flex flex-col xl:flex-row items-center justify-between gap-6 sm:gap-10 xl:gap-16 bg-white p-6 rounded-lg"
        >
            {/* Left Section: Form Fields */}
            <div className="flex-1 w-full sm:w-2/3 xl:w-1/2 space-y-6">
                <h2 className="text-3xl font-bold text-[#004D40] pb-4">Customer Information</h2>

                {/* Customer ID (Read-only) */}
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

                {/* Customer Name */}
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

                {/* Contact No */}
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

                {/* Company Name */}
                <div className="flex flex-col sm:flex-row sm:items-center">
                    <input
                        type="text"
                        name="company"
                        placeholder="Company Name"
                        className="flex-1 px-3 py-2 bg-[#E0F2F1] rounded-lg focus:ring focus:ring-blue-200 placeholder:text-[#004D40]"
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                    />
                </div>

                {/* Address */}
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

                {/* Submit Button */}
                <button
                    type="submit"
                    className="px-6 py-3 bg-[#004D40] text-white rounded-lg hover:bg-[#00332E] w-full sm:w-auto"
                >
                    Add Customer
                </button>
            </div>

            {/* Right Section: Profile Picture */}
            <div className=" w-full sm:w-1/3 flex justify-center items-center">
                <ProfileImageUploader onImageSelect={handleImageSelect} />
            </div>
        </form>
    );
}

// Prop type validation
CustomerInfoForm.propTypes = {
    onAddCustomer: PropTypes.func, // Optional callback when customer is added
};

export default CustomerInfoForm;
