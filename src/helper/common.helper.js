import jwt from "jsonwebtoken";
import config from "../config/config.js";

const createToken = (payload) => {
  return jwt.sign(payload, config.SECRET_KEY, {
    expiresIn: config.JWT_TTL || "1d",
  });
};

const parseStringArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === "string");
  }

  if (typeof value !== "string") return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item) => typeof item === "string")
      : [];
  } catch {
    return [];
  }
};

export { createToken, parseStringArray };
