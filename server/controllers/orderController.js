const OrderService = require("../services/orderService");

exports.getOrders = async (req, res) => {
    const { date } = req.query;  // Date passed in the query parameter
    console.log("Received date:", date);  // Log received date for debugging

    if (!date || isNaN(new Date(date).getTime())) {
        return res.status(400).json({ error: "Invalid or missing date parameter" });
    }

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);  // Set to start of the day

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);  // Set to the end of the day

    console.log("Start of Day:", startOfDay);  // Log for debugging
    console.log("End of Day:", endOfDay);  // Log for debugging

    try {
        const orders = await OrderService.getOrdersByDate(startOfDay, endOfDay);
        console.log("Fetched Orders:", orders);  // Log orders to confirm the result
        res.json(orders);  // Send orders to the frontend
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ error: "Failed to fetch orders" });
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