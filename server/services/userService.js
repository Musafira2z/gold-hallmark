const User = require("../models/User");

exports.getAllUsers = async () => {
    return await User.find({});
};

exports.createUser = async (userData, file) => {
    const imagePath = file ? `/uploads/${file.filename}` : null;
    const newUser = new User({
        ...userData,
        image: imagePath
    });
    return await newUser.save();
};

exports.updateUser = async (id, updatedData) => {
    return User.findByIdAndUpdate(id, updatedData, {new: true});
};

exports.deleteUser = async (id) => {
    return User.findByIdAndDelete(id);
};

exports.getLastCustomerID = async () => {
    const lastCustomer = await User.findOne().sort({customerID: -1}).limit(1);
    return lastCustomer ? lastCustomer.customerID : 0;
};
