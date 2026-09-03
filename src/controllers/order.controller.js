import mongoose from "mongoose";
import config from "../config/config.js";
import {
  constructWebhookEvent,
  createPaymentIntent,
  stripe,
} from "../config/stripe.js";
import orderModel from "../models/order.model.js";
import productModel from "../models/product.model.js";
import productVariantModel from "../models/productVariant.model.js";
import userModel from "../models/user.model.js";

const ORDER_STATUSES = [
  "PENDING",
  "PROCESSING",
  "PAID",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
];

const PAYMENT_STATUSES = ["PENDING", "PAID", "FAILED", "REFUNDED"];

const STATUS_TRANSITIONS = {
  PENDING: ["PROCESSING", "PAID", "CANCELLED"],
  PROCESSING: ["PAID", "SHIPPED", "CANCELLED"],
  PAID: ["PROCESSING", "SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

const populateOrder = (query) =>
  query
    .populate("user", "email profile phone role")
    .populate("items.product", "name slug images basePrice stock status")
    .populate(
      "items.variant",
      "sku attributes priceAdjustment inventoryCount images",
    );

const isAdminRequest = (req) =>
  req.role === "ADMIN" ||
  req.role === "admin" ||
  Boolean(req.admin_role);

const getAuthUser = async (req) => {
  if (!req.email) return null;
  return userModel.findOne({ email: req.email }).select("_id email role admin_role");
};

const toMoneyNumber = (value, fallback = 0) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= 0
    ? numberValue
    : fallback;
};

const roundMoney = (value) =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const getTaxRate = () => {
  const taxRate = Number(config.ORDER_TAX_RATE);
  if (!Number.isFinite(taxRate) || taxRate < 0) return 0;
  return taxRate > 1 ? taxRate / 100 : taxRate;
};

const calculateTax = (subtotal) => roundMoney(subtotal * getTaxRate());

const calculateOrderTotal = ({ subtotal, shippingCost = 0, discount = 0 }) => {
  const discountedSubtotal = Math.max(subtotal - discount, 0);
  const tax = calculateTax(discountedSubtotal);
  return {
    tax,
    total: roundMoney(discountedSubtotal + tax + shippingCost),
  };
};

const generateOrderNumber = async () => {
  for (let index = 0; index < 5; index += 1) {
    const randomPart = Math.floor(100000 + Math.random() * 900000);
    const orderNumber = `ORD-${Date.now()}-${randomPart}`;
    const existingOrder = await orderModel.exists({ orderNumber });
    if (!existingOrder) return orderNumber;
  }

  throw new Error("Unable to generate order number.");
};

const formatVariantName = (variant) => {
  if (!variant?.attributes) return "";
  const attributes =
    variant.attributes instanceof Map
      ? Object.fromEntries(variant.attributes)
      : variant.attributes;
  const label = Object.entries(attributes)
    .map(([key, value]) => `${key}: ${value}`)
    .join(", ");

  return label ? ` (${label})` : "";
};

const buildOrderItems = async (items = []) => {
  if (!Array.isArray(items) || items.length === 0) {
    return { error: "Order items are required." };
  }

  const orderItems = [];

  for (const item of items) {
    const quantity = Number(item.quantity);
    if (!mongoose.isValidObjectId(item.product)) {
      return { error: "Invalid product id in order items." };
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      return { error: "Each order item must have quantity greater than 0." };
    }

    const product = await productModel.findOne({
      _id: item.product,
      isDeleted: false,
      status: "ACTIVE",
    });
    if (!product) {
      return { error: "One or more products are unavailable." };
    }
    if (product.stock < quantity) {
      return { error: `${product.name} does not have enough stock.` };
    }

    let variant = null;
    if (item.variant) {
      if (!mongoose.isValidObjectId(item.variant)) {
        return { error: "Invalid variant id in order items." };
      }

      variant = await productVariantModel.findOne({
        _id: item.variant,
        product: product._id,
      });
      if (!variant) {
        return { error: `${product.name} variant was not found.` };
      }
      if (variant.inventoryCount < quantity) {
        return {
          error: `${product.name}${formatVariantName(variant)} does not have enough inventory.`,
        };
      }
    }

    const discountedPrice =
      product.basePrice -
      (product.basePrice * (product.discountPercentage || 0)) / 100;
    const unitPrice = roundMoney(
      discountedPrice + (variant?.priceAdjustment || 0),
    );

    const image =
      (variant?.images && variant.images[0]) ||
      (product.images && product.images[0]) ||
      "";

    orderItems.push({
      product: product._id,
      variant: variant?._id || null,
      name: `${product.name}${formatVariantName(variant)}`,
      sku: variant?.sku || "",
      image,
      price: Math.max(unitPrice, 0),
      quantity,
    });
  }

  return { orderItems };
};

const decrementInventory = async (items) => {
  const rollbackItems = [];

  try {
    for (const item of items) {
      const productUpdate = await productModel.updateOne(
        { _id: item.product, stock: { $gte: item.quantity }, isDeleted: false },
        { $inc: { stock: -item.quantity } },
      );
      if (productUpdate.modifiedCount !== 1) {
        throw new Error(`${item.name} does not have enough stock.`);
      }
      rollbackItems.push({
        type: "product",
        id: item.product,
        quantity: item.quantity,
      });

      if (item.variant) {
        const variantUpdate = await productVariantModel.updateOne(
          {
            _id: item.variant,
            product: item.product,
            inventoryCount: { $gte: item.quantity },
          },
          { $inc: { inventoryCount: -item.quantity } },
        );
        if (variantUpdate.modifiedCount !== 1) {
          throw new Error(`${item.name} does not have enough inventory.`);
        }
        rollbackItems.push({
          type: "variant",
          id: item.variant,
          quantity: item.quantity,
        });
      }
    }
  } catch (error) {
    await restoreInventory(rollbackItems);
    throw error;
  }
};

const restoreInventory = async (items = []) => {
  for (const item of items) {
    if (item.type === "product") {
      await productModel.updateOne(
        { _id: item.id },
        { $inc: { stock: item.quantity } },
      );
    }
    if (item.type === "variant") {
      await productVariantModel.updateOne(
        { _id: item.id },
        { $inc: { inventoryCount: item.quantity } },
      );
    }
  }
};

const restoreOrderInventory = async (order) => {
  const inventoryItems = [];
  for (const item of order.items) {
    inventoryItems.push({
      type: "product",
      id: item.product,
      quantity: item.quantity,
    });
    if (item.variant) {
      inventoryItems.push({
        type: "variant",
        id: item.variant,
        quantity: item.quantity,
      });
    }
  }
  await restoreInventory(inventoryItems);
};

const buildOrderFilter = (query = {}) => {
  const filter = {};
  if (query.status) {
    filter.status = String(query.status).toUpperCase();
  }
  if (query.paymentStatus) {
    filter["paymentInfo.status"] = String(query.paymentStatus).toUpperCase();
  }
  if (query.user && mongoose.isValidObjectId(query.user)) {
    filter.user = new mongoose.Types.ObjectId(query.user);
  }
  if (query.orderNumber) {
    filter.orderNumber = { $regex: query.orderNumber.trim(), $options: "i" };
  }
  if (query.search) {
    const searchRegex = { $regex: query.search.trim(), $options: "i" };
    filter.$or = [
      { orderNumber: searchRegex },
      { "shippingAddress.fullName": searchRegex },
      { "shippingAddress.phone": searchRegex },
      { "shippingAddress.city": searchRegex },
      { "paymentInfo.transactionId": searchRegex },
    ];
  }

  if (query.fromDate || query.toDate) {
    filter.createdAt = {};
    if (query.fromDate) filter.createdAt.$gte = new Date(query.fromDate);
    if (query.toDate) filter.createdAt.$lte = new Date(query.toDate);
  }

  return filter;
};

const previewOrder = async (req, res) => {
  try {
    const { error, orderItems } = await buildOrderItems(req.body.items);
    if (error) {
      return res.status(400).json({ message: error, success: false });
    }

    const subtotal = roundMoney(
      orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
    );
    const shippingCost =
      req.body.shippingCost !== undefined
        ? toMoneyNumber(req.body.shippingCost)
        : subtotal >= 50
          ? 0
          : 5.0;
    const discount = toMoneyNumber(req.body.discount);
    const { tax, total } = calculateOrderTotal({
      subtotal,
      shippingCost,
      discount,
    });

    return res.status(200).json({
      success: true,
      message: "Order price review calculated successfully.",
      data: {
        items: orderItems,
        subtotal,
        discount,
        tax,
        shippingCost,
        total,
      },
    });
  } catch (error) {
    console.log("Preview Order Error:", error);
    return res
      .status(500)
      .json({ message: "Internal Server Error", success: false });
  }
};

const createOrder = async (req, res) => {
  let orderItems = [];
  try {
    const { error, orderItems: preparedItems } = await buildOrderItems(
      req.body.items,
    );
    if (error) {
      return res.status(400).json({ message: error, success: false });
    }
    orderItems = preparedItems;

    const authUser = await getAuthUser(req);
    let user = authUser?._id || null;
    if (isAdminRequest(req) && req.body.user) {
      user = req.body.user;
    }
    if (!authUser && req.body.user) {
      return res.status(401).json({
        message: "Login is required to attach an order to a user account.",
        success: false,
      });
    }
    if (user && !mongoose.isValidObjectId(user)) {
      return res
        .status(400)
        .json({ message: "Invalid user id.", success: false });
    }
    if (user) {
      const existingUser = await userModel.exists({
        _id: user,
        isDeleted: false,
      });
      if (!existingUser) {
        return res
          .status(404)
          .json({ message: "User not found.", success: false });
      }
    }

    const subtotal = roundMoney(
      orderItems.reduce((total, item) => total + item.price * item.quantity, 0),
    ); 
    const shippingCost = toMoneyNumber(req.body.shippingCost);
    const discount = toMoneyNumber(req.body.discount);
    const { tax, total } = calculateOrderTotal({
      subtotal,
      shippingCost,
      discount,
    });

    const paymentStatus = req.body.paymentInfo?.status
      ? String(req.body.paymentInfo.status).toUpperCase()
      : "PENDING";
    if (!PAYMENT_STATUSES.includes(paymentStatus)) {
      return res.status(400).json({
        message: `Invalid payment status. Must be one of: ${PAYMENT_STATUSES.join(", ")}.`,
        success: false,
      });
    }

    await decrementInventory(orderItems);

    try {
      const initialStatus =
        paymentStatus === "PAID" ? "PAID" : "PENDING";

      const createdOrder = await orderModel.create({
        user,
        orderNumber: await generateOrderNumber(),
        status: initialStatus,
        items: orderItems,
        shippingAddress: req.body.shippingAddress || {},
        billingAddress: req.body.billingAddress || req.body.shippingAddress || {},
        paymentInfo: {
          method: req.body.paymentInfo?.method || "ONLINE_PAYMENT",
          transactionId: req.body.paymentInfo?.transactionId || "",
          status: paymentStatus,
          paidAt: paymentStatus === "PAID" ? new Date() : null,
          receiptUrl: req.body.paymentInfo?.receiptUrl || "",
        },
        subtotal,
        discount,
        tax,
        shippingCost,
        total,
        customerNote: req.body.customerNote || "",
        notes: req.body.notes || "",
      });

      const response = await populateOrder(
        orderModel.findById(createdOrder._id),
      );
      return res.status(201).json({
        message: "Order created successfully.",
        data: response,
        success: true,
      });
    } catch (error) {
      await restoreOrderInventory({ items: orderItems });
      throw error;
    }
  } catch (error) {
    console.log("Create Order Error:", error);
    return res.status(500).json({
      message: error.message || "Internal Server Error",
      success: false,
    });
  }
};

const getAllOrders = async (req, res) => {
  try {
    if (!isAdminRequest(req)) {
      return res
        .status(403)
        .json({ message: "Admin access required.", success: false });
    }

    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;
    const filter = buildOrderFilter(req.query);

    const [orders, totalOrders] = await Promise.all([
      populateOrder(
        orderModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      ),
      orderModel.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: `Total ${orders.length} orders fetched!`,
      data: orders,
      pagination: {
        page,
        limit,
        totalOrders,
        totalPages: Math.ceil(totalOrders / limit),
      },
    });
  } catch (error) {
    console.log("Get All Orders Error:", error);
    return res
      .status(500)
      .json({ message: "Internal Server Error", success: false });
  }
};

const getMyOrders = async (req, res) => {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) {
      return res
        .status(401)
        .json({ message: "User not found.", success: false });
    }

    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;
    const filter = { ...buildOrderFilter(req.query), user: authUser._id };

    const [orders, totalOrders] = await Promise.all([
      populateOrder(
        orderModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      ),
      orderModel.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: `Total ${orders.length} orders fetched!`,
      data: orders,
      pagination: {
        page,
        limit,
        totalOrders,
        totalPages: Math.ceil(totalOrders / limit),
      },
    });
  } catch (error) {
    console.log("Get My Orders Error:", error);
    return res
      .status(500)
      .json({ message: "Internal Server Error", success: false });
  }
};

const getOrderById = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res
        .status(400)
        .json({ message: "Invalid order id.", success: false });
    }

    const order = await populateOrder(orderModel.findById(req.params.id));
    if (!order) {
      return res
        .status(404)
        .json({ message: "Order not found.", success: false });
    }

    if (!isAdminRequest(req)) {
      const authUser = await getAuthUser(req);
      if (!authUser || String(order.user?._id) !== String(authUser._id)) {
        return res
          .status(403)
          .json({ message: "You cannot access this order.", success: false });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Order fetched successfully.",
      data: order,
    });
  } catch (error) {
    console.log("Get Order Error:", error);
    return res
      .status(500)
      .json({ message: "Internal Server Error", success: false });
  }
};

const updateOrder = async (req, res) => {
  try {
    if (!isAdminRequest(req)) {
      return res
        .status(403)
        .json({ message: "Admin access required.", success: false });
    }
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res
        .status(400)
        .json({ message: "Invalid order id.", success: false });
    }

    const order = await orderModel.findById(req.params.id);
    if (!order) {
      return res
        .status(404)
        .json({ message: "Order not found.", success: false });
    }
    if (["DELIVERED", "CANCELLED"].includes(order.status)) {
      return res.status(400).json({
        message: "Delivered or cancelled orders cannot be updated.",
        success: false,
      });
    }

    const allowedUpdates = {};
    if (req.body.shippingAddress) {
      allowedUpdates.shippingAddress = {
        ...order.shippingAddress?.toObject(),
        ...req.body.shippingAddress,
      };
    }
    if (req.body.billingAddress) {
      allowedUpdates.billingAddress = {
        ...order.billingAddress?.toObject(),
        ...req.body.billingAddress,
      };
    }
    if (req.body.shippingCost !== undefined) {
      allowedUpdates.shippingCost = toMoneyNumber(req.body.shippingCost);
    }
    if (req.body.discount !== undefined) {
      allowedUpdates.discount = toMoneyNumber(req.body.discount);
    }
    if (req.body.carrier !== undefined) {
      allowedUpdates.carrier = req.body.carrier;
    }
    if (req.body.trackingNumber !== undefined) {
      allowedUpdates.trackingNumber = req.body.trackingNumber;
    }
    if (req.body.customerNote !== undefined) {
      allowedUpdates.customerNote = req.body.customerNote;
    }
    if (req.body.notes !== undefined) {
      allowedUpdates.notes = req.body.notes;
    }

    const nextShippingCost =
      allowedUpdates.shippingCost ?? order.shippingCost;
    const nextDiscount = allowedUpdates.discount ?? order.discount;
    const { tax, total } = calculateOrderTotal({
      subtotal: order.subtotal,
      shippingCost: nextShippingCost,
      discount: nextDiscount,
    });
    allowedUpdates.tax = tax;
    allowedUpdates.total = total;

    const updatedOrder = await populateOrder(
      orderModel.findByIdAndUpdate(req.params.id, allowedUpdates, {
        new: true,
        runValidators: true,
      }),
    );

    return res.status(200).json({
      message: "Order updated successfully.",
      data: updatedOrder,
      success: true,
    });
  } catch (error) {
    console.log("Update Order Error:", error);
    return res
      .status(500)
      .json({ message: "Internal Server Error", success: false });
  }
};

const updateShippingAddress = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res
        .status(400)
        .json({ message: "Invalid order id.", success: false });
    }

    const order = await orderModel.findById(req.params.id);
    if (!order) {
      return res
        .status(404)
        .json({ message: "Order not found.", success: false });
    }

    if (!isAdminRequest(req)) {
      const authUser = await getAuthUser(req);
      if (!authUser || String(order.user) !== String(authUser._id)) {
        return res
          .status(403)
          .json({ message: "You cannot modify this order.", success: false });
      }
    }

    if (["SHIPPED", "DELIVERED", "CANCELLED"].includes(order.status)) {
      return res.status(400).json({
        message: "Shipping address cannot be updated after order is shipped or completed.",
        success: false,
      });
    }

    const newAddress = {
      ...order.shippingAddress?.toObject(),
      ...req.body,
    };

    order.shippingAddress = newAddress;
    await order.save();

    const updatedOrder = await populateOrder(orderModel.findById(order._id));
    return res.status(200).json({
      message: "Shipping address updated successfully.",
      data: updatedOrder,
      success: true,
    });
  } catch (error) {
    console.log("Update Shipping Address Error:", error);
    return res
      .status(500)
      .json({ message: "Internal Server Error", success: false });
  }
};

const recalculateOrderTotals = async (req, res) => {
  try {
    if (!isAdminRequest(req)) {
      return res
        .status(403)
        .json({ message: "Admin access required.", success: false });
    }
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res
        .status(400)
        .json({ message: "Invalid order id.", success: false });
    }

    const order = await orderModel.findById(req.params.id);
    if (!order) {
      return res
        .status(404)
        .json({ message: "Order not found.", success: false });
    }

    const subtotal = roundMoney(
      order.items.reduce(
        (total, item) => total + item.price * item.quantity,
        0,
      ),
    );
    const shippingCost = toMoneyNumber(order.shippingCost);
    const discount = toMoneyNumber(order.discount);
    const { tax, total } = calculateOrderTotal({
      subtotal,
      shippingCost,
      discount,
    });

    const updatedOrder = await populateOrder(
      orderModel.findByIdAndUpdate(
        req.params.id,
        { subtotal, discount, tax, total },
        { new: true, runValidators: true },
      ),
    );

    return res.status(200).json({
      message: "Order totals recalculated successfully.",
      data: updatedOrder,
      success: true,
    });
  } catch (error) {
    console.log("Recalculate Order Totals Error:", error);
    return res
      .status(500)
      .json({ message: "Internal Server Error", success: false });
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    if (!isAdminRequest(req)) {
      return res
        .status(403)
        .json({ message: "Admin access required.", success: false });
    }
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res
        .status(400)
        .json({ message: "Invalid order id.", success: false });
    }

    const status = String(req.body.status || "").toUpperCase();
    if (!ORDER_STATUSES.includes(status)) {
      return res.status(400).json({
        message: `Invalid status. Must be one of: ${ORDER_STATUSES.join(", ")}.`,
        success: false,
      });
    }

    const order = await orderModel.findById(req.params.id);
    if (!order) {
      return res
        .status(404)
        .json({ message: "Order not found.", success: false });
    }

    const allowedNextStatuses = STATUS_TRANSITIONS[order.status] || [];
    if (!allowedNextStatuses.includes(status) && !req.body.force) {
      return res.status(400).json({
        message: `Cannot change order status from ${order.status} to ${status}.`,
        success: false,
      });
    }

    if (status === "CANCELLED" && order.status !== "CANCELLED") {
      await restoreOrderInventory(order);
      order.cancelledAt = new Date();
      if (req.body.cancelReason) {
        order.cancelReason = req.body.cancelReason;
      }
      if (order.paymentInfo.status === "PAID") {
        order.paymentInfo.status = "REFUNDED";
      }
    }

    if (status === "SHIPPED" && !order.shippedAt) {
      order.shippedAt = new Date();
      if (req.body.trackingNumber) order.trackingNumber = req.body.trackingNumber;
      if (req.body.carrier) order.carrier = req.body.carrier;
    }

    if (status === "DELIVERED" && !order.deliveredAt) {
      order.deliveredAt = new Date();
    }

    if (status === "PAID") {
      order.paymentInfo.status = "PAID";
      if (!order.paymentInfo.paidAt) {
        order.paymentInfo.paidAt = new Date();
      }
    }

    order.status = status;
    await order.save();

    const updatedOrder = await populateOrder(orderModel.findById(order._id));
    return res.status(200).json({
      message: "Order status updated successfully.",
      data: updatedOrder,
      success: true,
    });
  } catch (error) {
    console.log("Update Order Status Error:", error);
    return res
      .status(500)
      .json({ message: "Internal Server Error", success: false });
  }
};

const updatePaymentInfo = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res
        .status(400)
        .json({ message: "Invalid order id.", success: false });
    }

    const order = await orderModel.findById(req.params.id);
    if (!order) {
      return res
        .status(404)
        .json({ message: "Order not found.", success: false });
    }

    if (!isAdminRequest(req)) {
      const authUser = await getAuthUser(req);
      if (!authUser || String(order.user) !== String(authUser._id)) {
        return res
          .status(403)
          .json({ message: "You cannot access this order.", success: false });
      }
    }

    const paymentStatus = req.body.status
      ? String(req.body.status).toUpperCase()
      : undefined;
    if (paymentStatus && !PAYMENT_STATUSES.includes(paymentStatus)) {
      return res.status(400).json({
        message: `Invalid payment status. Must be one of: ${PAYMENT_STATUSES.join(", ")}.`,
        success: false,
      });
    }

    if (req.body.method !== undefined) {
      order.paymentInfo.method = req.body.method;
    }
    if (req.body.transactionId !== undefined) {
      order.paymentInfo.transactionId = req.body.transactionId;
    }
    if (req.body.receiptUrl !== undefined) {
      order.paymentInfo.receiptUrl = req.body.receiptUrl;
    }

    if (paymentStatus) {
      order.paymentInfo.status = paymentStatus;
      if (paymentStatus === "PAID") {
        order.paymentInfo.paidAt = new Date();
        if (order.status === "PENDING") {
          order.status = "PAID";
        }
      } else if (paymentStatus === "REFUNDED") {
        if (order.status !== "CANCELLED") {
          await restoreOrderInventory(order);
          order.status = "CANCELLED";
          order.cancelledAt = new Date();
        }
      }
    }

    await order.save();

    const updatedOrder = await populateOrder(orderModel.findById(order._id));
    return res.status(200).json({
      message: "Payment info updated successfully.",
      data: updatedOrder,
      success: true,
    });
  } catch (error) {
    console.log("Update Payment Info Error:", error);
    return res
      .status(500)
      .json({ message: "Internal Server Error", success: false });
  }
};

const cancelOrder = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res
        .status(400)
        .json({ message: "Invalid order id.", success: false });
    }

    const order = await orderModel.findById(req.params.id);
    if (!order) {
      return res
        .status(404)
        .json({ message: "Order not found.", success: false });
    }

    if (!isAdminRequest(req)) {
      const authUser = await getAuthUser(req);
      if (!authUser || String(order.user) !== String(authUser._id)) {
        return res
          .status(403)
          .json({ message: "You cannot cancel this order.", success: false });
      }
    }

    if (["SHIPPED", "DELIVERED", "CANCELLED"].includes(order.status)) {
      return res.status(400).json({
        message: `Order in ${order.status} state cannot be cancelled.`,
        success: false,
      });
    }

    await restoreOrderInventory(order);
    order.status = "CANCELLED";
    order.cancelledAt = new Date();
    if (req.body.cancelReason) {
      order.cancelReason = req.body.cancelReason;
    }
    if (order.paymentInfo.status === "PAID") {
      order.paymentInfo.status = "REFUNDED";
    }
    await order.save();

    const updatedOrder = await populateOrder(orderModel.findById(order._id));
    return res.status(200).json({
      message: "Order cancelled successfully.",
      data: updatedOrder,
      success: true,
    });
  } catch (error) {
    console.log("Cancel Order Error:", error);
    return res
      .status(500)
      .json({ message: "Internal Server Error", success: false });
  }
};

const deleteOrder = async (req, res) => {
  try {
    if (!isAdminRequest(req)) {
      return res
        .status(403)
        .json({ message: "Admin access required.", success: false });
    }
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res
        .status(400)
        .json({ message: "Invalid order id.", success: false });
    }

    const order = await orderModel.findById(req.params.id);
    if (!order) {
      return res
        .status(404)
        .json({ message: "Order not found.", success: false });
    }
    if (order.status !== "CANCELLED" && !req.body.force) {
      return res.status(400).json({
        message: "Only cancelled orders can be deleted. Use force=true if required.",
        success: false,
      });
    }

    await orderModel.findByIdAndDelete(req.params.id);
    return res.status(200).json({
      message: "Order deleted successfully.",
      success: true,
    });
  } catch (error) {
    console.log("Delete Order Error:", error);
    return res
      .status(500)
      .json({ message: "Internal Server Error", success: false });
  }
};

const getOrderSummary = async (req, res) => {
  try {
    if (!isAdminRequest(req)) {
      return res
        .status(403)
        .json({ message: "Admin access required.", success: false });
    }

    const filter = buildOrderFilter(req.query);
    const [summary] = await orderModel.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          revenue: {
            $sum: {
              $cond: [{ $ne: ["$status", "CANCELLED"] }, "$total", 0],
            },
          },
          averageOrderValue: { $avg: "$total" },
        },
      },
    ]);
    const statusCounts = await orderModel.aggregate([
      { $match: filter },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    const paymentStatusCounts = await orderModel.aggregate([
      { $match: filter },
      { $group: { _id: "$paymentInfo.status", count: { $sum: 1 } } },
    ]);

    return res.status(200).json({
      success: true,
      message: "Order summary fetched successfully.",
      data: {
        totalOrders: summary?.totalOrders || 0,
        revenue: roundMoney(summary?.revenue || 0),
        averageOrderValue: roundMoney(summary?.averageOrderValue || 0),
        statusCounts: statusCounts.reduce((acc, item) => {
          if (item._id) acc[item._id] = item.count;
          return acc;
        }, {}),
        paymentStatusCounts: paymentStatusCounts.reduce((acc, item) => {
          if (item._id) acc[item._id] = item.count;
          return acc;
        }, {}),
      },
    });
  } catch (error) {
    console.log("Get Order Summary Error:", error);
    return res
      .status(500)
      .json({ message: "Internal Server Error", success: false });
  }
};

const createStripePaymentIntentHandler = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res
        .status(400)
        .json({ message: "Invalid order id.", success: false });
    }

    const order = await orderModel.findById(req.params.id);
    if (!order) {
      return res
        .status(404)
        .json({ message: "Order not found.", success: false });
    }

    if (!isAdminRequest(req)) {
      const authUser = await getAuthUser(req);
      if (!authUser || String(order.user) !== String(authUser._id)) {
        return res
          .status(403)
          .json({ message: "You cannot access this order.", success: false });
      }
    }

    if (order.status === "CANCELLED" || order.status === "DELIVERED") {
      return res.status(400).json({
        message: `Cannot process payment for ${order.status} order.`,
        success: false,
      });
    }

    if (order.paymentInfo?.status === "PAID") {
      return res.status(400).json({
        message: "Order is already paid.",
        success: false,
      });
    }

    const authUser = await getAuthUser(req);
    const paymentIntent = await createPaymentIntent({
      amount: order.total,
      currency: config.STRIPE_CURRENCY,
      orderId: order._id,
      orderNumber: order.orderNumber,
      customerEmail: order.shippingAddress?.email || authUser?.email,
    });

    order.paymentInfo.transactionId = paymentIntent.id;
    order.paymentInfo.method = "STRIPE";
    await order.save();

    return res.status(200).json({
      success: true,
      message: "Stripe PaymentIntent created successfully.",
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: order.total,
        currency: paymentIntent.currency,
        orderId: order._id,
        orderNumber: order.orderNumber,
      },
    });
  } catch (error) {
    console.log("Create Stripe Payment Intent Error:", error);
    return res.status(500).json({
      message: error.message || "Failed to create payment intent.",
      success: false,
    });
  }
};

const handleStripeWebhook = async (req, res) => {
  const signature = req.headers["stripe-signature"];

  let event;
  try {
    if (config.STRIPE_WEBHOOK_SECRET) {
      event = constructWebhookEvent(req.rawBody || req.body, signature);
    } else {
      // Fallback in dev if webhook secret is not yet set
      event = req.body;
    }
  } catch (error) {
    console.log("Stripe Webhook Signature Verification Error:", error.message);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  console.log(`[Stripe Webhook] Received verified event: ${event.type}`);

  try {
    switch (event.type) {
      case "payment_intent.succeeded":
      case "charge.succeeded": {
        const dataObj = event.data.object;
        const orderId = dataObj.metadata?.orderId;
        const orderNumber = dataObj.metadata?.orderNumber;
        const transactionId = dataObj.id || dataObj.payment_intent;

        let order = null;
        if (orderId && mongoose.isValidObjectId(orderId)) {
          order = await orderModel.findById(orderId);
        }
        if (!order && orderNumber) {
          order = await orderModel.findOne({ orderNumber });
        }
        if (!order && transactionId) {
          order = await orderModel.findOne({
            "paymentInfo.transactionId": transactionId,
          });
        }

        if (order) {
          order.paymentInfo.status = "PAID";
          if (transactionId) {
            order.paymentInfo.transactionId = transactionId;
          }
          order.paymentInfo.paidAt = new Date();
          order.paymentInfo.method = "STRIPE";

          const receiptUrl =
            dataObj.receipt_url ||
            dataObj.charges?.data?.[0]?.receipt_url ||
            dataObj.latest_charge?.receipt_url ||
            order.paymentInfo.receiptUrl;
          if (receiptUrl) {
            order.paymentInfo.receiptUrl = receiptUrl;
          }

          if (order.status === "PENDING") {
            order.status = "PAID";
          }

          await order.save();
          console.log(`[Stripe Webhook] Order ${order.orderNumber} successfully marked as PAID!`);
        } else {
          console.log(
            `[Stripe Webhook] ${event.type} received for ${transactionId}, but no matching order found in database.`,
          );
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const dataObj = event.data.object;
        const orderId = dataObj.metadata?.orderId;
        const transactionId = dataObj.id;

        let order = null;
        if (orderId && mongoose.isValidObjectId(orderId)) {
          order = await orderModel.findById(orderId);
        }
        if (!order && transactionId) {
          order = await orderModel.findOne({
            "paymentInfo.transactionId": transactionId,
          });
        }

        if (order) {
          order.paymentInfo.status = "FAILED";
          await order.save();
          console.log(`[Stripe Webhook] Order ${order.orderNumber} payment failed.`);
        }
        break;
      }

      default:
        console.log(`[Stripe Webhook] Handled unmonitored event type: ${event.type}`);
        break;
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.log("Stripe Webhook Processing Error:", error);
    return res.status(500).json({ error: "Webhook handler failed." });
  }
};

export {
  previewOrder,
  createOrder,
  getAllOrders,
  getMyOrders,
  getOrderById,
  updateOrder,
  updateShippingAddress,
  recalculateOrderTotals,
  updateOrderStatus,
  updatePaymentInfo,
  createStripePaymentIntentHandler,
  handleStripeWebhook,
  cancelOrder,
  deleteOrder,
  getOrderSummary,
};


