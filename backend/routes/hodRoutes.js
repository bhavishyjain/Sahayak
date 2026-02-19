const express = require("express");
const router = express.Router();
const { isAuthenticated, isHoD } = require("../middlewares/authMiddleware");
const { getComplaintsByDepartment, assignWorker, updateComplaintStatus } = require("../controllers/hodController");

// Only HoD access
// router.use(isAuthenticated, isHoD);

router.get("/department/:department", getComplaintsByDepartment);
router.post("/assign", assignWorker);
router.post("/update-status", updateComplaintStatus);

module.exports = router;
