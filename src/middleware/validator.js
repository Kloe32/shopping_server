import { validationResult } from "express-validator";

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array(), // returns array of { field, message, value }
    });
  }
  next(); // no errors, proceed to controller
};

export default validate;
