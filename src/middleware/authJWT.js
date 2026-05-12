import jwt from "jsonwebtoken";
import config from "../config/config.js";

const verifyToken = (req, res, next) => {
  const token = req.headers["x-access-token"];
  if (!token) {
    return res.status(403).send({ message: "Token not provided!" });
  }

  jwt.verify(token, config.SECRET_KEY, async (err, decoded) => {
    if (err) {
      console.log(err);
      return res
        .status(401)
        .send({ message: "Unauthorized Token", success: false });
    }
    req.name = decoded.name;
    req.email = decoded.email;
    req.role = decoded.role;
    next();
  });
};

const optionalVerifyToken = (req, res, next) => {
  const token = req.headers["x-access-token"];
  if (!token) return next();

  jwt.verify(token, config.SECRET_KEY, async (err, decoded) => {
    if (err) {
      console.log(err);
      return res
        .status(401)
        .send({ message: "Unauthorized Token", success: false });
    }
    req.name = decoded.name;
    req.email = decoded.email;
    req.role = decoded.role;
    next();
  });
};

export { verifyToken, optionalVerifyToken };
