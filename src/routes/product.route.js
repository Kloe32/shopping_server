import express from "express";
const router = express.Router();
import {
  getAllProducts,
  createProduct,
  deleteProduct,
  updateProduct,
} from "../controllers/product.controller.js";
import { verifyToken } from "../middleware/authJWT.js";
import { upload } from "../config/supabase.js";

router.get("/", getAllProducts);
router.post("/add", upload.array("files"), createProduct);
router.delete("/:id", verifyToken, deleteProduct);
router.put("/:id", verifyToken, updateProduct);

export default router;
