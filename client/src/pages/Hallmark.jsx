import React from "react";
import OrderServicePage from "./OrderServicePage.jsx";

const Hallmark = () => (
    <OrderServicePage
        serviceType="hallmark"
        heading="New Hallmark order"
        description="Pick the customer, add items, then Submit & Print."
        noteLabel="Hallmark"
        retainItemNameOnAdd
    />
);

export default Hallmark;
