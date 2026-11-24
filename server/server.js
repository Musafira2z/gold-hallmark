require("dotenv").config();
const express = require("express");
const cors = require("cors");

const connectDB = require("./config/db"); // Import database connection
const { ensureDefaultItems } = require("./services/itemService");
const { syncVoucherCounter } = require("./services/memoNumber");
const { ensureReportLinks } = require("./services/reportLink");
const { startSync, syncStatus } = require("./services/sync");

const userRoutes = require("./routes/userRoutes");
const orderRoutes = require("./routes/orderRoutes");
const itemRoutes = require("./routes/itemRoutes");
const authRoutes = require("./routes/authRoutes");
const staffRoutes = require("./routes/staffRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const { requireAuth, requireOwner } = require("./middleware/auth");
const { uploadsDir } = require("./middleware/upload");

const app = express();

app.use(cors());
app.use(express.json());

// Photos: only for logged-in staff (BUGS S5). The app fetches them with the token.
app.use("/uploads", requireAuth, express.static(uploadsDir, {
    setHeaders: (res) => res.set("X-Content-Type-Options", "nosniff"),
}));

// Connect to MongoDB
connectDB()
    .then(async () => {
        console.log("Connected to the database...");
        await ensureDefaultItems();
        console.log("Default item names are synced.");
        await syncVoucherCounter();
        console.log("Memo number counter is ready.");
        const linked = await ensureReportLinks();
        console.log(`Report links ready${linked ? ` (${linked} older orders got one)` : ""}.`);
        startSync();
    })
    .catch((error) => {
        console.error("Failed to connect to the database", error);
        process.exit(1);
    });

// Login (open). Everything after this needs a login (BUGS S1/S2).
app.use("/auth", authRoutes);
app.use("/users", requireAuth, paymentRoutes, userRoutes);
app.use("/orders", requireAuth, orderRoutes);
app.use("/items", requireAuth, itemRoutes);
app.use("/admin", requireAuth, requireOwner, staffRoutes); // owner only
app.get("/sync/status", requireAuth, async (_req, res) => {
    try {
        res.json(await syncStatus());
    } catch (error) {
        res.status(500).json({ error: "Could not read sync status" });
    }
});

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