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

// ---- Online login (Plan 18). Staff and owner. The PIN is shown once and never logged. ----
const noStore = (res) => res.set("Cache-Control", "no-store");

exports.makePortalPin = async (req, res) => {
    try {
        const result = await UserService.makePortalPin(req.params.customerID);
        if (!result) return res.status(404).json({ error: "Customer not found" });
        if (result.error) return res.status(400).json({ error: result.error });
        await audit(req, "customer.portal", result.customer._id,
            `#${result.customer.customerID} ${result.customer.name || ""}: ${result.hadLogin ? "new online PIN (old one stopped)" : "online login turned on"}`);
        noStore(res).json({ pin: result.pin, phone: result.phone, loginUrl: result.loginUrl });
    } catch (error) {
        console.error("Error making a portal PIN:", error);
        res.status(500).json({ error: "Could not make the PIN" });
    }
};

exports.portalOff = async (req, res) => {
    try {
        const result = await UserService.portalOff(req.params.customerID);
        if (!result) return res.status(404).json({ error: "Customer not found" });
        if (result.error) return res.status(400).json({ error: result.error });
        await audit(req, "customer.portal", result._id, `#${result.customerID} ${result.name || ""}: online login turned off`);
        res.json({ ok: true });
    } catch (error) {
        console.error("Error turning a portal login off:", error);
        res.status(500).json({ error: "Could not turn the login off" });
    }
};

exports.setPortalShops = async (req, res) => {
    try {
        const result = await UserService.setPortalShops(req.params.customerID, req.body ? req.body.shops : undefined);
        if (!result) return res.status(404).json({ error: "Customer not found" });
        if (result.error) return res.status(400).json({ error: result.error });
        await audit(req, "customer.portal", result.customer._id,
            `#${result.customer.customerID} ${result.customer.name || ""}: online shops ${result.shops.map((s) => s.name).join(", ") || "none"}`);
        res.json({ shops: result.shops });
    } catch (error) {
        console.error("Error saving portal shops:", error);
        res.status(500).json({ error: "Could not save the shops" });
    }
};
