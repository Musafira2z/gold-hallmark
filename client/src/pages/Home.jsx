import React, { useContext } from "react";
import CustomerInfoForm from "../Components/CustomerInfoForm";
import { CustomerDetailTable } from "../Components/CustomerDetailTable";
import { UserContext } from "../context/userContext";

const Home = () => {
    const { customers, setCustomers } = useContext(UserContext);

    const onAddCustomer = (newCustomer) => {
        setCustomers((prevCustomers) => [...prevCustomers, newCustomer]);
    };

    const removeCustomer = (id) => {
        setCustomers((prevCustomers) =>
            prevCustomers.filter((customer) => customer._id !== id)
        );
    };

    return (
        <div className="py-10 bg-[#E0F2F1] overflow-x-scroll p-6">
            <div className="flex flex-col gap-10 p-2 lg:p-10 bg-white rounded-lg">
                <CustomerInfoForm customers={customers} onAddCustomer={onAddCustomer} />
                <CustomerDetailTable customers={customers} onRemoveCustomer={removeCustomer} />
            </div>
        </div>
    );
};

export default Home;
