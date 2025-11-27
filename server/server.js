require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const connectDB = require("./config/db"); // Import database connection
const { ensureDefaultItems } = require("./services/itemService");

const userRoutes = require("./routes/userRoutes");
const orderRoutes = require("./routes/orderRoutes");
const itemRoutes = require("./routes/itemRoutes");

const app = express();

app.use(cors());
app.use(express.json());

// Serve static files for images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Connect to MongoDB
connectDB()
    .then(async () => {
        console.log("Connected to the database...");
        await ensureDefaultItems();
        console.log("Default item names are synced.");
    })
    .catch((error) => {
        console.error("Failed to connect to the database", error);
        process.exit(1);
    });

// Use routes
app.use("/users", userRoutes);
app.use("/orders", orderRoutes);
app.use("/items", itemRoutes);

app.get("/", (req, res) => {
    res.json("Welcome to Gold Hallmark API");
});

const DEFAULT_PORT = 5000;
const MAX_PORT_PROBES = 10;

const parsePort = (value) => {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
};

const preferredPort = parsePort(process.env.PORT) || DEFAULT_PORT;
const allowPortHunt = !process.env.PORT;

const startServer = (portToTry, attemptsLeft = MAX_PORT_PROBES) => {
    const serverInstance = app.listen(portToTry, () => {
        console.log(`Server running on port ${portToTry}`);
    });

    serverInstance.on("error", (error) => {
        if (error.code === "EADDRINUSE") {
            if (allowPortHunt && attemptsLeft > 0) {
                console.warn(`Port ${portToTry} is busy. Trying port ${portToTry + 1}...`);
                startServer(portToTry + 1, attemptsLeft - 1);
                return;
            }
            console.error(`Port ${portToTry} is already in use. Set PORT to a free port or stop the conflicting process.`);
            process.exit(1);
        }
        throw error;
    });
};

startServer(preferredPort);