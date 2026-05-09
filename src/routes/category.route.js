import express from "express";
const router = express.Router();
import { upload } from "../config/supabase.js";
import {
  getAllCategory,
  createCategory,
  deleteCategory,
  updateCategory,
} from "../controllers/category.controller.js";
import { verifyToken } from "../middleware/authJWT.js";

router.get("/get-all", getAllCategory);
router.post("/add", upload.single("file"), createCategory);
router.delete("/delete/:id", deleteCategory);
router.put("/update/:id", upload.single("file"), updateCategory);

export default router;
