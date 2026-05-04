import jwt from "jsonwebtoken";
import config from "../config/config.js";

const createToken = (payload) => {
  return jwt.sign(payload, config.SECRET_KEY, {
    expiresIn: config.JWT_TTL || "1d",
  });
};

export { createToken };
