
const multer = require("multer");

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) cb(null, true);
  else cb(new Error("Not an image file"), false);
};

const imageUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

const audioFileFilter = (_req, file, cb) => {
  if (
    file.mimetype.startsWith("audio/") ||
    file.mimetype === "application/octet-stream"
  ) {
    cb(null, true);
  } else {
    cb(new Error("Only audio files are allowed"), false);
  }
};

const audioUpload = multer({
  storage,
  fileFilter: audioFileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

module.exports = imageUpload;
module.exports.audioUpload = audioUpload;
