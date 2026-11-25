// The app's own MongoDB (Plan 21): started with the app, shut down cleanly when it closes.
const { spawn } = require("child_process");
const fs = require("fs");
const net = require("net");
const path = require("path");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Is something answering on this port?
const portOpen = (port, host = "127.0.0.1") =>
    new Promise((resolve) => {
        const socket = net.connect({ port, host });
        socket.setTimeout(1000);
        socket.once("connect", () => { socket.destroy(); resolve(true); });
        socket.once("timeout", () => { socket.destroy(); resolve(false); });
        socket.once("error", () => resolve(false));
    });

// The MongoDB driver that comes with the server (no second copy needed).
const loadDriver = (serverDir) => require(path.join(serverDir, "node_modules", "mongodb"));

// Ask MongoDB if it is working (and is really MongoDB).
const ping = async (driver, port) => {
    const client = new driver.MongoClient(`mongodb://127.0.0.1:${port}/?directConnection=true`, {
        serverSelectionTimeoutMS: 1500,
    });
    try {
        await client.connect();
        const res = await client.db("admin").command({ ping: 1 });
        return res.ok === 1;
    } catch {
        return false;
    } finally {
        await client.close().catch(() => {});
    }
};

/**
 * Start mongod, or use the one already running on our port (left from a crash).
 * Returns { stop() }.
 */
async function startMongo({ mongod, dbPath, logPath, port, serverDir, log }) {
    const driver = loadDriver(serverDir);
    let child = null;

    if (await portOpen(port)) {
        if (await ping(driver, port)) {
            // Left running after a crash or power trouble. It is ours (our port, only this PC),
            // so use it, and shut it down cleanly when the app closes.
            log(`MongoDB is already running on port ${port}; using it.`);
        } else {
            throw new Error(`Port ${port} is used by another program, so the database can't start.`);
        }
    } else {
        if (!fs.existsSync(mongod)) throw new Error(`The database program is missing: ${mongod}`);
        child = spawn(mongod, [
            "--dbpath", dbPath,
            "--port", String(port),
            "--bind_ip", "127.0.0.1",
            "--logpath", logPath,
            "--logappend",
        ], { windowsHide: true, stdio: "ignore" });
        let exited = null;
        child.once("exit", (code) => { exited = code; });
        child.once("error", (error) => { exited = error.message; });
        // Recovering after a power cut can take a while; wait up to 2 minutes.
        for (let i = 0; i < 240; i += 1) {
            if (exited !== null) throw new Error(`The database stopped while starting (${exited}). See ${logPath}`);
            if (await ping(driver, port)) break;
            if (i === 239) throw new Error(`The database did not start in 2 minutes. See ${logPath}`);
            await sleep(500);
        }
        log(`MongoDB started on port ${port}.`);
    }

    return {
        // Clean shutdown, so no data is half-written. Never just kill it.
        async stop() {
            // Started by us: wait for the process to end. Found running: wait for the port to close.
            const done = child
                ? new Promise((resolve) => {
                    if (child.exitCode !== null) resolve();
                    else child.once("exit", resolve);
                })
                : (async () => { while (await portOpen(port)) await sleep(500); })();
            const client = new driver.MongoClient(`mongodb://127.0.0.1:${port}/?directConnection=true`, {
                serverSelectionTimeoutMS: 3000,
            });
            try {
                await client.connect();
                await client.db("admin").command({ shutdown: 1 });
            } catch {
                // the shutdown command always drops the connection; that is fine
            } finally {
                await client.close().catch(() => {});
            }
            const timeout = sleep(30000).then(() => "timeout");
            if ((await Promise.race([done, timeout])) === "timeout") {
                log("MongoDB did not stop in 30 s; stopping it hard.");
                if (!child) return;
                child.kill();
                await done;
            }
            log("MongoDB stopped cleanly.");
        },
    };
}

module.exports = { startMongo, portOpen, sleep, loadDriver };
