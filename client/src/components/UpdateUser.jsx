import React, { useContext, useState, useEffect } from "react";
import PropTypes from "prop-types";
import ProfileImageUploader from "./ProfileImageUploader";
import { useParams } from "react-router-dom";
import axios from "axios";
import { Bounce, toast, ToastContainer } from "react-toastify";
import { apiUrl, UserContext } from "../context/UserContext.jsx";
import ProfileImageUpdate from "./ProfileImageUpdate.jsx";


function UpdateUser() {
    const { customers, setCustomers } = useContext(UserContext);
    const { id } = useParams();
    const singleCustomer = customers.find((item) => item._id === id);
    const [selectedImage, setSelectedImage] = useState(null);

    console.log("Selected Image:", selectedImage);

    const [customer, setCustomer] = useState({
        customerID: "",
        name: "",
        contact: "",
        company: [], // Changed to an array for multiple companies
        address: "",
        image: null,
    });

    // Pre-fill form when customer is found
    useEffect(() => {
        if (singleCustomer) {
            setCustomer({
                ...singleCustomer,
                company: Array.isArray(singleCustomer.company)
                    ? singleCustomer.company
                    : [singleCustomer.company],
            });
        }
    }, [singleCustomer]);
    const handleImageSelect = (imageFile) => {
        if (imageFile) {
            console.log("Image file received:", imageFile);
            setSelectedImage(imageFile);
        }
    };
    const handleChange = (e) => {
        setCustomer({ ...customer, [e.target.name]: e.target.value });
    };

    const handleAddTag = (e) => {
        if (e.key === "," && e.target.value.trim() !== "") {
            setCustomer({
                ...customer,
                company: [...customer.company, e.target.value.trim()],
            });
            e.target.value = ""; // Clear the input
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
        try {
            const formData = new FormData();
            formData.append("customerID", customer.customerID);
            formData.append("name", customer.name);
            formData.append("contact", customer.contact);
            customer.company.forEach((comp) => formData.append("company[]", comp));
            formData.append("address", customer.address);
            if (selectedImage) {
                formData.append("image", selectedImage);
            }
    
            const response = await axios.put(`${apiUrl}/users/update/${id}`, formData, {
                headers: {
                    "Content-Type": "multipart/form-data"
                }
            });
    
            setCustomers((prevCustomers) =>
                prevCustomers.map((cust) => (cust._id === id ? response.data : cust))
            );
    
            console.log("Customer updated successfully:", response.data);
            toast("User updated successfully", {
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
        } catch (error) {
            console.error("Error updating customer:", error);
        }
    };

    if (!singleCustomer) {
        return <div className="text-center py-10 text-[#004D40]">Customer not found</div>;
    }

    return (
        <div className="bg-white rounded-lg shadow-lg p-6 lg:p-10">
            <form
                onSubmit={handleSubmit}
                className="flex flex-col sm:flex-row items-center justify-between sm:gap-10 lg:gap-16"
            >
                {/* Left Section: Form Fields */}
                <div className="flex-1 w-2/3 lg:w-1/2 space-y-4">
                    <h2 className="text-3xl font-bold text-[#004D40] pb-4">
                        Update Customer Information
                    </h2>

                    {/* Customer ID */}
                    <div className="flex flex-col sm:flex-row sm:items-center">
                        <input
                            type="text"
                            name="customerID"
                            className="flex-1 px-3 py-2 bg-[#E0F2F1] rounded-lg focus:ring focus:ring-blue-200 placeholder:text-[#004D40]"
                            placeholder="Customer ID"
                            value={customer.customerID}
                            onChange={handleChange}
                        />
                    </div>

                    {/* Customer Name */}
                    <div className="flex flex-col sm:flex-row sm:items-center">
                        <input
                            type="text"
                            name="name"
                            className="flex-1 px-3 py-2 bg-[#E0F2F1] rounded-lg focus:ring focus:ring-blue-200 placeholder:text-[#004D40]"
                            placeholder="Customer Name"
                            value={customer.name}
                            onChange={handleChange}
                        />
                    </div>

                    {/* Contact */}
                    <div className="flex flex-col sm:flex-row sm:items-center">
                        <input
                            type="text"
                            name="contact"
                            className="flex-1 px-3 py-2 bg-[#E0F2F1] rounded-lg focus:ring focus:ring-blue-200 placeholder:text-[#004D40]"
                            placeholder="Contact No"
                            value={customer.contact}
                            onChange={handleChange}
                        />
                    </div>

                    {/* Custom Tag Input for Companies */}
                    <div className="flex flex-col space-y-2">
                        <label className="text-[#004D40]">Company Names</label>
                        <div className="flex flex-wrap gap-2 border rounded-lg p-2 bg-[#E0F2F1]">
                            {customer.company.map((tag, index) => (
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
                                placeholder="Add a company and press Enter"
                                className="flex-1 px-2 py-1 bg-transparent outline-none"
                                onKeyDown={handleAddTag}
                            />
                        </div>
                    </div>

                    {/* Address */}
                    <div className="flex flex-col sm:flex-row sm:items-start">
                        <textarea
                            name="address"
                            className="flex-1 px-3 py-2 bg-[#E0F2F1] rounded-lg focus:ring focus:ring-blue-200 placeholder:text-[#004D40]"
                            placeholder="Address"
                            value={customer.address}
                            onChange={handleChange}
                            rows="3"
                        ></textarea>
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        className="px-4 py-2 bg-[#004D40] text-white rounded-lg hover:bg-[#00332E]"
                    >
                        Update Customer
                    </button>
                </div>

                {/* Right Section: Profile Picture */}
                <ProfileImageUpdate onImageSelect={handleImageSelect}/>
            </form>
            <ToastContainer />
        </div>
    );
}

UpdateUser.propTypes = {
    onAddCustomer: PropTypes.func,
};

export default UpdateUser;
