import express from "express";
import {
  cancelOrder,
  createOrder,
  createStripePaymentIntentHandler,
  deleteOrder,
  getAllOrders,
  getMyOrders,
  getOrderById,
  getOrderSummary,
  handleStripeWebhook,
  previewOrder,
  recalculateOrderTotals,
  updateOrder,
  updateOrderStatus,
  updatePaymentInfo,
  updateShippingAddress,
} from "../controllers/order.controller.js";
import { verifyToken } from "../middleware/authJWT.js";
import validate from "../middleware/validator.js";
import {
  cancelOrderValidator,
  createOrderValidator,
  orderIdParamValidator,
  updateOrderStatusValidator,
  updatePaymentInfoValidator,
  updateShippingAddressValidator,
} from "../validators/order.validator.js";

const router = express.Router();

router.post("/preview", verifyToken, createOrderValidator, validate, previewOrder);
router.post("/create", verifyToken, createOrderValidator, validate, createOrder);
router.post(
  "/create-payment-intent/:id",
  verifyToken,
  orderIdParamValidator,
  validate,
  createStripePaymentIntentHandler,
);
router.post("/webhook", handleStripeWebhook);
router.get("/get-all", verifyToken, getAllOrders);
router.get("/summary", verifyToken, getOrderSummary);
router.get("/my-orders", verifyToken, getMyOrders);
router.get("/:id", verifyToken, orderIdParamValidator, validate, getOrderById);
router.put("/update/:id", verifyToken, orderIdParamValidator, validate, updateOrder);
router.patch(
  "/shipping-address/:id",
  verifyToken,
  updateShippingAddressValidator,
  validate,
  updateShippingAddress,
);
router.patch("/recalculate/:id", verifyToken, orderIdParamValidator, validate, recalculateOrderTotals);
router.patch(
  "/update-status/:id",
  verifyToken,
  updateOrderStatusValidator,
  validate,
  updateOrderStatus,
);
router.patch(
  "/payment/:id",
  verifyToken,
  updatePaymentInfoValidator,
  validate,
  updatePaymentInfo,
);
router.patch(
  "/cancel/:id",
  verifyToken,
  cancelOrderValidator,
  validate,
  cancelOrder,
);
router.delete("/delete/:id", verifyToken, orderIdParamValidator, validate, deleteOrder);

export default router;

