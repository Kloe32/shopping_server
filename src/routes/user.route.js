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
import validate from "../middleware/validator.js";
import {
  registerValidator,
  loginValidator,
} from "../validators/user.validator.js";

router.post("/create", registerValidator, validate, registerUser);

// router.get('/',getAllUsers)
router.get("/get-admins", getAllAdmin);
// router.post('/CreateUser',registerUser)
router.post("/login", loginValidator, validate, loginUser);
// router.put('/UpdateUser/:id',upload.single("file"),updateUser)
// router.delete('/DeleteUser/:id',deleteUser)
// router.get('/verify-email/:token',verifyEmail)
export default router;
