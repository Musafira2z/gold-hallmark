const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Photos (customer + order) live in server/uploads. docker-compose maps this
// folder to ./uploads on the PC so photos survive an update (BUGS D12).
const uploadsDir = path.join(__dirname, "..", "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

// The file name's extension comes from the image type, never from the
// uploaded name, so nothing but a picture can be served back (BUGS D9).
const EXT_BY_TYPE = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/bmp": ".bmp",
};

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
        const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `${file.fieldname}-${suffix}${EXT_BY_TYPE[file.mimetype]}`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: MAX_BYTES },
    fileFilter: (_req, file, cb) => {
        if (EXT_BY_TYPE[file.mimetype]) return cb(null, true);
        const error = new Error("Only photos are allowed (JPG, PNG, WebP, GIF, BMP).");
        error.badFile = true;
        return cb(error, false);
    },
});

// One optional photo in the "image" field. Bad files get a clear 400, not a 500.
const uploadImage = (req, res, next) =>
    upload.single("image")(req, res, (error) => {
        if (!error) return next();
        if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({ error: "Photo is too big (max 5 MB)." });
        }
        if (error.badFile || error instanceof multer.MulterError) {
            return res.status(400).json({ error: error.message });
        }
        return next(error);
    });

module.exports = { uploadsDir, uploadImage };
