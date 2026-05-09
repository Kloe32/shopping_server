import express from "express";
const router = express.Router();
import {
  getAllProducts,
  createProduct,
  deleteProduct,
  updateProduct,
  updateProductStatus,
} from "../controllers/product.controller.js";
import { verifyToken } from "../middleware/authJWT.js";
import { upload } from "../config/supabase.js";

router.get("/get-all", getAllProducts);
router.post("/add", upload.array("files"), createProduct);
router.delete("/delete/:id", deleteProduct);
router.put("/update/:id", upload.array("files"), updateProduct);
router.patch("/update-status/:id", updateProductStatus);

export default router;
