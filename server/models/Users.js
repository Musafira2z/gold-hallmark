const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    customerID: Number,
    name: String,
    contact: Number,
    company: [String],
    address: String,
    image: String

})

const UserModel = mongoose.model("users", UserSchema);

module.exports = UserModel;