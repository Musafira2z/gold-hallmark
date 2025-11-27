const User = require("../models/User");

exports.getAllUsers = async () => {
    return await User.find({});
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

exports.deleteUser = async (id) => {
    return User.findByIdAndDelete(id);
};

exports.getLastCustomerID = async () => {
    const lastCustomer = await User.findOne().sort({ customerID: -1 }).limit(1);
    return lastCustomer ? lastCustomer.customerID : 0;
};
