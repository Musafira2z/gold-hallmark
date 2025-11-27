const itemService = require("../services/itemService");

exports.getItemNames = async (req, res) => {
    try {
        const { type } = req.params;
        const items = await itemService.getItemNamesByType(type);
        res.json(items);
    } catch (error) {
        const status = error.statusCode || 500;
        res.status(status).json({ message: error.message || "Failed to load item names" });
    }
};

exports.createItemName = async (req, res) => {
    try {
        const { name, type } = req.body;
        const item = await itemService.createItemName({ name, type });
        res.status(201).json(item);
    } catch (error) {
        const status = error.statusCode || (error.code === 11000 ? 409 : 500);
        const message = error.code === 11000 ? "Item already exists" : (error.message || "Failed to create item");
        res.status(status).json({ message });
    }
};

