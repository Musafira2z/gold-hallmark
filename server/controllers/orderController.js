const OrderService = require("../services/orderService");

exports.getOrders = async (req, res) => {
    try {
        const orders = await OrderService.getAllOrders();
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch orders", details: error });
    }
};

exports.createOrder = async (req, res) => {
    try {
        const items = JSON.parse(req.body.items); // Parse the items array
        const order = await OrderService.createOrder(req.body, items, req.file); // Pass items to the service

        res.status(201).json(order);
    } catch (error) {
        console.error("Controller Error:", error); // Log the error for debugging
        res.status(500).json({ error: "Failed to create order", details: error.message });
    }
};

exports.getOrderById = async (req, res) => {
    try {
        const order = await OrderService.getOrderById(req.params.id);
        if (order) {
            res.json(order);
        } else {
            res.status(404).json({ message: "Order not found" });
        }
    } catch (error) {
        res.status(500).json({ error: "Error fetching order", details: error });
    }
};
