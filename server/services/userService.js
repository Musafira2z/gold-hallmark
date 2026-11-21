const User = require("../models/User");
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
        ...userData,
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
    
    return User.findByIdAndUpdate(id, updatedData, { new: true });
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
    const [stats, balance] = await Promise.all([getCustomerStats(id), customerBalance(id)]);
    return { customer, stats, balance };
};
