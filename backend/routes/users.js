const express = require("express");
const { attachAuth, requireAuth } = require("../middlewares/jwtAuth");
const authorize = require("../middlewares/authorize");
const { listUsers, getUser, createUser, updateUser, deleteUser } = require("../controllers/admin/usersController");

const router = express.Router();

router.use(attachAuth, requireAuth, authorize("admin"));

router.get("/", listUsers);
router.get("/:id", getUser);
router.post("/", createUser);
router.put("/:id", updateUser);
router.delete("/:id", deleteUser);

module.exports = router;
