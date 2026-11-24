const { test } = require("node:test");
const assert = require("node:assert");
const { shopKey, tidyName } = require("../services/shopName");

// Same shop (from real data)
const same = [
    ["AL MODINA JEWELLERS", "AL- MODINA JEWELLERS", "AL-MODINA JEWELLERS"],
    ["DURJOY JEWELLERS", "DURJOY  JEWELLERS", "durjoy jewellers"],
    ["APON JEWELLERS", "APON JEWELLERS."],
    ["D DAMAS JEWELLERS", "D' DAMAS JEWELLERS"],
    ["AL MAHA JEWELLERS", "Al MAHA JEWELLERS"],
    ["SATHI JEWELLERS", "SATHI JEWLLERS", "SATHI JEWELLRS", "SATHI JEWELLARS", "SATHI JEWELERS", "SATHI JEWLERS", "SATHI JEWELLEARS", "SATHI JWELLERS", "SATHI JEWELLRES"],
    ["BITHI SHORNO SHILPALOY", "BITHI SORNO SILPALOY", "BITHI SHORNO SHILPALAY"],
];
for (const group of same) {
    test(`same shop: ${group.join(" | ")}`, () => {
        const keys = new Set(group.map(shopKey));
        assert.equal(keys.size, 1);
    });
}

// Different shops stay different
const different = [
    ["MAA JEWELLERS", "MAA JEWELLERY"],
    ["SHORNA JEWELLERS", "SHORNO JEWELLERS"],
    ["VENUS JEWELLERS", "NEW VENUS JEWELLERS"],
    ["ANESHA BALL & CHAIN GHOR", "ANESHA BALL CHAIN GHOR"],
];
for (const [a, b] of different) {
    test(`different: ${a} | ${b}`, () => assert.notEqual(shopKey(a), shopKey(b)));
}

test("no shop", () => {
    for (const v of ["NILL", "nil", "NIL", "", "  ", "-", "N/A", "0", ".", null, undefined, 5]) {
        assert.equal(shopKey(v), null, JSON.stringify(v));
    }
});

test("tidy name", () => {
    assert.equal(tidyName("  APON   JEWELLERS. "), "APON JEWELLERS");
});
