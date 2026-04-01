const express = require("express");
const router = express.Router();
const { attachAuth } = require("../middlewares/jwtAuth");
const imageUpload = require("../middlewares/multer");
const { audioUpload } = require("../middlewares/multer");
const { handleMessage, handleSpeechToText } = require("../controllers/chat/chatController");

router.use(attachAuth);

router.post("/message", imageUpload.array("images", 5), handleMessage);
router.post("/speech-to-text", audioUpload.single("audio"), handleSpeechToText);

module.exports = router;
