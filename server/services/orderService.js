const Order = require("../models/Order");

exports.getAllOrders = async () => {
    return await Order.find({});
};

exports.createOrder = async (orderData, file) => {
    const imagePath = file ? `/uploads/${file.filename}` : null;
    const newOrder = new Order({
        ...orderData,
        image: imagePath
    });
    return await newOrder.save()
};

exports.getOrderById = async (id) => {
    return await Order.findById(id);
};
