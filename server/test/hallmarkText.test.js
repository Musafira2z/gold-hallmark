const { test } = require("node:test");
const assert = require("node:assert");
const { readHallmark, withPurity } = require("../services/hallmarkText");

const cases = [
    // text, purity, stamp — all taken from real orders
    ["916", "22K", ""],
    ["22K", "22K", ""],
    ["PJ 916", "22K", "PJ"],
    ["MJL 22K", "22K", "MJL"],
    ["916 A", "22K", "A"],
    ["SHORNA J 916 K", "22K", "SHORNA J"],
    ["SJ916", "22K", "SJ"],
    ["sj 916", "22K", "SJ"],
    ["22 K", "22K", ""],
    ["22CT", "22K", ""],
    ["DSS 22C", "22K", "DSS"],
    ["22T", "22K", ""],
    ["9*16", "22K", ""],
    ["916 ORIGINAL", "22K", "ORIGINAL"],
    ["21K", "21K", ""],
    ["P 21T", "21K", "P"],
    ["N 21K", "21K", "N"],
    ["DSS 875", "21K", "DSS"],
    ["18K", "18K", ""],
    ["KVJ 18.K", "18K", "KVJ"],
    ["18T", "18K", ""],
    ["999", "24K", ""],
    ["925 SILVAR", "925", "SILVAR"],
    // unclear: no purity guessed
    ["1", null, ""],
    ["2.91", null, ""],
    ["22", null, ""],
    ["91", null, ""],
    ["FAIL", null, "FAIL"],
    ["SJ 2K", null, "SJ"],
    ["MJ.L 22L", null, "MJ L"],
    ["916.A", "22K", "A"],
    ["22K.T", "22K", ""],
    ["SHORNA J. 916.K", "22K", "SHORNA J"],
    ["TNJ 22K.T", "22K", "TNJ"],
    [".916", "22K", ""],
    ["MJ 916.SS", "22K", "MJ SS"],
    ["", null, ""],
];

for (const [text, purity, stamp] of cases) {
    test(`"${text}" -> ${purity} / "${stamp}"`, () => {
        assert.deepEqual(readHallmark(text), { purity, stamp });
    });
}

test("non-text is safe", () => {
    assert.deepEqual(readHallmark(undefined), { purity: null, stamp: "" });
    assert.deepEqual(readHallmark(916), { purity: null, stamp: "" });
});

test("withPurity keeps the item and adds the fields", () => {
    const [it] = withPurity([{ item: "Ring", xray: "PJ 916", quantity: 1 }]);
    assert.deepEqual(it, { item: "Ring", xray: "PJ 916", quantity: 1, purity: "22K", stamp: "PJ" });
});
