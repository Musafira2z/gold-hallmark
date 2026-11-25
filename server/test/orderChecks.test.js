// Plan 17: the server checks every new order (items, customer, type).
const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const User = require("../models/User");
const { checkNewOrder } = require("../services/orderService");

let known = new Set([441]);
let asked = null;
beforeEach(() => {
    known = new Set([441]);
    User.exists = async (filter) => {
        asked = filter;
        return known.has(filter.customerID) ? { _id: "x" } : null;
    };
});

const ring = { item: "Ring", quantity: 2, rate: 40, weight: 3.5, xray: "22K 916" };
const order = (over = {}) => ({ type: "hallmark", customerID: "441", ...over });
const fails = async (data, items, message) => {
    await assert.rejects(checkNewOrder(data, items), (e) => {
        assert.equal(e.status, 400);
        assert.match(e.message, message);
        return true;
    });
};

test("a normal order passes, amounts worked out on the server", async () => {
    const r = await checkNewOrder(order(), [{ ...ring, amount: 999999 }, { item: "Chain", quantity: "1", rate: "0" }]);
    assert.equal(r.total, 80);
    assert.equal(r.items[0].amount, 80);
    assert.equal(r.items[1].amount, 0);
    assert.equal(r.items[0].xray, "22K 916");
    assert.deepEqual(asked, { customerID: 441, deletedAt: null });
});

test("x-ray orders pass", async () => {
    const r = await checkNewOrder(order({ type: "xray" }), [ring]);
    assert.equal(r.items.length, 1);
});

test("no items, or items that aren't a list, are refused", async () => {
    await fails(order(), [], /at least one item/);
    await fails(order(), undefined, /at least one item/);
    await fails(order(), "Ring", /at least one item/);
});

test("each item needs a name, a quantity above 0 and a rate of 0 or more", async () => {
    await fails(order(), [{ ...ring, item: "  " }], /Item 1: choose the item name/);
    await fails(order(), [ring, { ...ring, quantity: 0 }], /Item 2 \(Ring\): enter Quantity/);
    await fails(order(), [{ ...ring, quantity: "" }], /enter Quantity/);
    await fails(order(), [{ ...ring, rate: -1 }], /enter Rate/);
    await fails(order(), [{ ...ring, rate: "abc" }], /enter Rate/);
});

test("type must be hallmark or xray", async () => {
    await fails(order({ type: undefined }), [ring], /Hallmark or X-ray/);
    await fails(order({ type: "" }), [ring], /Hallmark or X-ray/);
    await fails(order({ type: "gold" }), [ring], /Hallmark or X-ray/);
    await fails(order({ type: { $ne: 1 } }), [ring], /Hallmark or X-ray/);
});

test("customer must be given and must exist", async () => {
    await fails(order({ customerID: undefined }), [ring], /Choose the customer/);
    await fails(order({ customerID: "" }), [ring], /Choose the customer/);
    await fails(order({ customerID: "abc" }), [ring], /Choose the customer/);
    await fails(order({ customerID: { $gt: 0 } }), [ring], /Choose the customer/);
    await fails(order({ customerID: "99999" }), [ring], /Customer 99999 was not found/);
});
