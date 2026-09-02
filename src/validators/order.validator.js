import { body, param, query } from "express-validator";

const createOrderValidator = [
  body("items")
    .isArray({ min: 1 })
    .withMessage("Order must contain at least one item."),
  body("items.*.product")
    .notEmpty()
    .withMessage("Product id is required for each item.")
    .isMongoId()
    .withMessage("Invalid product id in order items."),
  body("items.*.variant")
    .optional({ nullable: true })
    .isMongoId()
    .withMessage("Invalid variant id in order items."),
  body("items.*.quantity")
    .isInt({ min: 1 })
    .withMessage("Item quantity must be a positive integer."),
  body("shippingAddress.fullName")
    .optional({ checkFalsy: true })
    .isString()
    .trim()
    .isLength({ min: 2 })
    .withMessage("Recipient name must be at least 2 characters."),
  body("shippingAddress.phone")
    .optional({ checkFalsy: true })
    .isString()
    .trim()
    .withMessage("Valid phone number is required."),
  body("shippingAddress.street")
    .optional({ checkFalsy: true })
    .isString()
    .trim()
    .withMessage("Street address is required."),
  body("shippingAddress.city")
    .optional({ checkFalsy: true })
    .isString()
    .trim()
    .withMessage("City is required."),
  body("shippingAddress.country")
    .optional({ checkFalsy: true })
    .isString()
    .trim()
    .withMessage("Country is required."),
  body("paymentInfo.method")
    .optional({ checkFalsy: true })
    .isString()
    .trim()
    .withMessage("Payment method must be a valid string."),
  body("paymentInfo.status")
    .optional({ checkFalsy: true })
    .isIn(["PENDING", "PAID", "FAILED", "REFUNDED"])
    .withMessage("Invalid payment status."),
  body("shippingCost")
    .optional({ checkFalsy: true })
    .isFloat({ min: 0 })
    .withMessage("Shipping cost must be a non-negative number."),
  body("discount")
    .optional({ checkFalsy: true })
    .isFloat({ min: 0 })
    .withMessage("Discount must be a non-negative number."),
];

const updateShippingAddressValidator = [
  param("id").isMongoId().withMessage("Invalid order id."),
  body("fullName")
    .optional({ checkFalsy: true })
    .isString()
    .trim()
    .isLength({ min: 2 })
    .withMessage("Recipient full name must be at least 2 characters."),
  body("phone")
    .optional({ checkFalsy: true })
    .isString()
    .trim(),
  body("street")
    .optional({ checkFalsy: true })
    .isString()
    .trim(),
  body("city")
    .optional({ checkFalsy: true })
    .isString()
    .trim(),
  body("country")
    .optional({ checkFalsy: true })
    .isString()
    .trim(),
];

const updateOrderStatusValidator = [
  param("id").isMongoId().withMessage("Invalid order id."),
  body("status")
    .notEmpty()
    .withMessage("Order status is required.")
    .isIn([
      "PENDING",
      "PROCESSING",
      "PAID",
      "SHIPPED",
      "DELIVERED",
      "CANCELLED",
    ])
    .withMessage("Invalid order status value."),
];

const updatePaymentInfoValidator = [
  param("id").isMongoId().withMessage("Invalid order id."),
  body("status")
    .optional({ checkFalsy: true })
    .isIn(["PENDING", "PAID", "FAILED", "REFUNDED"])
    .withMessage("Invalid payment status."),
  body("method")
    .optional({ checkFalsy: true })
    .isString()
    .trim(),
  body("transactionId")
    .optional({ checkFalsy: true })
    .isString()
    .trim(),
  body("receiptUrl")
    .optional({ checkFalsy: true })
    .isString()
    .trim(),
];

const cancelOrderValidator = [
  param("id").isMongoId().withMessage("Invalid order id."),
  body("cancelReason")
    .optional({ checkFalsy: true })
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Cancellation reason must not exceed 500 characters."),
];

const orderIdParamValidator = [
  param("id").isMongoId().withMessage("Invalid order id."),
];

export {
  createOrderValidator,
  updateShippingAddressValidator,
  updateOrderStatusValidator,
  updatePaymentInfoValidator,
  cancelOrderValidator,
  orderIdParamValidator,
};
