import React, {useContext} from "react";
import CustomerInfoForm from "../components/CustomerInfoForm";
import {CustomerDetailTable} from "../components/CustomerDetailTable";
import {UserContext} from "../context/UserContext.jsx";

const AddCustomer = () => {
    const {customers, setCustomers} = useContext(UserContext);

    const onAddCustomer = (newCustomer) => {
        setCustomers((prevCustomers) => [...prevCustomers, newCustomer]);
    };

    const removeCustomer = (id) => {
        setCustomers((prevCustomers) =>
            prevCustomers.filter((customer) => customer._id !== id)
        );
    };

    return (
        <div className="space-y-6">
            <CustomerInfoForm customers={customers} onAddCustomer={onAddCustomer}/>
            <CustomerDetailTable customers={customers} onRemoveCustomer={removeCustomer}/>
        </div>
    );
};

export default AddCustomer;

