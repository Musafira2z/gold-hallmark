const UserService = require("../services/userService");
const { audit } = require("../services/audit");

exports.getUsers = async (req, res) => {
    try {
        if (req.query.deleted !== undefined) {
            if (req.query.deleted !== "only" || req.staff.role !== "owner") {
                return res.status(403).json({ error: "Only the owner can see deleted customers." });
            }
            return res.json(await UserService.getDeletedUsers());
        }
        const users = await UserService.getAllUsers();
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch users", details: error });
    }
};

exports.createUser = async (req, res) => {
    try {
        const user = await UserService.createUser(req.body, req.file);
        await audit(req, "customer.create", user._id, `#${user.customerID} ${user.name}`);
        res.status(201).json(user);
    } catch (error) {
        res.status(500).json({ error: "Failed to create user", details: error });
    }
};

exports.updateUser = async (req, res) => {
    try {
        const updatedData = {
            ...req.body,
            image: req.file ? `/uploads/${req.file.filename}` : req.body.image
        };

        const updatedUser = await UserService.updateUser(req.params.id, updatedData);
        if (updatedUser) await audit(req, "customer.edit", updatedUser._id, `#${updatedUser.customerID} ${updatedUser.name}`);
        res.json(updatedUser);
    } catch (error) {
        res.status(500).json({ error: "Failed to update user", details: error });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        const user = await UserService.deleteUser(req.params.id, req.staff.name);
        if (!user) return res.status(404).json({ error: "Customer not found" });
        await audit(req, "customer.delete", user._id, `#${user.customerID} ${user.name}`);
        res.json({ message: "User deleted successfully" });
    } catch (error) {
        if (error.name === "CastError") return res.status(404).json({ error: "Customer not found" });
        res.status(500).json({ error: "Failed to delete user" });
    }
};

exports.restoreUser = async (req, res) => {
    try {
        const user = await UserService.restoreUser(req.params.id);
        if (!user) return res.status(404).json({ error: "No deleted customer with this id" });
        await audit(req, "customer.restore", user._id, `#${user.customerID} ${user.name}`);
        res.json(user);
    } catch (error) {
        if (error.name === "CastError") return res.status(404).json({ error: "Customer not found" });
        res.status(500).json({ error: "Failed to restore customer" });
    }
};

exports.getLastCustomerID = async (req, res) => {
    try {
        const lastCustomerID = await UserService.getLastCustomerID();
        res.json({ lastCustomerID });
    } catch (error) {
        res.status(500).json({ error: "Error fetching last customer ID", details: error });
    }
};

exports.getCustomerProfile = async (req, res) => {
    try {
        const profile = await UserService.getCustomerProfile(req.params.customerID);
        if (!profile) {
            return res.status(404).json({ error: "Customer not found" });
        }
        res.json(profile);
    } catch (error) {
        console.error("Error fetching customer profile:", error);
        res.status(500).json({ error: "Failed to fetch customer profile" });
    }
};

// Customer type (Plan 16): shop_owner | karigor | other, or "" to clear. Staff and owner.
const KIND_LABEL = { shop_owner: "Shop owner", karigor: "Karigor", other: "Other", "": "not set" };
exports.setCustomerKind = async (req, res) => {
    try {
        const kind = req.body ? req.body.kind : undefined;
        if (typeof kind !== "string" || !(kind in KIND_LABEL)) {
            return res.status(400).json({ error: "kind must be shop_owner, karigor, other or empty" });
        }
        const result = await UserService.setCustomerKind(req.params.customerID, kind);
        if (!result) return res.status(404).json({ error: "Customer not found" });
        await audit(req, "customer.kind", result.customer._id,
            `#${result.customer.customerID} ${result.customer.name || ""}: ${KIND_LABEL[result.before || ""]} → ${KIND_LABEL[kind]}`);
        res.json(result.customer);
    } catch (error) {
        console.error("Error setting customer type:", error);
        res.status(500).json({ error: "Could not save the customer type" });
    }
};
