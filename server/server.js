require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const connectDB = require("./config/db"); // Import database connection

const userRoutes = require("./routes/userRoutes");
const orderRoutes = require("./routes/orderRoutes");

const app = express();

app.use(cors());
app.use(express.json());

// Serve static files for images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Connect to MongoDB
connectDB().then(r => console.log("Connected to the database..."));

// Use routes
app.use("/users", userRoutes);
app.use("/orders", orderRoutes);


app.get("/", (req, res) => {
    res.json("Welcome to Gold Hallmark API");
});

const port = 5000;
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});