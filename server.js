import express from "express";
const app = express();
import mongoose from "mongoose";
import config from "./src/config/config.js";
const port = config.PORT;
import cors from "cors";
const mongodb_url = config.MONGODB_URL;
import userRoute from "./src/routes/user.route.js";
import categoryRoute from "./src/routes/category.route.js";
// import unitRoute from "./src/routes/unit.route.js";
import productRoute from "./src/routes/product.route.js";
import orderRoute from "./src/routes/order.route.js";
// import roleRoute from "./src/routes/role.route.js";
import { connectRedis, setCache, getCache } from "./src/config/redisClient.js";

import { handleStripeWebhook } from "./src/controllers/order.controller.js";

// Stripe webhook requires raw body buffer for signature verification
app.post(
  "/api/v1/order/webhook",
  express.raw({ type: "application/json" }),
  handleStripeWebhook,
);
app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  handleStripeWebhook,
);

app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(
  cors(
    "http://localhost:4000",
    "https://shopping-server-nerj.onrender.com",
    "https://shopping-admin-nh09pidsp-sai-saing-wans-projects.vercel.app/",
  ),
);
app.listen(port, () => {
  console.log(`Server is listening at http://localhost:${port}`);
});
app.get("/", (req, res) => {
  res.send("API Start working");
});

app.use("/api/v1/user", userRoute);
app.use("/api/v1/category", categoryRoute);
app.use("/api/v1/product", productRoute);
app.use("/api/v1/order", orderRoute);

mongoose
  .connect(mongodb_url)
  .then(() => {
    console.log("Mongo DB is connected");
    connectRedis()
      .then(() => {
        console.log("Redis Connected Successfully");
      })
      .catch((error) => {
        console.log("Error connecting Redis:", error);
      });
  })
  .catch((error) => console.log("error connecting db:", error));
