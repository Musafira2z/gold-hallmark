const Order = require("../models/Order");
const { monthRange } = require("./customerStats");
const { dayRange } = require("./orderSummary");
const { nextVoucher, syncVoucherCounter } = require("./memoNumber");
const { normalizePhone } = require("../utils/phone");

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

const round2 = (n) => Math.round(n * 100) / 100;
const ITEM_TEXT_FIELDS = ["item", "weightUnite", "xray"];

// Check and clean items for an edit. Returns { items, total } or { error }.
// Amounts are worked out here; amounts sent by the browser are not trusted.
const prepareEditedItems = (rawItems) => {
    if (!Array.isArray(rawItems) || rawItems.length === 0) return { error: "Add at least one item." };
    if (rawItems.length > 200) return { error: "Too many items." };
    const items = [];
    for (let i = 0; i < rawItems.length; i += 1) {
        const raw = rawItems[i] || {};
        const [clean] = cleanItems([raw]);
        const out = {};
        ITEM_TEXT_FIELDS.forEach((f) => {
            out[f] = typeof raw[f] === "string" ? raw[f].trim().slice(0, 200) : "";
        });
        const label = `Item ${i + 1}${out.item ? ` (${out.item})` : ""}`;
        if (!out.item) return { error: `${label}: choose the item name.` };
        if (clean.quantity === null || clean.quantity <= 0) return { error: `${label}: enter Quantity.` };
        if (clean.rate === null || clean.rate < 0) return { error: `${label}: enter Rate.` };
        out.weightUnite = out.weightUnite || "gm";
        items.push({
            ...out,
            quantity: clean.quantity,
            rate: clean.rate,
            weight: clean.weight,
            amount: round2(clean.quantity * clean.rate),
        });
    }
    return { items, total: round2(items.reduce((sum, it) => sum + it.amount, 0)) };
};

// Edit an order's items and shop. Customer, memo number, date and type never change.
// The version before the edit is kept in `edits`.
// Returns the updated order, null if not found, or { error } for bad input.
exports.updateOrder = async (id, { items, company }) => {
    const order = await Order.findById(id);
    if (!order) return null;
    const prepared = prepareEditedItems(items);
    if (prepared.error) return { error: prepared.error };
    if (company !== undefined && typeof company !== "string") return { error: "Invalid shop." };

    order.edits.push({
        at: new Date(),
        company: order.company,
        totalAmount: order.totalAmount,
        items: order.items.map((it) => it.toObject()),
    });
    order.items = prepared.items;
    order.totalAmount = prepared.total;
    if (company !== undefined) order.company = company.trim();
    order.editedAt = new Date();
    return order.save();
};

const isDuplicateVoucher = (error) => error && error.code === 11000 && /voucher/.test(error.message || "");

exports.createOrder = async (orderData, items, file) => { // Add items parameter
    const imagePath = file ? `/uploads/${file.filename}` : null; // Or your cloud storage logic
    // The server gives the memo number; anything the browser sent is ignored (BUGS D2).
    // eslint-disable-next-line no-unused-vars
    const { voucher: _ignored, ...data } = orderData;
    for (let attempt = 1; ; attempt += 1) {
        try {
            const newOrder = new Order({
                ...data,
                contact: normalizePhone(data.contact), // 1725275114 -> 01725275114
                voucher: await nextVoucher(),
                items: cleanItems(items), // numbers only; bad values become null
                image: imagePath,
            });
            return await newOrder.save();
        } catch (error) {
            // Counter behind the saved numbers (e.g. after a restore): catch up and try again.
            if (isDuplicateVoucher(error) && attempt < 3) {
                await syncVoucherCounter();
                continue;
            }
            console.error("Error creating order:", error); // Important for debugging
            throw error; // Re-throw the error to be handled by the controller
        }
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
            // Phones are text with the leading 0 now; older records may still be numbers.
            // Mongoose turns a plain number into text before searching, so a number
            // match is done by comparing the stored value as text instead.
            if (phone.length >= 6) {
                or.push({ contact: { $in: [`0${phone}`, phone] } });
                or.push({ $expr: { $eq: [{ $toString: "$contact" }, phone] } });
            }
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
