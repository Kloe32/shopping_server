require("dotenv").config()

const config = {
    PORT : process.env.PORT || 8080,
    MONGODB_URL: process.env.MONGODB_URL,
    SECRET_KEY: process.env.SECRET_KEY,
    SALT : process.env.SALT,
    MAIL_SMTP_USER: process.env.MAIL_SMTP_USER,
    MAIL_SMTP_PASS: process.env.MAIL_SMTP_PASS,
    FRONTEND_URL:process.env.FRONTEND_URL,
    SUPABASE_SERVICE_ROLE:process.env.SUPABASE_SERVICE_ROLE,
    PROJECT_URL:process.env.PROJECT_URL,
    REDIS_USERNAME:process.env.REDIS_USERNAME,
    REDIS_PASSWORD:process.env.REDIS_PASSWORD,
    REDIS_HOST:process.env.REDIS_HOST,
    REDIS_PORT:process.env.REDIS_PORT,
    REDIS_USER_KEY:process.env.REDIS_USER_KEY,
    REDIS_UNIT_KEY:process.env.REDIS_UNIT_KEY,
    REDIS_ADMIN_KEY:process.env.REDIS_ADMIN_KEY,
    REDIS_TTL:process.env.REDIS_TTL,
    EXCHANGE_RATE_URL: process.env.EXCHANGE_RATE_URL,
    EXCHANGE_RATE_API_KEY: process.env.EXCHANGE_RATE_API_KEY,
    JWT_TTL:process.env.JWT_TTL,
    PROFILE_BUCKET:process.env.PROFILE_BUCKET,
    PRODUCT_IMAGE_BUCKET:process.env.PRODUCT_IMAGE_BUCKET,
}

module.exports = config