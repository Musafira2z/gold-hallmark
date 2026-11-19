const Order = require("../models/Order");
const { monthRange } = require("./customerStats");
const { dayRange } = require("./orderSummary");

exports.getAllOrders = async () => {
    return await Order.find({});
};

// Number fields of an item: anything that is not a number (e.g. "" or the
// word "Weight") is stored as null instead of failing the whole order (BUGS F7).
const ITEM_NUMBER_FIELDS = ["quantity", "rate", "weight", "amount"];
const cleanItems = (items) =>
    (Array.isArray(items) ? items : []).map((item) => {
        const clean = { ...item };
        ITEM_NUMBER_FIELDS.forEach((field) => {
            const value = clean[field];
            if (value === null || value === undefined || String(value).trim() === "") {
                clean[field] = null;
            } else {
                const n = Number(value);
                clean[field] = Number.isFinite(n) ? n : null;
            }
        });
        return clean;
    });
exports.cleanItems = cleanItems;

exports.createOrder = async (orderData, items, file) => { // Add items parameter
    const imagePath = file ? `/uploads/${file.filename}` : null; // Or your cloud storage logic
    try {
        const newOrder = new Order({
            ...orderData,
            items: cleanItems(items), // numbers only; bad values become null
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
exports.getOrdersByDate = async (startDate, endDate) => {
    try {
        const orders = await Order.find({
            createdAt: { $gte: startDate, $lte: endDate }
        });
        
        // Return the orders or an empty array if no orders are found
        return orders || [];
    } catch (error) {
        console.error("Error fetching orders by date:", error);
        throw new Error('Error fetching orders by date');
    }
};

exports.deleteOrder = async (id) => {
    try {
        const deletedOrder = await Order.findByIdAndDelete(id);
        return deletedOrder;
    } catch (error) {
        console.error("Error deleting order:", error);
        throw new Error('Error deleting order');
    }
};

// Filtered, paged order list (newest first). Used by the customer profile
// and the Orders page. Any filter can be left out.
// Returns { orders, total, amount, page, pages, limit }.
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

exports.queryOrders = async ({ customerID, month, day, company, type, q, page = 1, limit = 50 }) => {
    const query = {};
    if (customerID !== undefined) query.customerID = String(customerID);
    if (company !== undefined) query.company = company;
    if (type !== undefined) query.type = type;
    if (month !== undefined) {
        const range = monthRange(month);
        query.createdAt = { $gte: range.start, $lt: range.end };
    }
    if (day !== undefined) {
        const range = dayRange(day);
        query.createdAt = { $gte: range.start, $lt: range.end };
    }
    const text = (q || "").trim();
    if (text) {
        if (/^\d+$/.test(text)) {
            // Memo number, customer ID, or phone (stored without the leading 0).
            const or = [{ voucher: Number(text) }, { customerID: text }];
            const phone = text.replace(/^0+/, "");
            if (phone.length >= 6) or.push({ contact: Number(phone) });
            query.$or = or;
        } else {
            const pattern = new RegExp(escapeRegex(text), "i");
            query.$or = [{ name: pattern }, { company: pattern }];
        }
    }
    const [orders, total, sums] = await Promise.all([
        Order.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        Order.countDocuments(query),
        Order.aggregate([{ $match: query }, { $group: { _id: null, amount: { $sum: { $ifNull: ["$totalAmount", 0] } } } }]),
    ]);
    const amount = sums[0] ? sums[0].amount : 0;
    return { orders, total, amount, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
};
