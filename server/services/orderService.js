const Order = require("../models/Order");

exports.getAllOrders = async () => {
    return await Order.find({});
};

exports.createOrder = async (orderData, items, file) => { // Add items parameter
    const imagePath = file ? `/uploads/${file.filename}` : null; // Or your cloud storage logic
    try {
        const newOrder = new Order({
            ...orderData,
            items: items, // Include the items array
            image: imagePath,
        });
        return await newOrder.save();
    } catch (error) {
        console.error("Error creating order:", error); // Important for debugging
        throw error; // Re-throw the error to be handled by the controller
    }
};

exports.getOrderById = async (id) => {
    return await Order.findById(id);
};
