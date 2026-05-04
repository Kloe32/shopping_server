import express from "express";
const router = express.Router();
import {
  registerUser,
  loginUser,
  updateUser,
  deleteUser,
  getAllUsers,
  verifyEmail,
  getAllAdmin,
} from "../controllers/user.controller.js";
import { verifyToken } from "../middleware/authJWT.js";
import { upload } from "../config/supabase.js";
import validator from "../middleware/validator.js";

router.post("/create", validator, registerUser);

// router.get('/',getAllUsers)
// router.get('/admin',getAllAdmin)
// router.post('/CreateUser',registerUser)
// router.post('/LoginUser',loginUser)
// router.put('/UpdateUser/:id',upload.single("file"),updateUser)
// router.delete('/DeleteUser/:id',deleteUser)
// router.get('/verify-email/:token',verifyEmail)
export default router;
