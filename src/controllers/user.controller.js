import { createToken } from "../helper/common.helper.js";
import {
  encryption,
  comparison,
  generateTempToken,
} from "../helper/encryptDecrypt.js";
import userModel from "../models/user.model.js";
import { sendEmail, emailVerificationContent } from "../helper/mail.js";
import crypto from "crypto";
import config from "../config/config.js";
import { uploadFile } from "../config/supabase.js";
import { getCache, setCache, clearCache } from "../config/redisClient.js";

const registerUser = async (req, res) => {
  try {
    const existingUser = await userModel.findOne({ email: req.body.email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already in use." });
    }
    const { firstName, lastName, phone } = req.body;
    const profile = { firstName, lastName, phone };
    const userData = {
      ...req.body,
      profile,
    };
    const response = await userModel.create(userData);
    const { email, role } = response;
    const token = createToken({ email, role });
    const { unHashedToken, hashedToken, tokenExpiry } = generateTempToken();

    response.emailVerificationToken = hashedToken;
    response.emailVerificationExpiry = tokenExpiry;
    await response.save({ validateBeforeSave: false });
    await sendEmail({
      email: response?.email,
      subject: "Please Verify Your Email.",
      mailContent: emailVerificationContent(
        `${profile.firstName} ${profile.lastName}`,
        `${req.protocol}://${req.get("host")}/api/v1/user/verify-email/${unHashedToken}`,
      ),
    });
    const createdUser = await userModel
      .findById(response._id)
      .select("-password -emailVerificationToken -emailVerificationExpiry");
    if (!createdUser) {
      throw new ApiError(500, "Something went wrong while registering user.");
    }
    res.status(200).json({
      message: "Registered Successfully",
      data: createdUser,
      token: token,
      success: true,
    });
  } catch (error) {
    res.status(500).json(error);
  }
};

const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) {
      return res.redirect(
        `${config.FRONTEND_URL}/verify-email?status=error&message=Token missing!`,
      );
      // res.status(400).json({ message: "Token missing" })
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await userModel.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpiry: { $gt: Date.now() },
    });

    if (!user) {
      return res.redirect(
        `${config.FRONTEND_URL}/verify-email?status=error&message=Token invalid or expired`,
      );
    }

    user.emailVerificationToken = undefined;
    user.emailVerificationExpiry = undefined;
    user.isEmailVerified = true;
    await user.save({ validateBeforeSave: false });

    res.redirect(
      `${config.FRONTEND_URL}/verify-email?status=success&message=Email verified successfully`,
    );
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const cachedData = await getCache(config.REDIS_USER_KEY);
    if (cachedData) {
      const jsonData = JSON.parse(cachedData);
      return res.status(200).json({
        success: true,
        message: `Total ${jsonData.length} users fetched!`,
        data: jsonData,
      });
    }
    const users = await userModel.find({});
    await setCache(config.REDIS_USER_KEY, users);
    res.status(200).json({
      success: true,
      message: `fetched ${users.length} user successfully`,
      data: users,
    });
  } catch (error) {
    res.status(500).json(error);
  }
};

const getAllAdmin = async (req, res) => {
  try {
    clearCache(config.REDIS_ADMIN_KEY);
    const cachedData = await getCache(config.REDIS_ADMIN_KEY);
    if (cachedData) {
      const jsonData = JSON.parse(cachedData);
      return res.status(200).json({
        success: true,
        message: `Total ${jsonData.length} admins fetched!`,
        data: jsonData,
      });
    }
    const users = await userModel.find().populate("role");
    const admins = users.filter(
      (u) =>
        u.role.name.toLowerCase() === "admin" ||
        u.role.name.toLowerCase() === "guest" ||
        u.role.name.toLowerCase() === "sale manager",
    );
    await setCache(config.REDIS_ADMIN_KEY, admins);
    res.status(200).json({
      success: true,
      message: `${admins.length} Admins Fetched Successfully`,
      data: admins,
    });
  } catch (error) {
    console.log("GetAll Admin Error:", error);
    res.status(500).json(error);
  }
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const foundUser = await userModel.findOne({ email: email });

    if (!foundUser) {
      return res.status(404).json({ message: "User Do Not Exist." });
    }
    if (!comparison(password, foundUser.password)) {
      return res.status(403).json({ message: "Wrong Password." });
    }
    const response = await userModel
      .findById(foundUser._id)
      .select("-password")
      .populate("role");
    return res.status(200).json({
      data: response,
      token: createToken({
        name: foundUser.name,
        email: foundUser.email,
        role: foundUser.role,
      }),
      message: "Login Successful!",
      success: true,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json(error);
  }
};

const updateUser = async (req, res) => {
  try {
    const updates = { ...req.body };
    if (typeof updates.password === "string" && updates.password.trim()) {
      updates.password = encryption(updates.password);
    } else {
      delete updates.password;
    }

    if (req.file) {
      const imageUrl = await uploadFile(req.file, config.PROFILE_BUCKET);
      if (imageUrl) {
        updates.imageUrl = imageUrl;
      }
    }
    clearCache(config.REDIS_USER_KEY);
    clearCache(config.REDIS_ADMIN_KEY);
    const updatedUser = await userModel
      .findByIdAndUpdate(req.params.id, updates, {
        new: true,
        runValidators: true,
      })
      .select("-password")
      .populate("role");
    res
      .status(200)
      .json({ message: "Updated", data: updatedUser, success: true });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error", success: false });
  }
};

const deleteUser = async (req, res) => {
  try {
    const id = req.params.id;
    // console.log(id)
    const deletedUser = await userModel.findByIdAndDelete(id);
    if (!deletedUser) {
      return res.status(400).json({ error: "User Deletion failed." });
    }
    clearCache(config.REDIS_USER_KEY);
    return res
      .status(200)
      .json({ message: "user successfully deleted.", success: true });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export {
  registerUser,
  loginUser,
  updateUser,
  deleteUser,
  getAllUsers,
  getAllAdmin,
  verifyEmail,
};
