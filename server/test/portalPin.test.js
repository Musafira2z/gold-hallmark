// Plan 18: online login PIN.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { makePin, hashPin, checkPin, loginPhone } = require("../services/portalPin");
const { toAccount, toReport } = require("../services/sync");

test("PINs are 6 digits and vary", () => {
    const pins = new Set(Array.from({ length: 200 }, makePin));
    for (const p of pins) assert.match(p, /^\d{6}$/);
    assert.ok(pins.size > 190);
});

test("hash checks the right PIN only, and never contains it", () => {
    const h = hashPin("012345");
    assert.match(h, /^scrypt\$16384\$8\$1\$[A-Za-z0-9+/=]{24}\$[A-Za-z0-9+/=]{44}$/);
    assert.ok(!h.includes("012345"));
    assert.equal(checkPin("012345", h), true);
    assert.equal(checkPin("012346", h), false);
    assert.equal(checkPin("12345", h), false);
    assert.equal(checkPin("0123456", h), false);
    assert.notEqual(hashPin("012345"), h); // salted
});

test("bad stored values never pass", () => {
    const h = hashPin("111111");
    assert.equal(checkPin("111111", null), false);
    assert.equal(checkPin("111111", ""), false);
    assert.equal(checkPin("111111", h.replace("16384", "2")), false); // weaker settings refused
    assert.equal(checkPin("111111", h.split("$").slice(0, 5).join("$")), false);
    assert.throws(() => hashPin("abc"));
});

test("login phone", () => {
    assert.equal(loginPhone("01749479627"), "01749479627");
    assert.equal(loginPhone(1749479627), "01749479627");
    assert.equal(loginPhone("+880 1749-479627"), "01749479627");
    assert.equal(loginPhone("154454"), null);
    assert.equal(loginPhone(""), null);
    assert.equal(loginPhone(undefined), null);
});

test("account sent to the website: hash only while the login is on", () => {
    const shops = new Map([["6b05b44fb40cf43735fffc57", "MAA JEWELLERS"]]);
    const base = { _id: "u1", customerID: 150, name: "BIKASH DAS", contact: "01749479627", kind: "shop_owner",
        portalPinHash: "scrypt$x", portalPinSetAt: new Date(), portalShops: ["6b05b44fb40cf43735fffc57", "6b05b44fb40cf43735fffc58"] };
    const a = toAccount(base, shops);
    assert.equal(a.pinHash, "scrypt$x");
    assert.equal(a.phone, "01749479627");
    assert.deepEqual(a.shops, [{ id: "6b05b44fb40cf43735fffc57", name: "MAA JEWELLERS" }]);
    assert.equal(toAccount({ ...base, portalOffAt: new Date() }, shops).pinHash, null);
    assert.equal(toAccount({ ...base, deletedAt: new Date() }, shops).pinHash, null);
    assert.deepEqual(toAccount({ ...base, kind: "karigor" }, shops).shops, []);
});

test("order sent to the website has portal fields but never a phone", () => {
    const r = toReport({ _id: "o1", reportToken: "t", reportCode: "c", customerID: "150", name: "BIKASH DAS", contact: "01749479627",
        shopId: "s1", totalAmount: 80, items: [] });
    assert.equal(r.customerID, "150");
    assert.equal(r.broughtBy, "BIKASH DAS");
    assert.equal(r.total, 80);
    assert.equal(r.paid, 80);
    assert.ok(!JSON.stringify(r).includes("01749479627"));
    assert.equal(toReport({ _id: "o2", totalAmount: 80, paidAmount: 30, items: [] }).paid, 30);
});
