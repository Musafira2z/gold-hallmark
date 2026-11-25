const User = require("../models/User");
const Shop = require("../models/Shop");
const { makePin, hashPin, checkPin, loginPhone } = require("./portalPin");

// Fields the customer forms may not set: they have their own audited actions.
const LOCKED = ["_id", "__v", "createdAt", "updatedAt", "deletedAt", "deletedBy", "kind",
    "portalPinHash", "portalPinSetAt", "portalOffAt", "portalShops"];
const withoutLocked = (data) => {
    const out = { ...data };
    LOCKED.forEach((f) => delete out[f]);
    return out;
};
const { customerBalance } = require("./balance");
const { getCustomerStats } = require("./customerStats");

exports.getAllUsers = async () => {
    return await User.find({ deletedAt: null });
};

exports.createUser = async (userData, file) => {
    // Validate contact number (must be exactly 11 digits)
    if (userData.contact) {
        const contactDigits = String(userData.contact).replace(/\D/g, '');
        if (contactDigits.length !== 11) {
            const error = new Error("Contact number must be exactly 11 digits");
            error.statusCode = 400;
            throw error;
        }
        // Ensure contact is stored as string to preserve leading zeros
        userData.contact = contactDigits;
    }
    
    const imagePath = file ? `/uploads/${file.filename}` : null;
    const newUser = new User({
        ...withoutLocked(userData),
        image: imagePath
    });
    return await newUser.save();
};

exports.updateUser = async (id, updatedData) => {
    // Validate contact number if provided (must be exactly 11 digits)
    if (updatedData.contact) {
        const contactDigits = String(updatedData.contact).replace(/\D/g, '');
        if (contactDigits.length !== 11) {
            const error = new Error("Contact number must be exactly 11 digits");
            error.statusCode = 400;
            throw error;
        }
        // Ensure contact is stored as string to preserve leading zeros
        updatedData.contact = contactDigits;
    }
    
    return User.findByIdAndUpdate(id, withoutLocked(updatedData), { new: true });
};

// "Delete" keeps the customer (BUGS U7). Their ID is never given to anyone else,
// because getLastCustomerID still counts deleted customers.
exports.deleteUser = async (id, byName) =>
    User.findOneAndUpdate({ _id: id, deletedAt: null }, { $set: { deletedAt: new Date(), deletedBy: byName } }, { new: true });

exports.getDeletedUsers = async () => User.find({ deletedAt: { $ne: null } }).sort({ deletedAt: -1 });

exports.restoreUser = async (id) =>
    User.findOneAndUpdate({ _id: id, deletedAt: { $ne: null } }, { $unset: { deletedAt: 1, deletedBy: 1 } }, { new: true });

exports.getLastCustomerID = async () => {
    const lastCustomer = await User.findOne().sort({ customerID: -1 }).limit(1);
    return lastCustomer ? lastCustomer.customerID : 0;
};

// Customer + their numbers for the profile page. null if no such customer.
exports.getCustomerProfile = async (customerID) => {
    const id = Number(customerID);
    if (!Number.isSafeInteger(id)) return null;
    const customer = await User.findOne({ customerID: id }).lean();
    if (!customer) return null;
    const [stats, balance, portal] = await Promise.all([getCustomerStats(id), customerBalance(id), portalInfo(customer)]);
    return { customer, stats, balance, portal };
};

// Customer type (Plan 16). Returns { customer, before } or null if there is no such customer.
exports.setCustomerKind = async (customerID, kind) => {
    const id = Number(customerID);
    if (!Number.isSafeInteger(id)) return null;
    const before = await User.findOne({ customerID: id, deletedAt: null }, { kind: 1 }).lean();
    if (!before) return null;
    const update = kind ? { $set: { kind } } : { $unset: { kind: 1 } };
    const customer = await User.findOneAndUpdate({ _id: before._id }, update, { new: true }).lean();
    return { customer, before: before.kind };
};

// ---- Online login (Plan 18) ----

const loginUrl = () => {
    const base = (process.env.REPORT_BASE_URL || "").trim().replace(/\/+$/, "");
    return base ? `${base}/login` : "";
};

// What the customer page shows about the online login. Never the PIN or its hash.
const portalInfo = async (customer) => {
    const on = Boolean(customer.portalPinSetAt && !customer.portalOffAt);
    const ids = customer.portalShops || [];
    const shops = ids.length ? await Shop.find({ _id: { $in: ids } }, { name: 1 }).lean() : [];
    return {
        on,
        setAt: customer.portalPinSetAt || null,
        offAt: customer.portalOffAt || null,
        phone: loginPhone(customer.contact),
        shops: shops.map((s) => ({ id: String(s._id), name: s.name })),
        loginUrl: loginUrl(),
    };
};

const findLive = async (customerID, extra = {}) => {
    const id = Number(customerID);
    if (!Number.isSafeInteger(id)) return null;
    return User.findOne({ customerID: id, deletedAt: null }, extra).lean();
};

// A new 6-digit PIN. The old one (if any) stops working; the website logs out its phones.
// Returns { pin, phone, loginUrl, customer, hadLogin } | { error } | null.
exports.makePortalPin = async (customerID) => {
    const customer = await findLive(customerID);
    if (!customer) return null;
    const phone = loginPhone(customer.contact);
    if (!phone) return { error: "Add this customer's mobile number (01…) first. The online login uses it." };
    // Customers sharing a phone must not share a PIN, or the login could not tell them apart.
    const others = await User.find({ _id: { $ne: customer._id }, deletedAt: null, portalOffAt: null, portalPinSetAt: { $exists: true } }, { contact: 1 })
        .select("+portalPinHash").lean();
    const samePhone = others.filter((o) => loginPhone(o.contact) === phone && o.portalPinHash);
    let pin = makePin();
    for (let i = 0; i < 20 && samePhone.some((o) => checkPin(pin, o.portalPinHash)); i += 1) pin = makePin();
    const set = { portalPinHash: hashPin(pin), portalPinSetAt: new Date() };
    // A shop owner's own shops are ticked the first time, from their orders.
    if (customer.kind === "shop_owner" && !(customer.portalShops || []).length) {
        const Order = require("../models/Order");
        set.portalShops = (await Order.distinct("shopId", { customerID: String(customer.customerID), deletedAt: null, shopId: { $ne: null } })).slice(0, 20);
    }
    await User.updateOne({ _id: customer._id }, { $set: set, $unset: { portalOffAt: 1 } });
    return { pin, phone, loginUrl: loginUrl(), customer, hadLogin: Boolean(customer.portalPinSetAt && !customer.portalOffAt) };
};

// Turn the online login off. Returns the customer, { error } or null.
exports.portalOff = async (customerID) => {
    const customer = await findLive(customerID);
    if (!customer) return null;
    if (!customer.portalPinSetAt || customer.portalOffAt) return { error: "This customer has no online login." };
    await User.updateOne({ _id: customer._id }, { $set: { portalOffAt: new Date() }, $unset: { portalPinHash: 1 } });
    return customer;
};

// A shop owner's shops (what they see online besides their own orders).
exports.setPortalShops = async (customerID, shopIds) => {
    if (!Array.isArray(shopIds) || shopIds.length > 20 || !shopIds.every((s) => /^[a-f0-9]{24}$/i.test(String(s)))) {
        return { error: "Choose up to 20 shops." };
    }
    const customer = await findLive(customerID);
    if (!customer) return null;
    const found = await Shop.find({ _id: { $in: shopIds } }, { name: 1 }).lean();
    if (found.length !== new Set(shopIds.map(String)).size) return { error: "One of these shops was not found." };
    await User.updateOne({ _id: customer._id }, { $set: { portalShops: found.map((s) => s._id) } });
    return { customer, shops: found.map((s) => ({ id: String(s._id), name: s.name })) };
};
