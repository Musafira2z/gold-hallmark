import React from "react";
import OrderServicePage from "./OrderServicePage.jsx";

const Xray = () => (
    <OrderServicePage
        serviceType="xray"
        heading="New X-ray order"
        description="Pick the customer, add items, then Submit & Print."
        noteLabel="Xray"
    />
);

export default Xray;
