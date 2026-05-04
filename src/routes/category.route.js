import express from "express";
const router = express.Router();
import { upload } from "../config/supabase.js";
import {
  getAllCategory,
  createCategory,
  deleteCategory,
  updateCategory,
  getCategorybyName,
  updateCategoryByName,
} from "../controllers/category.controller.js";
import { verifyToken } from "../middleware/authJWT.js";

// router.get("/", getAllCategory);
router.post("/add", upload.single("file"), createCategory);
// router.delete("/:id", verifyToken, deleteCategory);
// router.put("/:id", updateCategory);
// router.get("/name", getCategorybyName);
// router.put("/name/:name", verifyToken, updateCategoryByName);

export default router;
