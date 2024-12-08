import React, {useContext, useState, useEffect} from "react";
import PropTypes from "prop-types";
import ProfileImageUploader from "./ProfileImageUploader";
import {useParams} from "react-router-dom";
import axios from "axios";
import {Bounce, toast, ToastContainer} from "react-toastify";
import {UserContext} from "../context/UserContext.jsx";

function UpdateUser() {
    const {customers, setCustomers} = useContext(UserContext);
    const {id} = useParams();

    const singleCustomer = customers.find((item) => item._id === id);

    const [customer, setCustomer] = useState({
        customerID: "",
        name: "",
        contact: "",
        company: "",
        address: "",
    });

    // Pre-fill form when customer is found
    useEffect(() => {
        if (singleCustomer) {
            setCustomer(singleCustomer);
        }
    }, [singleCustomer]);

    const handleChange = (e) => {
        setCustomer({...customer, [e.target.name]: e.target.value});
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await axios.put(`${apiUrl}/updateUser/${id}`, customer);

            // Update the context state with new customer data
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
                transition: Bounce
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

                    {/* Company */}
                    <div className="flex flex-col sm:flex-row sm:items-center">
                        <input
                            type="text"
                            name="company"
                            className="flex-1 px-3 py-2 bg-[#E0F2F1] rounded-lg focus:ring focus:ring-blue-200 placeholder:text-[#004D40]"
                            placeholder="Company Name"
                            value={customer.company}
                            onChange={handleChange}
                        />
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
                <ProfileImageUploader/>
            </form>
            <ToastContainer/>
        </div>
    );
}

UpdateUser.propTypes = {
    onAddCustomer: PropTypes.func,
};

export default UpdateUser;
