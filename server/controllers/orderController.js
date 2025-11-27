const OrderService = require("../services/orderService");

exports.getOrders = async (req, res) => {
    const { date } = req.query;  // Date passed in the query parameter (optional)

    try {
        // If date is provided, filter by date
        if (date) {
            if (isNaN(new Date(date).getTime())) {
                return res.status(400).json({ error: "Invalid date parameter" });
            }

            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);  // Set to start of the day

            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);  // Set to the end of the day

            const orders = await OrderService.getOrdersByDate(startOfDay, endOfDay);
            return res.json(orders);
        } else {
            // If no date provided, return all orders
            const orders = await OrderService.getAllOrders();
            return res.json(orders);
        }
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

exports.deleteOrder = async (req, res) => {
    try {
        const deletedOrder = await OrderService.deleteOrder(req.params.id);
        if (deletedOrder) {
            res.json({ message: "Order deleted successfully", order: deletedOrder });
        } else {
            res.status(404).json({ message: "Order not found" });
        }
    } catch (error) {
        console.error("Error deleting order:", error);
        res.status(500).json({ error: "Failed to delete order", details: error.message });
    }
};