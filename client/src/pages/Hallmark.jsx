import React from "react";
import OrderServicePage from "./OrderServicePage.jsx";

const Hallmark = () => (
    <OrderServicePage
        serviceType="hallmark"
        heading="Hallmark Service"
        description="Create and manage hallmark orders"
        noteLabel="Hallmark"
        retainItemNameOnAdd
    />
);

export default Hallmark;
