// Tiny DevTools client: node cdp.js list | node cdp.js eval <js>   (Node 22 has WebSocket built in)
const port = 9333;
const pages = async () => (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).filter((p) => p.type === "page");
setTimeout(() => { console.log("CDP timeout"); process.exit(1); }, 10000);
(async () => {
  const [cmd, ...rest] = process.argv.slice(2);
  const list = await pages();
  if (cmd === "closeall") { // like a person closing every window
    for (const p of list) {
      const ws = new WebSocket(p.webSocketDebuggerUrl);
      await new Promise((r) => ws.addEventListener("open", r));
      ws.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression: "window.close()" } }));
      await new Promise((r) => setTimeout(r, 300)); ws.close();
    }
    console.log(list.length); process.exit(0);
  }
  if (cmd === "list") { console.log(JSON.stringify(list.map((p) => ({ url: p.url.split("?")[0], title: p.title })))); process.exit(0); }
  const target = list.find((p) => p.url.startsWith("http://127.0.0.1:47110/")) || list[0];
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r));
  ws.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression: rest.join(" "), awaitPromise: true, returnByValue: true } }));
  ws.addEventListener("message", (m) => { const d = JSON.parse(m.data); if (d.id === 1) { console.log(JSON.stringify(d.result.result.value ?? d.result)); ws.close(); process.exit(0); } });
})().catch((e) => { console.log("CDP error: " + e.message); process.exit(1); });
