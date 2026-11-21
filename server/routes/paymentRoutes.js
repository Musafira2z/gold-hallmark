// Later payments against a customer's dues. Mounted under /users (login required).
const express = require("express");
const mongoose = require("mongoose");
const User = require("../models/User");
const Payment = require("../models/Payment");
const { customerBalance, round2 } = require("../services/balance");
const { audit } = require("../services/audit");
const { requireOwner } = require("../middleware/auth");

const router = express.Router();

const findCustomer = async (customerID) => {
    const id = Number(customerID);
    if (!Number.isSafeInteger(id)) return null;
    return User.findOne({ customerID: id }).lean();
};

// Balance only (used by the memo).
router.get("/:customerID/balance", async (req, res) => {
    try {
        if (!(await findCustomer(req.params.customerID))) return res.status(404).json({ error: "Customer not found" });
        res.json(await customerBalance(req.params.customerID));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Could not work out the balance" });
    }
});

router.get("/:customerID/payments", async (req, res) => {
    try {
        if (!(await findCustomer(req.params.customerID))) return res.status(404).json({ error: "Customer not found" });
        const payments = await Payment.find({ customerID: String(Number(req.params.customerID)), deletedAt: null })
            .sort({ at: -1 }).limit(100).lean();
        res.json(payments);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Could not load payments" });
    }
});

// Owner and staff can take a payment.
router.post("/:customerID/payments", async (req, res) => {
    try {
        const customer = await findCustomer(req.params.customerID);
        if (!customer) return res.status(404).json({ error: "Customer not found" });
        const amount = Number(req.body?.amount);
        if (!Number.isFinite(amount) || amount <= 0 || amount > 10000000) {
            return res.status(400).json({ error: "Enter the amount received (more than 0)." });
        }
        const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 200) : "";
        const payment = await Payment.create({
            customerID: String(customer.customerID),
            amount: round2(amount),
            note,
            staff: req.staff._id,
            staffName: req.staff.name,
        });
        const balance = await customerBalance(customer.customerID);
        await audit(req, "payment.create", payment._id, `#${customer.customerID} ${customer.name}: received ${payment.amount} taka (due now ${balance.due})`);
        res.status(201).json({ payment, balance });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Could not save the payment" });
    }
});

// Owner only: hide a wrong entry (kept in the database and the activity log).
router.delete("/payments/:id", requireOwner, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "Payment not found" });
        const payment = await Payment.findOneAndUpdate(
            { _id: req.params.id, deletedAt: null },
            { $set: { deletedAt: new Date(), deletedBy: req.staff.name } },
            { new: true }
        );
        if (!payment) return res.status(404).json({ error: "Payment not found" });
        const balance = await customerBalance(payment.customerID);
        await audit(req, "payment.delete", payment._id, `#${payment.customerID}: removed payment of ${payment.amount} taka (due now ${balance.due})`);
        res.json({ payment, balance });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Could not remove the payment" });
    }
});

module.exports = router;
