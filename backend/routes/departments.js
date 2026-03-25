const express = require("express");
const { attachAuth, requireAuth } = require("../middlewares/jwtAuth");
const authorize = require("../middlewares/authorize");
const {
  listDepartments,
  createDepartment,
  updateDepartment,
  deactivateDepartment,
  reactivateDepartment,
  deleteDepartment,
  inviteDepartmentMember,
  listDepartmentInvitations,
  revokeDepartmentInvitation,
} = require("../controllers/admin/departmentsController");

const router = express.Router();

router.use(attachAuth, requireAuth);

router.get("/", listDepartments);
router.post("/", authorize("admin"), createDepartment);
router.put("/:id", authorize("admin"), updateDepartment);
router.post("/:id/deactivate", authorize("admin"), deactivateDepartment);
router.post("/:id/reactivate", authorize("admin"), reactivateDepartment);
router.get("/:id/invitations", authorize("admin"), listDepartmentInvitations);
router.post("/:id/invitations", authorize("admin"), inviteDepartmentMember);
router.delete(
  "/:id/invitations/:invitationId",
  authorize("admin"),
  revokeDepartmentInvitation,
);
router.delete("/:id", authorize("admin"), deleteDepartment);

module.exports = router;
