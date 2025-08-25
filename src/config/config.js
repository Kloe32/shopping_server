require("dotenv").config()

const config = {
    PORT : process.env.PORT || 8080,
    MONGODB_URL: process.env.MONGODB_URL,
    SECRET_KEY: process.env.SECRET_KEY,
    SALT : process.env.SALT
}

module.exports = config