require("dotenv").config();
const mongoose = require("mongoose");
const { createApp } = require("./app");

// Settings (.env): MONGO_URI, SYNC_KEY, PORT (default 8080), TRUST_PROXY=1 behind Hostinger.
const main = async () => {
    if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not set");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Online DB connected.");
    const app = createApp({ syncKey: process.env.SYNC_KEY, trustProxy: process.env.TRUST_PROXY === "1" });
    const port = Number(process.env.PORT) || 8080;
    app.listen(port, () => console.log(`Online app on port ${port}`));
};

main().catch((error) => {
    console.error("Online app could not start:", error.message);
    process.exit(1);
});
