const ItemName = require("../models/ItemName");
const defaultItemNames = require("../config/defaultItemNames");

const allowedTypes = ["hallmark", "xray"];

const isValidType = (type) => allowedTypes.includes(type);

const normalizeInput = (value = "") => value.replace(/\s+/g, " ").trim();

exports.ensureDefaultItems = async () => {
    const operations = [];

    Object.entries(defaultItemNames).forEach(([type, items]) => {
        items.forEach((name) => {
            const trimmed = normalizeInput(name);
            const normalized = trimmed.toLowerCase();
            operations.push(
                ItemName.updateOne(
                    { type, normalized },
                    { $setOnInsert: { name: trimmed, type, normalized } },
                    { upsert: true }
                )
            );
        });
    });

    if (operations.length > 0) {
        await Promise.all(operations);
    }
};

exports.getItemNamesByType = async (type) => {
    if (!isValidType(type)) {
        const error = new Error("Invalid item type");
        error.statusCode = 400;
        throw error;
    }

    return ItemName.find({ type }).sort({ name: 1 }).lean();
};

exports.createItemName = async ({ type, name }) => {
    if (!isValidType(type)) {
        const error = new Error("Invalid item type");
        error.statusCode = 400;
        throw error;
    }

    const trimmedName = normalizeInput(name);
    if (!trimmedName) {
        const error = new Error("Item name is required");
        error.statusCode = 400;
        throw error;
    }

    const normalized = trimmedName.toLowerCase();
    const existingItem = await ItemName.findOne({ type, normalized });
    if (existingItem) {
        const error = new Error("Item already exists");
        error.statusCode = 409;
        throw error;
    }

    const item = new ItemName({ name: trimmedName, type, normalized });
    return item.save();
};

