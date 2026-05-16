import mongoose from "mongoose";
import config from "../config/config.js";
import orderModel from "../models/order.model.js";
import productModel from "../models/product.model.js";
import productVariantModel from "../models/productVariant.model.js";
import userModel from "../models/user.model.js";

const ORDER_STATUSES = ["PENDING", "PAID", "SHIPPED", "DELIVERED", "CANCELLED"];
const PAYMENT_STATUSES = ["PENDING", "PAID", "FAILED", "REFUNDED"];
const STATUS_TRANSITIONS = {
  PENDING: ["PAID", "CANCELLED"],
  PAID: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
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

const isAdminRequest = (req) => req.role === "ADMIN";

const getAuthUser = async (req) => {
  if (!req.email) return null;
  return userModel.findOne({ email: req.email }).select("_id email role");
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

const calculateOrderTotal = ({ subtotal, shippingCost }) => {
  const tax = calculateTax(subtotal);
  return {
    tax,
    total: roundMoney(subtotal + tax + shippingCost),
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

    orderItems.push({
      product: product._id,
      variant: variant?._id,
      name: `${product.name}${formatVariantName(variant)}`,
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
  if (query.status) filter.status = String(query.status).toUpperCase();
  if (query.paymentStatus)
    filter["paymentInfo.status"] = String(query.paymentStatus).toUpperCase();
  if (query.user && mongoose.isValidObjectId(query.user)) {
    filter.user = new mongoose.Types.ObjectId(query.user);
  }
  if (query.orderNumber)
    filter.orderNumber = { $regex: query.orderNumber, $options: "i" };

  if (query.fromDate || query.toDate) {
    filter.createdAt = {};
    if (query.fromDate) filter.createdAt.$gte = new Date(query.fromDate);
    if (query.toDate) filter.createdAt.$lte = new Date(query.toDate);
  }

  return filter;
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
    const { tax, total } = calculateOrderTotal({ subtotal, shippingCost });
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
      const createdOrder = await orderModel.create({
        user,
        orderNumber: await generateOrderNumber(),
        status: paymentStatus === "PAID" ? "PAID" : "PENDING",
        items: orderItems,
        shippingAddress: req.body.shippingAddress,
        paymentInfo: {
          method: req.body.paymentInfo?.method,
          transactionId: req.body.paymentInfo?.transactionId,
          status: paymentStatus,
        },
        subtotal,
        tax,
        shippingCost,
        total,
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

    const filter = { ...buildOrderFilter(req.query), user: authUser._id };
    const orders = await populateOrder(
      orderModel.find(filter).sort({ createdAt: -1 }),
    );

    return res.status(200).json({
      success: true,
      message: `Total ${orders.length} orders fetched!`,
      data: orders,
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

    const allowedUpdates = {};
    if (req.body.shippingAddress)
      allowedUpdates.shippingAddress = req.body.shippingAddress;
    if (req.body.shippingCost !== undefined) {
      allowedUpdates.shippingCost = toMoneyNumber(req.body.shippingCost);
    }

    const order = await orderModel.findById(req.params.id);
    if (!order) {
      return res
        .status(404)
        .json({ message: "Order not found.", success: false });
    }
    if (["SHIPPED", "DELIVERED", "CANCELLED"].includes(order.status)) {
      return res.status(400).json({
        message: "Only pending or paid orders can be updated.",
        success: false,
      });
    }

    const nextShippingCost = allowedUpdates.shippingCost ?? order.shippingCost;
    const { tax, total } = calculateOrderTotal({
      subtotal: order.subtotal,
      shippingCost: nextShippingCost,
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
    }

    order.status = status;
    if (status === "PAID") order.paymentInfo.status = "PAID";
    if (status === "CANCELLED" && order.paymentInfo.status === "PAID") {
      order.paymentInfo.status = "REFUNDED";
    }
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

    const paymentStatus = req.body.status
      ? String(req.body.status).toUpperCase()
      : undefined;
    if (paymentStatus && !PAYMENT_STATUSES.includes(paymentStatus)) {
      return res.status(400).json({
        message: `Invalid payment status. Must be one of: ${PAYMENT_STATUSES.join(", ")}.`,
        success: false,
      });
    }

    const order = await orderModel.findById(req.params.id);
    if (!order) {
      return res
        .status(404)
        .json({ message: "Order not found.", success: false });
    }

    if (req.body.method !== undefined)
      order.paymentInfo.method = req.body.method;
    if (req.body.transactionId !== undefined) {
      order.paymentInfo.transactionId = req.body.transactionId;
    }
    if (paymentStatus) order.paymentInfo.status = paymentStatus;
    if (paymentStatus === "PAID" && order.status === "PENDING") {
      order.status = "PAID";
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

    if (!["PENDING", "PAID"].includes(order.status)) {
      return res.status(400).json({
        message: "Only pending or paid orders can be cancelled.",
        success: false,
      });
    }

    await restoreOrderInventory(order);
    order.status = "CANCELLED";
    if (order.paymentInfo.status === "PAID")
      order.paymentInfo.status = "REFUNDED";
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
    if (order.status !== "CANCELLED") {
      return res.status(400).json({
        message: "Only cancelled orders can be deleted.",
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

    return res.status(200).json({
      success: true,
      message: "Order summary fetched successfully.",
      data: {
        totalOrders: summary?.totalOrders || 0,
        revenue: roundMoney(summary?.revenue || 0),
        averageOrderValue: roundMoney(summary?.averageOrderValue || 0),
        statusCounts: statusCounts.reduce((acc, item) => {
          acc[item._id] = item.count;
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

export {
  createOrder,
  getAllOrders,
  getMyOrders,
  getOrderById,
  updateOrder,
  updateOrderStatus,
  updatePaymentInfo,
  cancelOrder,
  deleteOrder,
  getOrderSummary,
};
