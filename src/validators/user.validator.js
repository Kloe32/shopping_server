import { body } from "express-validator";

const registerValidator = [
  body("firstName")
    .notEmpty()
    .withMessage("FirstName is required")
    .isLength({ min: 2 })
    .withMessage("Name must be at least 2 characters"),

  body("lastName")
    .notEmpty()
    .withMessage("Last Name is required")
    .isLength({ min: 2 })
    .withMessage("Name must be at least 2 characters"),

  body("email")
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Must be a valid email")
    .normalizeEmail(),

  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters")
    .trim(),
];

const loginValidator = [
  body("email").isEmail().withMessage("Valid email required").normalizeEmail(),
  body("password").notEmpty().withMessage("Password is required"),
];

export { registerValidator, loginValidator };
