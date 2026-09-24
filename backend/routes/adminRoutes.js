const express = require("express");
const authenticateToken = require("../middleware/authenticateToken");
const adminController = require("../controllers/adminController");

const router = express.Router();
router.use(authenticateToken, authenticateToken.requireRole("admin"));
router.get("/sellers/pending", adminController.getPendingSellers);
router.get("/sellers", adminController.getSellers);
router.patch("/sellers/:sellerId/approve", adminController.approveSeller);
router.patch("/sellers/:sellerId/reject", adminController.rejectSeller);
router.get("/deliverymen", adminController.getDeliverymen);
router.patch("/deliverymen/:deliverymanId/approve", adminController.approveDeliveryman);
router.patch("/deliverymen/:deliverymanId/reject", adminController.rejectDeliveryman);
module.exports = router;
