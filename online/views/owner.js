// Owner's phone app pages (Plan 19). Server-built; charts are inline SVG, so it works without JavaScript.
// The only script is /owner/app.js, which installs the offline page (service worker).
const { esc, day, time, PURITY, TYPE_LABEL } = require("./pages");

const THEME = "#a8811c";
const taka = (n) => `৳${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
const num = (n) => Math.round(Number(n) || 0).toLocaleString("en-IN"); // counts: pieces can be typed as 0.5
const monthName = (key, style = "long") => {
    const [y, m] = key.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("en-GB", { month: style, year: "numeric", timeZone: "UTC" });
};
const weekday = (d) => new Date(d).toLocaleDateString("en-GB", { weekday: "long", timeZone: "Asia/Dhaka" });

const manifest = {
    name: "Sylhet Gold Hallmark: Owner",
    short_name: "Hallmark",
    description: "Today's sales, dues and the shop PC, on your phone.",
    start_url: "/owner",
    scope: "/owner/",
    display: "standalone",
    background_color: "#f4f1ea",
    theme_color: THEME,
    icons: [
        { src: "/owner/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
        { src: "/owner/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        { src: "/owner/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
};

const STYLE = `
:root{--bg:#f4f1ea;--card:#fff;--ink:#1d2a26;--muted:#5d6b66;--line:#e3ddd0;--gold:#a8811c;--goldsoft:#efe3c2;--ok:#1f7a4d;--okbg:#e6f4ec;--bad:#b3261e;--badbg:#fbe9e7;--warn:#8a5a00;--warnbg:#fff4dc}
@media (prefers-color-scheme:dark){:root{--bg:#141a18;--card:#1d2522;--ink:#eef2ef;--muted:#a3b0ab;--line:#2f3a36;--gold:#d8b45a;--goldsoft:#3a321c;--ok:#7fd3a6;--okbg:#173327;--bad:#ff8a80;--badbg:#3a1d1b;--warn:#f3c26b;--warnbg:#3a2e14}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans Bengali",sans-serif;-webkit-text-size-adjust:100%}
main{max-width:640px;margin:0 auto;padding:12px 16px 32px}
a{color:var(--gold)}
.bar{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 0 10px}
.bar .t{font-weight:800;font-size:18px}
.bar .s{color:var(--muted);font-size:13px}
.bar form button{font:inherit;font-size:14px;background:none;border:1px solid var(--line);color:var(--muted);border-radius:10px;padding:6px 10px}
.health{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.pill{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600;padding:6px 10px;border-radius:999px;background:var(--card);border:1px solid var(--line)}
.dot{width:9px;height:9px;border-radius:50%;flex:none}
.green .dot{background:var(--ok)} .amber .dot{background:var(--warn)} .red .dot{background:var(--bad)}
.red{background:var(--badbg);color:var(--bad);border-color:transparent}
.amber{background:var(--warnbg);color:var(--warn);border-color:transparent}
h2{font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin:18px 0 8px;font-weight:700}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.tile{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px 14px;min-width:0}
.tile .k{font-size:13px;color:var(--muted)}
.tile .v{font-size:26px;font-weight:800;line-height:1.2;font-variant-numeric:tabular-nums}
.tile .c{font-size:12px;color:var(--muted);margin-top:2px}
.up{color:var(--ok)} .down{color:var(--bad)}
.tile.hero{grid-column:1/-1;background:var(--gold);border-color:var(--gold);color:#fff}
.tile.hero .k,.tile.hero .c{color:#fff;opacity:.9}
.tile.hero .v{font-size:34px}
.tile.hero .up,.tile.hero .down{color:#fff;font-weight:700}
@media (prefers-color-scheme:dark){.tile.hero,.tile.hero .k,.tile.hero .c,.tile.hero .up,.tile.hero .down{color:#1d1708}}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px 14px}
.chart svg{display:block;width:100%;height:auto}
.chart .axis{fill:var(--muted);font-size:10px}
.chart .bar-r{fill:var(--gold)}
.chart .bar-t{fill:var(--ink)}
.chart .grid-l{stroke:var(--line);stroke-width:1}
ol.rank{list-style:none;margin:0;padding:0}
ol.rank li{display:grid;grid-template-columns:1fr auto;gap:2px 10px;padding:9px 0;border-top:1px solid var(--line)}
ol.rank li:first-child{border-top:0}
ol.rank .n{font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
ol.rank .m{text-align:right;font-weight:700;font-variant-numeric:tabular-nums}
ol.rank .d{grid-column:1/-1;height:5px;border-radius:3px;background:var(--goldsoft);overflow:hidden}
ol.rank .d span{display:block;height:100%;background:var(--gold)}
ol.rank .x{color:var(--muted);font-size:13px}
.split{display:flex;height:12px;border-radius:6px;overflow:hidden;background:var(--goldsoft);margin:8px 0}
.split span{display:block;height:100%}
.legend{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:13px;color:var(--muted)}
.legend b{color:var(--ink)}
.sw{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:5px;vertical-align:-1px}
.monthnav{display:flex;justify-content:space-between;align-items:center;font-size:14px;margin:18px 0 8px}
.monthnav strong{font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:var(--muted)}
.latest a{display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-top:1px solid var(--line);color:inherit;text-decoration:none}
.latest a:first-child{border-top:0}
.latest .x{color:var(--muted);font-size:13px}
.foot{color:var(--muted);font-size:12px;text-align:center;margin-top:20px}
form.login label{display:block;font-size:14px;color:var(--muted);margin:10px 0 4px}
form.login input{width:100%;font:inherit;font-size:22px;letter-spacing:.12em;text-transform:uppercase;padding:12px;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--ink)}
form.login button{width:100%;margin-top:16px;font:inherit;font-weight:700;padding:13px;border:0;border-radius:10px;background:var(--gold);color:#fff}
.error{color:var(--bad);font-weight:600}
.note{color:var(--muted);font-size:13px}
`;

const shell = (title, body) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow">
<meta name="theme-color" content="${THEME}">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Hallmark">
<link rel="manifest" href="/owner/manifest.webmanifest">
<link rel="icon" href="/owner/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/owner/icon-192.png">
<title>${esc(title)}</title>
<style>${STYLE}</style>
<script src="/owner/app.js" defer></script>
</head><body><main>${body}</main></body></html>`;

const loginPage = ({ error = "" }) => shell("Owner · Sylhet Gold Hallmark", `
<div class="bar"><div><div class="t">Sylhet Gold Hallmark</div><div class="s">Owner's phone app · মালিকের অ্যাপ</div></div></div>
<div class="card">
<form method="post" action="/owner/login" class="login">
<label for="code">Phone app code · কোড</label>
<input id="code" name="code" autocomplete="one-time-code" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX-XXXX" maxlength="20" required>
${error ? `<p class="error" role="alert">${esc(error)}</p>` : ""}
<button type="submit">Open · খুলুন</button>
</form>
<p class="note">Make the code in the shop app: Staff → Owner's phone app. You stay logged in on this phone for 90 days.<br>
After opening, use your browser's menu → <b>Add to Home screen</b>.</p>
</div>`);

const offlinePage = () => shell("Offline", `<div class="card" style="margin-top:40px;text-align:center">
<p style="font-size:40px;margin:0">⌁</p><p><b>You're offline.</b><br>Numbers come back when the phone is online. · ইন্টারনেট নেই।</p>
<p><a href="/owner">Try again</a></p></div>`);

// "+12% vs Wed last week" (or "same" / "new").
const compare = (now, before, label) => {
    if (!before && !now) return `<span>— ${esc(label)}</span>`;
    if (!before) return `<span class="up">new</span> ${esc(label)}`;
    const pct = Math.round(((now - before) / before) * 100);
    if (pct === 0) return `same as ${esc(label)}`;
    return `<span class="${pct > 0 ? "up" : "down"}">${pct > 0 ? "▲" : "▼"} ${Math.abs(pct)}%</span> vs ${esc(label)}`;
};

const ago = (min) => {
    if (min === null) return "never";
    if (min < 1) return "just now";
    if (min < 60) return `${min} min ago`;
    if (min < 48 * 60) return `${Math.round(min / 60)} h ago`;
    return `${Math.round(min / 1440)} days ago`;
};

const healthBar = (beat, h) => {
    const pc = `<div class="pill ${h.pc}"><span class="dot"></span>Shop PC ${beat ? `seen ${ago(h.seenMin)}` : "not seen yet"}</div>`;
    const bk = `<div class="pill ${h.backup}"><span class="dot"></span>Backup ${h.backupHours === null ? "not found" : ago(Math.round(h.backupHours * 60))}</div>`;
    const waiting = beat && beat.waiting > 0 ? `<div class="pill amber"><span class="dot"></span>${num(beat.waiting)} not sent yet</div>` : "";
    return `<div class="health" role="status">${pc}${bk}${waiting}</div>`;
};

// Last 30 days: bars of the bill per day, today on the right.
const barChart = (days) => {
    const W = 600;
    const H = 150;
    const top = 14;
    const bottom = 20;
    const max = Math.max(1, ...days.map((d) => d.billed));
    const step = W / days.length;
    const bw = Math.max(2, step - 4);
    const scale = (v) => ((H - top - bottom) * v) / max;
    const bars = days.map((d, i) => {
        const h = scale(d.billed);
        const x = i * step + (step - bw) / 2;
        const y = H - bottom - h;
        const isToday = i === days.length - 1;
        return `<rect class="${isToday ? "bar-t" : "bar-r"}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(h, d.billed > 0 ? 1 : 0).toFixed(1)}" rx="2"><title>${esc(day(d.day))}: ${taka(d.billed)}, ${d.orders} orders</title></rect>`;
    }).join("");
    const label = (i, anchor) => `<text class="axis" x="${(i * step + step / 2).toFixed(1)}" y="${H - 5}" text-anchor="${anchor}">${esc(day(days[i].day).replace(/ \d{4}$/, ""))}</text>`;
    const best = days.reduce((a, d) => (d.billed > a.billed ? d : a), days[0]);
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Bill per day, last 30 days. Highest ${taka(best.billed)} on ${esc(day(best.day))}.">
<line class="grid-l" x1="0" x2="${W}" y1="${top}" y2="${top}"/><text class="axis" x="0" y="${top - 3}">${taka(max)}</text>
<line class="grid-l" x1="0" x2="${W}" y1="${H - bottom}" y2="${H - bottom}"/>
${bars}${label(0, "start")}${label(Math.floor(days.length / 2), "middle")}${label(days.length - 1, "end")}</svg>`;
};

const rank = (rows, value, sub) => {
    if (!rows.length) return '<p class="note">Nothing yet this month.</p>';
    const max = Math.max(1, ...rows.map(value));
    return `<ol class="rank">${rows.map((r) => `<li><span class="n">${esc(r.name || "—")}</span><span class="m">${esc(r.shown)}</span>
<span class="d"><span style="width:${((100 * value(r)) / max).toFixed(1)}%"></span></span>${sub ? `<span class="x">${sub(r)}</span>` : ""}</li>`).join("")}</ol>`;
};

const PURITY_COLORS = { "22K": "var(--gold)", "21K": "#c99a3b", "18K": "#8f7a4a", "24K": "#e2c36b", "14K": "#6f6a5a", 925: "#9aa6a1", other: "var(--line)" };

const mix = (rows, label, color) => {
    const total = rows.reduce((a, r) => a + r.n, 0);
    if (!total) return '<p class="note">No tests.</p>';
    return `<div class="split" role="img" aria-label="${esc(rows.map((r) => `${label(r)} ${Math.round((100 * r.n) / total)}%`).join(", "))}">${rows
        .map((r) => `<span style="width:${((100 * r.n) / total).toFixed(2)}%;background:${color(r)}"></span>`).join("")}</div>
<div class="legend">${rows.map((r) => `<span><i class="sw" style="background:${color(r)}"></i>${esc(label(r))} <b>${Math.round((100 * r.n) / total)}%</b></span>`).join("")}</div>`;
};

const dashboardPage = ({ owner, stats: s, beat, health: h }) => {
    const lastWeekLabel = `last ${weekday(s.now)}`;
    const m = s.month;
    const monthLabel = m.isCurrent ? "this month" : monthName(m.key);
    const prevLabel = m.isCurrent ? "last month, same days" : monthName(s.prevMonth.key, "short");
    const purityRows = s.purity.map((p) => ({ key: p.purity, n: p.pieces }));
    const typeRows = [{ key: "hallmark", n: m.hallmark }, { key: "xray", n: m.xray }].filter((r) => r.n);
    return shell("Owner · Sylhet Gold Hallmark", `
<div class="bar"><div><div class="t">${esc(day(s.now))}</div><div class="s">${esc(owner.name || "Owner")} · updated ${esc(time(s.now))} · <a href="/owner${m.isCurrent ? "" : `?month=${esc(m.key)}`}">refresh</a></div></div>
<form method="post" action="/owner/logout"><button type="submit">Log out</button></form></div>
${healthBar(beat, h)}

<h2>Today · আজ</h2>
<div class="grid">
<div class="tile hero"><div class="k">Bill today · আজকের বিল</div><div class="v">${taka(s.today.billed)}</div><div class="c">${compare(s.today.billed, s.lastWeek.billed, lastWeekLabel)}</div></div>
<div class="tile"><div class="k">Orders</div><div class="v">${num(s.today.orders)}</div><div class="c">${compare(s.today.orders, s.lastWeek.orders, lastWeekLabel)}</div></div>
<div class="tile"><div class="k">Cash in · নগদ</div><div class="v">${taka(s.today.cash)}</div><div class="c">${num(s.today.pieces)} pieces</div></div>
<div class="tile"><div class="k">Waiting · অপেক্ষায়</div><div class="v">${num(s.waiting.received + s.waiting.ready)}</div><div class="c">${num(s.waiting.ready)} ready for pickup</div></div>
<div class="tile"><div class="k">Due · মোট বাকি</div><div class="v">${taka(s.dues.total)}</div><div class="c">${num(s.dues.customers)} customers</div></div>
</div>

<h2>Last 30 days · ৩০ দিন</h2>
<div class="card chart">${barChart(s.last30)}</div>

<div class="monthnav"><a href="/owner?month=${esc(m.prev)}">← ${esc(monthName(m.prev, "short"))}</a><strong>${esc(monthName(m.key))}</strong>${m.isCurrent ? "<span></span>" : `<a href="/owner${m.next >= s.day.slice(0, 7) ? "" : `?month=${esc(m.next)}`}">${esc(monthName(m.next, "short"))} →</a>`}</div>
<div class="grid">
<div class="tile"><div class="k">Bill ${esc(monthLabel)}</div><div class="v">${taka(m.billed)}</div><div class="c">${compare(m.billed, s.prevMonth.billed, prevLabel)}</div></div>
<div class="tile"><div class="k">Orders</div><div class="v">${num(m.orders)}</div><div class="c">${compare(m.orders, s.prevMonth.orders, prevLabel)}</div></div>
<div class="tile"><div class="k">Cash in</div><div class="v">${taka(m.cash)}</div><div class="c">later payments ${taka(m.paidLater)}</div></div>
<div class="tile"><div class="k">Pieces</div><div class="v">${num(m.pieces)}</div><div class="c">${compare(m.pieces, s.prevMonth.pieces, prevLabel)}</div></div>
</div>

<h2>Tests ${esc(monthLabel)}</h2>
<div class="card">
${mix(typeRows, (r) => TYPE_LABEL[r.key] || r.key, (r) => (r.key === "hallmark" ? "var(--gold)" : "#5d6b66"))}
<div style="height:10px"></div>
${mix(purityRows, (r) => (r.key === "other" ? "Not read" : PURITY[r.key] ? PURITY[r.key].label : r.key), (r) => PURITY_COLORS[r.key] || "#bbb")}
</div>

<h2>Top customers ${esc(monthLabel)}</h2>
<div class="card">${rank(s.topCustomers.map((c) => ({ ...c, shown: taka(c.billed) })), (c) => c.billed, (c) => `${num(c.orders)} orders · ID ${esc(c.customerID)}`)}</div>

<h2>Top shops ${esc(monthLabel)}</h2>
<div class="card">${rank(s.topShops.map((x) => ({ ...x, shown: `${num(x.orders)} orders` })), (x) => x.orders, (x) => `${num(x.pieces)} pieces`)}</div>

<h2>Biggest dues · বড় বাকি</h2>
<div class="card">${s.dues.top.length ? rank(s.dues.top.map((d) => ({ ...d, shown: taka(d.due) })), (d) => d.due, (d) => `ID ${esc(d.customerID)}`) : '<p class="note">No one owes anything. 🎉</p>'}</div>

<h2>Latest orders</h2>
<div class="card latest">${s.latest.map((o) => `<a href="/r/${esc(o.reportToken)}"><span>${esc(o.broughtBy || "—")}<br><span class="x">Memo ${esc(o.voucher ?? "—")} · ${esc(day(o.orderedAt))}, ${esc(time(o.orderedAt))}</span></span><b>${taka(o.total)}</b></a>`).join("") || '<p class="note">No orders yet.</p>'}</div>

<p class="foot">Numbers come from the shop PC${beat && beat.version ? ` (version ${esc(beat.version)})` : ""}. Pull down or tap refresh to update.</p>`);
};

module.exports = { manifest, loginPage, offlinePage, dashboardPage };
