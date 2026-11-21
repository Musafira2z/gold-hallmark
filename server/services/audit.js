const AuditLog = require("../models/AuditLog");

// Write one line to the activity log. Never throws: a log problem must not
// stop the real work (it is reported in the server log instead).
const audit = async (req, action, target, summary) => {
    try {
        await AuditLog.create({
            staff: req && req.staff ? req.staff._id : undefined,
            staffName: req && req.staff ? req.staff.name : undefined,
            action,
            target: target === undefined || target === null ? undefined : String(target),
            summary,
        });
    } catch (error) {
        console.error("Could not write activity log:", error.message);
    }
};

module.exports = { audit };
