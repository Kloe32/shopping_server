import express from "express";
import {
  cancelOrder,
  createOrder,
  deleteOrder,
  getAllOrders,
  getMyOrders,
  getOrderById,
  getOrderSummary,
  updateOrder,
  updateOrderStatus,
  updatePaymentInfo,
} from "../controllers/order.controller.js";
import { optionalVerifyToken, verifyToken } from "../middleware/authJWT.js";

const router = express.Router();

router.post("/create", optionalVerifyToken, createOrder);
router.get("/get-all", verifyToken, getAllOrders);
router.get("/summary", verifyToken, getOrderSummary);
router.get("/my-orders", verifyToken, getMyOrders);
router.get("/:id", verifyToken, getOrderById);
router.put("/update/:id", verifyToken, updateOrder);
router.patch("/update-status/:id", verifyToken, updateOrderStatus);
router.patch("/payment/:id", verifyToken, updatePaymentInfo);
router.patch("/cancel/:id", verifyToken, cancelOrder);
router.delete("/delete/:id", verifyToken, deleteOrder);

export default router;
