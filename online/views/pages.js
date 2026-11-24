// Server-built HTML pages. No JavaScript needed, so they open fast on any phone.
const CENTER = "Sylhet Gold Hallmark Center";
const TZ = "Asia/Dhaka";
const TYPE_LABEL = { hallmark: "Hallmark", xray: "X-ray" };
const PURITY = {
    "24K": { label: "24K gold", pct: "99.9%" },
    "22K": { label: "22K gold", pct: "91.6%" },
    "21K": { label: "21K gold", pct: "87.5%" },
    "18K": { label: "18K gold", pct: "75.0%" },
    "14K": { label: "14K gold", pct: "58.5%" },
    "925": { label: "Silver 925", pct: "92.5%" },
};

const esc = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

const day = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { timeZone: TZ, day: "numeric", month: "short", year: "numeric" }) : "");
const time = (d) => (d ? new Date(d).toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit", hour12: true }) : "");

const STYLE = `
:root{--bg:#f4f1ea;--card:#fff;--ink:#1d2a26;--muted:#5d6b66;--line:#e3ddd0;--gold:#a8811c;--ok:#1f7a4d;--okbg:#e6f4ec;--bad:#b3261e;--badbg:#fbe9e7;--warn:#8a5a00;--warnbg:#fff4dc}
@media (prefers-color-scheme:dark){:root{--bg:#141a18;--card:#1d2522;--ink:#eef2ef;--muted:#a3b0ab;--line:#2f3a36;--gold:#d8b45a;--ok:#7fd3a6;--okbg:#173327;--bad:#ff8a80;--badbg:#3a1d1b;--warn:#f3c26b;--warnbg:#3a2e14}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans Bengali",sans-serif}
main{max-width:560px;margin:0 auto;padding:16px}
header{text-align:center;padding:12px 0 16px}
header .brand{font-weight:700;font-size:18px;letter-spacing:.2px}
header .bn{color:var(--muted);font-size:14px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px;margin-bottom:14px}
.status{display:flex;gap:10px;align-items:center;border-radius:12px;padding:12px 14px;margin-bottom:14px;font-weight:600}
.status small{display:block;font-weight:400}
.ok{background:var(--okbg);color:var(--ok)}
.bad{background:var(--badbg);color:var(--bad)}
.warn{background:var(--warnbg);color:var(--warn)}
.mark{font-size:22px;line-height:1}
dl{display:grid;grid-template-columns:auto 1fr;gap:6px 14px;margin:0}
dt{color:var(--muted)}
dd{margin:0;font-weight:600;text-align:right}
h2{font-size:15px;margin:0 0 10px;color:var(--muted);font-weight:600}
.item{border-top:1px solid var(--line);padding:12px 0}
.item:first-of-type{border-top:0;padding-top:0}
.item .name{font-weight:700}
.item .meta{color:var(--muted);font-size:14px}
.result{margin-top:6px;padding:8px 10px;border-radius:8px;background:var(--bg);border-left:4px solid var(--gold)}
.result span{display:block;font-size:12px;color:var(--muted)}
.purity{font-size:22px;font-weight:800;color:var(--gold);line-height:1.2}
.purity small{font-size:14px;font-weight:600;color:var(--muted);margin-left:6px}
form label{display:block;font-size:14px;color:var(--muted);margin:10px 0 4px}
input{width:100%;font:inherit;padding:12px;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--ink)}
button{width:100%;margin-top:16px;font:inherit;font-weight:700;padding:12px;border:0;border-radius:10px;background:var(--gold);color:#fff}
.error{color:var(--bad);font-weight:600;margin:10px 0 0}
footer{color:var(--muted);font-size:13px;text-align:center;padding:8px 0 24px}
a{color:var(--gold)}
`;

const layout = (title, body) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${esc(title)}</title>
<style>${STYLE}</style></head>
<body><main>
<header><div class="brand">${CENTER}</div><div class="bn">সিলেট গোল্ড হলমার্ক সেন্টার</div></header>
${body}
<footer><a href="/report">Check another report · অন্য রিপোর্ট দেখুন</a></footer>
</main></body></html>`;

const statusBox = (r) => {
    if (r.deletedAt) {
        return `<div class="status bad"><span class="mark">✕</span><div>Cancelled report · বাতিল রিপোর্ট
<small>This memo was cancelled by the center on ${esc(day(r.deletedAt))}. Do not rely on it.</small></div></div>`;
    }
    const corrected = r.editedAt
        ? `<div class="status warn"><span class="mark">!</span><div>Corrected · সংশোধিত
<small>The center corrected this report on ${esc(day(r.editedAt))}. This page shows the latest version.</small></div></div>`
        : "";
    const ready = r.status === "ready"
        ? `<div class="status ok"><span class="mark">●</span><div>Ready for pickup · নিয়ে যাওয়ার জন্য প্রস্তুত
<small>Since ${esc(day(r.readyAt))}, ${esc(time(r.readyAt))}</small></div></div>`
        : "";
    return `<div class="status ok"><span class="mark">✓</span><div>Verified report · যাচাইকৃত রিপোর্ট
<small>Issued by ${CENTER}</small></div></div>${ready}${corrected}`;
};

const weightText = (it) => (it.weight === null || it.weight === undefined ? "" : `${it.weight} ${it.weightUnite || ""}`.trim());

const reportPage = (r) => {
    const items = (r.items || []).map((it) => {
        const meta = [it.quantity ? `Qty ${esc(it.quantity)}` : "", weightText(it) ? `Weight ${esc(weightText(it))}` : ""]
            .filter(Boolean).join(" · ");
        const p = PURITY[it.purity];
        let result = "";
        if (p) {
            const mark = it.xray ? `<span style="margin-top:6px">Mark on item · গহনায় ছাপ</span>${esc(it.xray)}` : "";
            result = `<div class="result"><span>Purity · বিশুদ্ধতা</span><div class="purity">${p.label}<small>${p.pct}</small></div>${mark}</div>`;
        } else if (it.xray) {
            result = `<div class="result"><span>Result · ফলাফল</span>${esc(it.xray)}</div>`;
        }
        return `<div class="item"><div class="name">${esc(it.item || "Item")}</div>${meta ? `<div class="meta">${meta}</div>` : ""}${result}</div>`;
    }).join("");
    const body = `${statusBox(r)}
<div class="card"><dl>
<dt>Memo no · মেমো</dt><dd>${esc(r.voucher ?? "—")}</dd>
<dt>Date · তারিখ</dt><dd>${esc(day(r.orderedAt))}, ${esc(time(r.orderedAt))}</dd>
<dt>Test · পরীক্ষা</dt><dd>${esc(TYPE_LABEL[r.type] || r.type || "—")}</dd>
${r.company ? `<dt>Shop · দোকান</dt><dd>${esc(r.company)}</dd>` : ""}
</dl></div>
<div class="card"><h2>Items · গহনা</h2>${items || '<div class="meta">No items</div>'}</div>`;
    return layout(`Memo ${r.voucher ?? ""} · Report`, body);
};

const notFoundPage = () => layout("Report not found", `<div class="status bad"><span class="mark">?</span><div>Report not found · রিপোর্ট পাওয়া যায়নি
<small>Check the link, or enter the memo number and code below.</small></div></div>${lookupForm({})}`);

const lookupForm = ({ memo = "", code = "", error = "" }) => `<div class="card">
<h2>Find a report · রিপোর্ট খুঁজুন</h2>
<form method="get" action="/report">
<label for="memo">Memo number · মেমো নম্বর</label>
<input id="memo" name="memo" inputmode="numeric" autocomplete="off" maxlength="12" value="${esc(memo)}" required>
<label for="code">Report code (on the memo) · রিপোর্ট কোড</label>
<input id="code" name="code" autocomplete="off" autocapitalize="characters" maxlength="8" value="${esc(code)}" required>
${error ? `<p class="error">${esc(error)}</p>` : ""}
<button type="submit">Show report · দেখুন</button>
</form></div>`;

const lookupPage = (opts) => layout("Find a report", lookupForm(opts));

module.exports = { reportPage, notFoundPage, lookupPage, esc };
