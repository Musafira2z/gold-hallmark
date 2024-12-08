require("dotenv").config(); // Load environment variables from .env file

const mongoose = require("mongoose");

const connectDB = async () => {
    try {
        const mongoURI = process.env.MONGO_URI; // Fetch Mongo URI from environment variables
        if (!mongoURI) {
            throw new Error("MONGO_URI is not defined in the .env file");
        }
        await mongoose.connect(mongoURI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log("MongoDB connected successfully");
    } catch (error) {
        console.error("Error connecting to MongoDB:", error);
        process.exit(1); // Exit the process if the connection fails
    }
};

module.exports = connectDB;