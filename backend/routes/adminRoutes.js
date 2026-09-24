const express = require("express");
const authenticateToken = require("../middleware/authenticateToken");
const adminController = require("../controllers/adminController");

const router = express.Router();
router.use(authenticateToken, authenticateToken.requireRole("admin"));

// Statistics
router.get("/stats", adminController.getStats);

// Products Administration
router.get("/products", adminController.getAdminProducts);
router.patch("/products/:productId/pause", adminController.pauseProduct);
router.patch("/products/:productId/unpause", adminController.unpauseProduct);
router.delete("/products/:productId", adminController.deleteProductSafely);

// Sellers Administration
router.get("/sellers/pending", adminController.getPendingSellers);
router.get("/sellers", adminController.getSellers);
router.patch("/sellers/:sellerId/approve", adminController.approveSeller);
router.patch("/sellers/:sellerId/reject", adminController.rejectSeller);
router.patch("/sellers/:sellerId/suspend", adminController.suspendSeller);
router.patch("/sellers/:sellerId/reactivate", adminController.reactivateSeller);
router.delete("/sellers/:sellerId", adminController.deleteSellerSafely);

// Deliverymen Administration
router.get("/deliverymen", adminController.getDeliverymen);
router.patch("/deliverymen/:deliverymanId/approve", adminController.approveDeliveryman);
router.patch("/deliverymen/:deliverymanId/reject", adminController.rejectDeliveryman);
router.patch("/deliverymen/:deliverymanId/suspend", adminController.suspendDeliveryman);
router.patch("/deliverymen/:deliverymanId/reactivate", adminController.reactivateDeliveryman);
router.delete("/deliverymen/:deliverymanId", adminController.deleteDeliverymanSafely);

module.exports = router;
