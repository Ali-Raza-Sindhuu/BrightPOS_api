const ApiError = require('../utils/api-error');
const crypto = require('node:crypto');
const imageTypes = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp' };
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
      imageTypes[file.mimetype];

    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  if (Boolean(imageTypes[file.mimetype])) {
    cb(null, true);
  } else {
    cb(new ApiError(422, "Only PNG, JPEG, GIF and WebP images are allowed"));
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
  const content = file.buffer || await fs.promises.readFile(file.path);
  const detected = detectImage(content);
  if (!detected || detected !== file.mimetype) {
    if (file.path) await fs.promises.unlink(file.path).catch(() => {});
    throw new ApiError(422, 'Image content does not match a supported raster format');
  }
  if (process.env.VERCEL === "1") {
    const { put } = await import("@vercel/blob");
    const blob = await put(`items/${Date.now()}-${crypto.randomUUID() + imageTypes[detected]}`, file.buffer, {
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

function detectImage(buffer) {
  if (buffer.length < 16) return null;
  if (buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && buffer.toString('ascii',12,16) === 'IHDR') return 'image/png';
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return 'image/jpeg';
  if (['GIF87a', 'GIF89a'].includes(buffer.toString('ascii',0,6))) return 'image/gif';
  if (buffer.toString('ascii',0,4) === 'RIFF' && buffer.toString('ascii',8,12) === 'WEBP') return 'image/webp';
  return null;
}
module.exports.detectImage = detectImage;
