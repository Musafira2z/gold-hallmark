const OrderService = require("../services/orderService");
const { audit } = require("../services/audit");
const { reportUrlFor } = require("../services/reportLink");

const { monthRange } = require("../services/customerStats");
const { dayRange, getSummary } = require("../services/orderSummary");

const FILTER_KEYS = ["customerID", "month", "day", "company", "type", "q", "deleted", "status", "shop", "page", "limit"];

// Today / this month / last 7 days, counted on the server.
exports.getOrderSummary = async (_req, res) => {
    try {
        res.json(await getSummary());
    } catch (error) {
        console.error("Error building order summary:", error);
        res.status(500).json({ error: "Failed to build summary" });
    }
};

exports.getOrders = async (req, res) => {
    const { date } = req.query;  // Date passed in the query parameter (optional)

    try {
        // New: any of these filters returns a paged result { orders, total, page, pages, limit }.
        // Without them the old behaviour below is unchanged.
        if (FILTER_KEYS.some((key) => req.query[key] !== undefined)) {
            const { customerID, month, day, company, shop, type, q, deleted, status } = req.query;
            if (shop !== undefined && !/^[a-f0-9]{24}$/i.test(String(shop))) {
                return res.status(400).json({ error: "Invalid shop" });
            }
            if (status !== undefined && !["open", ...OrderService.STATUSES].includes(status)) {
                return res.status(400).json({ error: "status must be open, received, ready or delivered" });
            }
            if (deleted !== undefined && (deleted !== "only" || req.staff.role !== "owner")) {
                return res.status(403).json({ error: "Only the owner can see deleted orders." });
            }
            // Only plain strings, so ?company[$ne]=x can't turn into a Mongo operator.
            if ([customerID, month, day, company, type, q].some((v) => v !== undefined && typeof v !== "string")) {
                return res.status(400).json({ error: "Invalid filter" });
            }
            if (month !== undefined && !monthRange(month)) {
                return res.status(400).json({ error: "month must look like 2026-11" });
            }
            if (day !== undefined && !dayRange(day)) {
                return res.status(400).json({ error: "day must look like 2026-11-19" });
            }
            if (q !== undefined && q.length > 100) {
                return res.status(400).json({ error: "Search text too long" });
            }
            const page = Number(req.query.page ?? 1);
            const limit = Number(req.query.limit ?? 50);
            if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 200) {
                return res.status(400).json({ error: "page must be 1 or more, limit 1 to 200" });
            }
            const result = await OrderService.queryOrders({ customerID, month, day, company, shop, type, q, deleted, status, page, limit });
            return res.json(result);
        }

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
        let items;
        try {
            items = typeof req.body.items === "string" ? JSON.parse(req.body.items) : req.body.items;
        } catch {
            return res.status(400).json({ error: "Add at least one item." });
        }
        const order = await OrderService.createOrder(req.body, items, req.file); // Pass items to the service
        await audit(req, "order.create", order._id, `Memo ${order.voucher}: #${order.customerID} ${order.name || ""}, ${order.totalAmount} taka`);

        res.status(201).json(order);
    } catch (error) {
        if (error.status === 400) return res.status(400).json({ error: error.message });
        console.error("Controller Error:", error); // Log the error for debugging
        res.status(500).json({ error: "Failed to create order", details: error.message });
    }
};

exports.getOrderById = async (req, res) => {
    try {
        const order = await OrderService.getOrderById(req.params.id);
        if (order) {
            res.json({ ...order.toObject(), reportUrl: reportUrlFor(order) });
        } else {
            res.status(404).json({ message: "Order not found" });
        }
    } catch (error) {
        res.status(500).json({ error: "Error fetching order", details: error });
    }
};

exports.updateOrder = async (req, res) => {
    try {
        const { items, company } = req.body || {};
        const result = await OrderService.updateOrder(req.params.id, { items, company });
        if (!result) return res.status(404).json({ message: "Order not found" });
        if (result.error) return res.status(400).json({ error: result.error });
        const before = result.edits && result.edits.length ? result.edits[result.edits.length - 1].totalAmount : undefined;
        await audit(req, "order.edit", result._id, `Memo ${result.voucher}: ${before} → ${result.totalAmount} taka`);
        res.json(result);
    } catch (error) {
        if (error.name === "CastError") return res.status(404).json({ message: "Order not found" });
        console.error("Error updating order:", error);
        res.status(500).json({ error: "Failed to update order" });
    }
};

const STATUS_LABEL = { received: "Received", ready: "Ready", delivered: "Delivered" };
exports.setOrderStatus = async (req, res) => {
    try {
        const status = req.body && req.body.status;
        const result = await OrderService.setStatus(req.params.id, status, req.staff.name);
        if (!result) return res.status(404).json({ error: "Order not found" });
        if (result.error) return res.status(400).json({ error: result.error });
        const { order, before } = result;
        await audit(req, "order.status", order._id, `Memo ${order.voucher}: ${STATUS_LABEL[before]} → ${STATUS_LABEL[status]}`);
        res.json(order);
    } catch (error) {
        if (error.name === "CastError") return res.status(404).json({ error: "Order not found" });
        console.error("Error setting status:", error);
        res.status(500).json({ error: "Could not change the status" });
    }
};

exports.restoreOrder = async (req, res) => {
    try {
        const order = await OrderService.restoreOrder(req.params.id);
        if (!order) return res.status(404).json({ message: "No deleted order with this id" });
        await audit(req, "order.restore", order._id, `Memo ${order.voucher}: #${order.customerID} ${order.name || ""}`);
        res.json(order);
    } catch (error) {
        if (error.name === "CastError") return res.status(404).json({ message: "Order not found" });
        console.error("Error restoring order:", error);
        res.status(500).json({ error: "Failed to restore order" });
    }
};

exports.deleteOrder = async (req, res) => {
    try {
        const deletedOrder = await OrderService.deleteOrder(req.params.id, req.staff.name);
        if (deletedOrder) {
            await audit(req, "order.delete", deletedOrder._id, `Memo ${deletedOrder.voucher}: #${deletedOrder.customerID} ${deletedOrder.name || ""}, ${deletedOrder.totalAmount} taka`);
            res.json({ message: "Order deleted successfully", order: deletedOrder });
        } else {
            res.status(404).json({ message: "Order not found" });
        }
    } catch (error) {
        console.error("Error deleting order:", error);
        res.status(500).json({ error: "Failed to delete order", details: error.message });
    }
};