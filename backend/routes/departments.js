const express = require("express");
const { attachAuth, requireAuth } = require("../middlewares/jwtAuth");
const authorize = require("../middlewares/authorize");
const {
  listDepartments,
  createDepartment,
  updateDepartment,
  deactivateDepartment,
  deleteDepartment,
} = require("../controllers/admin/departmentsController");

const router = express.Router();

router.use(attachAuth, requireAuth);

router.get("/", listDepartments);
router.post("/", authorize("admin"), createDepartment);
router.put("/:id", authorize("admin"), updateDepartment);
router.post("/:id/deactivate", authorize("admin"), deactivateDepartment);
router.delete("/:id", authorize("admin"), deleteDepartment);

module.exports = router;
