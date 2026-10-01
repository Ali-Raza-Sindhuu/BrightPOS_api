const multer = require("multer");
const path = require("path");
const fs = require("fs");

const config = require("../config/env");

// Configurable so the uploads folder can live outside the deploy directory on
// cPanel — otherwise replacing the app folder on redeploy wipes every image.
const uploadDir = path.join(config.uploads.dir, "items");

if (process.env.VERCEL !== "1" && !fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = process.env.VERCEL === "1" ? multer.memoryStorage() : multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    const uniqueName =
      Date.now() + "-" + Math.round(Math.random() * 1e9) +
      path.extname(file.originalname);

    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed"));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: Math.min(config.uploads.maxFileSizeMb, process.env.VERCEL === "1" ? 4 : config.uploads.maxFileSizeMb) * 1024 * 1024
  }
});

async function storeItemImage(file) {
  if (!file) return null;
  if (process.env.VERCEL === "1") {
    const { put } = await import("@vercel/blob");
    const blob = await put(`items/${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "-")}`, file.buffer, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.mimetype,
    });
    return blob.url;
  }
  return `/api/uploads/items/${file.filename}`;
}

module.exports = upload;
module.exports.storeItemImage = storeItemImage;
