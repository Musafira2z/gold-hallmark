// Portal pages (Plan 18). Server-built, no JavaScript: fast on any phone.
const { esc, day, time, layout, PURITY, TYPE_LABEL } = require("./pages");

const KIND = { shop_owner: "Shop owner · দোকান মালিক", karigor: "Karigor · কারিগর", other: "Customer · গ্রাহক", "": "Customer · গ্রাহক" };
const STATUS = {
    received: { label: "In test · পরীক্ষায়", cls: "tag" },
    ready: { label: "Ready · প্রস্তুত", cls: "tag ok" },
    delivered: { label: "Delivered · নেওয়া হয়েছে", cls: "tag muted" },
};
const taka = (n) => `৳${(Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const monthName = (key) => {
    const [y, m] = key.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
};
const qs = (params) => {
    const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== "" && v !== undefined && v !== null)).toString();
    return s ? `?${s}` : "";
};

const STYLE = `
.top{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:14px}
.top h1{font-size:20px;margin:0}
.top .kind{color:var(--muted);font-size:14px}
.top form button{width:auto;margin:0;padding:8px 12px;background:transparent;color:var(--muted);border:1px solid var(--line);font-weight:600}
.tiles{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}
.tile{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px 14px}
.tile .k{font-size:13px;color:var(--muted)}
.tile .v{font-size:22px;font-weight:800;line-height:1.3}
.tile .s{font-size:13px;color:var(--muted)}
.tile.due .v{color:var(--bad)}
.tile.clear .v{color:var(--ok)}
.tile a{font-size:14px}
.rows{list-style:none;margin:0;padding:0}
.rows li{border-top:1px solid var(--line)}
.rows li:first-child{border-top:0}
.rows a.row{display:block;padding:12px 0;color:inherit;text-decoration:none}
.row .l1{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;font-weight:700}
.row .l2,.row .l3{color:var(--muted);font-size:14px;display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}
.row .money{font-weight:700;color:var(--ink)}
.tag{display:inline-block;flex:none;align-self:flex-start;line-height:1.6;font-size:12px;font-weight:700;padding:2px 8px;border-radius:999px;background:var(--bg);color:var(--muted);white-space:nowrap}
.tag.ok{background:var(--okbg);color:var(--ok)}
.tag.muted{opacity:.8}
.k22{color:var(--gold);font-weight:800}
.filters{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.filters label{margin:0 0 2px;font-size:13px}
.filters input,.filters select{padding:9px;font:inherit;width:100%;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--ink)}
.filters .wide{grid-column:1/-1}
.filters button{margin-top:4px}
.clear-link{display:block;text-align:center;margin-top:8px;font-size:14px}
.pager{display:flex;justify-content:space-between;align-items:center;gap:10px;margin:4px 0 14px}
.pager a,.pager span{font-size:15px}
.ready{border-color:var(--ok)}
.ready h2{color:var(--ok)}
table{width:100%;border-collapse:collapse;font-size:14px}
th,td{text-align:left;padding:8px 4px;border-top:1px solid var(--line);vertical-align:top}
th{color:var(--muted);font-weight:600;border-top:0}
td.n,th.n{text-align:right;white-space:nowrap}
tfoot td{font-weight:800}
.monthnav{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
.monthnav strong{font-size:18px}
.note{color:var(--muted);font-size:13px}
@media print{.noprint,footer,.top form{display:none}body{background:#fff}.card,.tile{border-color:#ccc}}
`;

const FOOTER = `<a href="/me">My tests · আমার পরীক্ষা</a> · <a href="/report">Find a report · রিপোর্ট খুঁজুন</a>`;
const page = (title, body) => layout(title, `<style>${STYLE}</style>${body}`, FOOTER);

const loginPage = ({ phone = "", error = "" }) => layout("Log in · Sylhet Gold Hallmark", `
<div class="card">
<h2>Log in to see your tests · আপনার পরীক্ষা দেখতে লগইন করুন</h2>
<form method="post" action="/login">
<label for="phone">Mobile number · মোবাইল নম্বর</label>
<input id="phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="01XXXXXXXXX" maxlength="20" value="${esc(phone)}" required>
<label for="pin">PIN (6 digits) · পিন (৬ সংখ্যা)</label>
<input id="pin" name="pin" type="password" inputmode="numeric" autocomplete="current-password" pattern="[0-9]{6}" maxlength="6" required>
${error ? `<p class="error" role="alert">${esc(error)}</p>` : ""}
<button type="submit">Log in · লগইন</button>
</form>
<p class="note" style="margin:14px 0 0">No PIN yet, or forgot it? Ask at the counter. It is free. · পিন নেই বা ভুলে গেছেন? কাউন্টারে বলুন, এটি ফ্রি।</p>
</div>`);

const itemLine = (r) => {
    const items = r.items || [];
    if (!items.length) return "No items";
    const first = items.slice(0, 2).map((it) => `${esc(it.item || "Item")}${it.quantity > 1 ? ` ×${esc(it.quantity)}` : ""}`).join(", ");
    return items.length > 2 ? `${first} +${items.length - 2}` : first;
};
const purityLine = (r) => {
    const set = [...new Set((r.items || []).map((it) => it.purity).filter(Boolean))];
    return set.map((p) => `<span class="k22">${esc(PURITY[p] ? PURITY[p].label : p)}</span>`).join(" ");
};

// One test in a list. Taka only on the account's own orders.
const row = (r, acc) => {
    const own = r.customerID === acc.customerID;
    const st = STATUS[r.status] || STATUS.delivered;
    const by = own ? "" : `Brought by ${esc(r.broughtBy || "another customer")}`;
    return `<li><a class="row" href="/r/${esc(r.reportToken)}">
<div class="l1"><span>Memo ${esc(r.voucher ?? "—")} · ${esc(TYPE_LABEL[r.type] || r.type || "")}</span><span class="${st.cls}">${st.label}</span></div>
<div class="l2"><span>${itemLine(r)}</span>${own ? `<span class="money">${taka(r.total)}</span>` : ""}</div>
<div class="l3"><span>${esc(day(r.orderedAt))}, ${esc(time(r.orderedAt))}${r.company ? ` · ${esc(r.company)}` : ""}</span><span>${purityLine(r)}</span></div>
${by ? `<div class="l3"><span>${by}</span></div>` : ""}
</a></li>`;
};

const header = (acc) => {
    const shops = (acc.shops || []).map((s) => esc(s.name)).join(", ");
    return `<div class="top">
<div><h1>${esc(acc.name || "Customer")}</h1><div class="kind">${KIND[acc.kind] || KIND[""]} · ID ${esc(acc.customerID)}${shops ? `<br>${shops}` : ""}</div></div>
<form method="post" action="/logout" class="noprint"><button type="submit">Log out</button></form>
</div>`;
};

const mePage = ({ acc, filters, page: pg, pages, total, rows, ready, balance, month }) => {
    const due = balance.due;
    const dueTile = due > 0
        ? `<div class="tile due"><div class="k">Due · বাকি</div><div class="v">${taka(due)}</div><div class="s"><a href="/me/statement">Statement · হিসাব</a></div></div>`
        : `<div class="tile clear"><div class="k">Due · বাকি</div><div class="v">${due < 0 ? `${taka(-due)} advance` : "৳0"}</div><div class="s"><a href="/me/statement">Statement · হিসাব</a></div></div>`;
    const monthTile = `<div class="tile"><div class="k">${esc(monthName(month.key))} · এই মাস</div><div class="v">${month.tests} tests</div>
<div class="s">${taka(month.billed)}${month.all !== null && month.all !== undefined ? ` · ${month.all} at your shop${(acc.shops || []).length > 1 ? "s" : ""}` : ""}</div></div>`;
    const readyCard = ready.length
        ? `<div class="card ready"><h2>Ready for pickup · নিয়ে যাওয়ার জন্য প্রস্তুত (${ready.length})</h2><ul class="rows">${ready.map((r) => row(r, acc)).join("")}</ul></div>`
        : "";
    const shopSelect = (acc.shops || []).length
        ? `<div><label for="shop">Shop · দোকান</label><select id="shop" name="shop"><option value="">All · সব</option>${acc.shops
            .map((s) => `<option value="${esc(s.id)}"${filters.shop === s.id ? " selected" : ""}>${esc(s.name)}</option>`).join("")}</select></div>`
        : "";
    const statusSelect = `<div><label for="status">Status · অবস্থা</label><select id="status" name="status"><option value="">All · সব</option>${Object.entries(STATUS)
        .map(([k, v]) => `<option value="${k}"${filters.status === k ? " selected" : ""}>${v.label}</option>`).join("")}</select></div>`;
    const anyFilter = filters.month || filters.shop || filters.status || filters.memo;
    const filterForm = `<form method="get" action="/me" class="filters noprint">
<div><label for="memo">Memo no · মেমো</label><input id="memo" name="memo" inputmode="numeric" maxlength="12" value="${esc(filters.memo)}"></div>
<div><label for="month">Month · মাস</label><input id="month" name="month" type="month" value="${esc(filters.month)}"></div>
${statusSelect}${shopSelect}
<div class="wide"><button type="submit">Show · দেখুন</button></div>
</form>${anyFilter ? '<a class="clear-link noprint" href="/me">Clear · সব দেখুন</a>' : ""}`;
    const link = (p) => `/me${qs({ ...filters, page: p > 1 ? p : "" })}`;
    const pager = pages > 1
        ? `<div class="pager noprint">${pg > 1 ? `<a href="${esc(link(pg - 1))}">← Newer</a>` : "<span></span>"}<span>Page ${pg} of ${pages}</span>${pg < pages ? `<a href="${esc(link(pg + 1))}">Older →</a>` : "<span></span>"}</div>`
        : "";
    const list = rows.length
        ? `<ul class="rows">${rows.map((r) => row(r, acc)).join("")}</ul>`
        : `<p class="note">${anyFilter ? "No tests match. · কিছু পাওয়া যায়নি।" : "No tests yet. · এখনো কোনো পরীক্ষা নেই।"}</p>`;
    return page("My tests · Sylhet Gold Hallmark", `${header(acc)}
<div class="tiles">${dueTile}${monthTile}</div>
${readyCard}
<div class="card"><h2>${anyFilter ? `Found ${total}` : `All tests · সব পরীক্ষা (${total})`}</h2>${filterForm}</div>
<div class="card">${list}</div>
${pager}`);
};

const statementPage = ({ acc, range, orders, payments, totals, balance }) => {
    const body = orders.map((o) => `<tr><td>${esc(day(o.orderedAt))}</td><td><a href="/r/${esc(o.reportToken)}">${esc(o.voucher ?? "—")}</a><br><span class="note">${itemLine(o)}</span></td>
<td class="n">${taka(o.total)}</td><td class="n">${taka(o.paid)}</td></tr>`).join("");
    const pays = payments.length
        ? `<div class="card"><h2>Payments this month · এই মাসে জমা</h2><table><thead><tr><th>Date</th><th class="n">Amount</th></tr></thead><tbody>${payments
            .map((p) => `<tr><td>${esc(day(p.at))}</td><td class="n">${taka(p.amount)}</td></tr>`).join("")}</tbody></table></div>`
        : "";
    const due = balance.due;
    return page(`Statement ${monthName(range.key)} · Sylhet Gold Hallmark`, `${header(acc)}
<div class="monthnav noprint"><a href="/me/statement?month=${range.prev}">← ${esc(monthName(range.prev))}</a><a href="/me/statement?month=${range.next}">${esc(monthName(range.next))} →</a></div>
<div class="card"><div class="monthnav"><strong>${esc(monthName(range.key))}</strong><span class="note">Statement · মাসিক হিসাব</span></div>
<dl>
<dt>Tests · পরীক্ষা</dt><dd>${totals.tests} (${totals.pieces} pcs)</dd>
<dt>Billed · বিল</dt><dd>${taka(totals.billed)}</dd>
<dt>Paid with orders · সাথে জমা</dt><dd>${taka(totals.paidAtOrder)}</dd>
<dt>Paid later · পরে জমা</dt><dd>${taka(totals.paidLater)}</dd>
</dl></div>
<div class="tiles"><div class="tile ${due > 0 ? "due" : "clear"}" style="grid-column:1/-1"><div class="k">Due now (all months) · এখন মোট বাকি</div><div class="v">${due < 0 ? `${taka(-due)} advance` : taka(due)}</div>
<div class="s">Billed ${taka(balance.billed)} · paid ${taka(balance.paidAtOrder + balance.paidLater)}</div></div></div>
<div class="card"><h2>Orders · অর্ডার</h2>${orders.length
        ? `<table><thead><tr><th>Date</th><th>Memo</th><th class="n">Bill</th><th class="n">Paid</th></tr></thead><tbody>${body}</tbody>
<tfoot><tr><td colspan="2">Total</td><td class="n">${taka(totals.billed)}</td><td class="n">${taka(totals.paidAtOrder)}</td></tr></tfoot></table>`
        : '<p class="note">No orders this month. · এই মাসে কোনো অর্ডার নেই।</p>'}</div>
${pays}
<p class="note">Only orders you brought yourself are on this statement. · শুধু আপনার নিজের আনা অর্ডার।</p>`);
};

module.exports = { loginPage, mePage, statementPage };
