// models/Xray.js
const mongoose = require("mongoose");

const ordersSchema = new mongoose.Schema(
    {
        name: String,
        customerID: String,
        company: String,
        contact: Number,
        address: String,
        item: String,
        quantity: Number,
        type: String,
        weight: Number,
        weightUnite: String, // Add weight unit here
        rate: Number,
        amount: Number,
        xray: String,
        customerFrom: Date,
        image: String, // Field to store the image path
    },
    { timestamps: true }
);

const OrdersModel = mongoose.model("Orders", ordersSchema);
module.exports = OrdersModel;
