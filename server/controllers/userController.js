const UserService = require("../services/userService");

exports.getUsers = async (req, res) => {
    try {
        const users = await UserService.getAllUsers();
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch users", details: error });
    }
};

exports.createUser = async (req, res) => {
    try {
        const user = await UserService.createUser(req.body, req.file);
        res.status(201).json(user);
    } catch (error) {
        res.status(500).json({ error: "Failed to create user", details: error });
    }
};

exports.updateUser = async (req, res) => {
    try {
        const updatedUser = await UserService.updateUser(req.params.id, req.body);
        res.json(updatedUser);
    } catch (error) {
        res.status(500).json({ error: "Failed to update user", details: error });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        await UserService.deleteUser(req.params.id);
        res.json({ message: "User deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete user", details: error });
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
