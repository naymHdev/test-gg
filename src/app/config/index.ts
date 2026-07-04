import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join((process.cwd(), ".env")) });

const aws = {
  region: process.env.AWS_REGION,
  accessKeyId: process.env.S3_BUCKET_ACCESS_KEY,
  secretAccessKey: process.env.S3_BUCKET_SECRET_ACCESS_KEY,
  bucket: process.env.AWS_BUCKET_NAME,
};

const jwt = {
  access_secret: process.env.JWT_ACCESS_SECRET,
  refresh_secret: process.env.JWT_REFRESH_SECRET,
  access_expires_in: process.env.JWT_ACCESS_EXPIRES_IN,
  refresh_expires_in: process.env.JWT_REFRESH_EXPIRES_IN,
  bcrypt_slot_rounds: process.env.BCRYPT_SALT_ROUNDS,
};

const redis = {
  url: process.env.REDIS_URL || "redis://localhost:6379",
  otp_ttl_seconds: Number(process.env.OTP_TTL_SECONDS) || 600, // 10 min
  reset_token_ttl_seconds: Number(process.env.RESET_TOKEN_TTL_SECONDS) || 1800, // 30 min
  presence_ttl_seconds: Number(process.env.PRESENCE_TTL_SECONDS) || 30,
};

const admin = {
  admin_email: process.env.ADMIN_EMAIL,
  admin_password: process.env.ADMIN_PASSWORD,
  phone_number: process.env.ADMIN_PHONE_NUMBER,
};

const nodemailer = {
  from: process.env.NODEMAILER_FROM,
  host: process.env.NODEMAILER_HOST,
  port: process.env.NODEMAILER_PORT,
  secure: process.env.NODEMAILER_SECURE,
  auth: {
    user: process.env.NODEMAILER_USER,
    pass: process.env.NODEMAILER_PASS,
  },
};

const stripe = {
  stripe_api_key: process.env.STRIPE_API_KEY,
  stripe_secret_key: process.env.STRIPE_SECRET_KEY,
  stripe_webhook_secret: process.env.STRIPE_WEBHOOK_SECRET,
  subscription_webhook_secret: process.env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET,
};

const rateLimits = {
  login_per_min: 5,
  otp_attempts: 5,
  otp_lockout_minutes: 15,
  posts_per_hour: 3,
  reports_per_hour: 5,
  messages_per_min: 30,
  presign_per_hour: 10,
};

export default {
  node_env: process.env.NODE_ENV,

  port: process.env.PORT,
  socket_port: process.env.SOCKET_PORT,

  ip: process.env.IP,
  database_url: process.env.DATABASE_URL,
  server_url: process.env.SERVER_URL,
  client_url: process.env.CLIENT_URL,

  bad_words_api_key: process.env.BAD_WORDS_API_KEY,

  jwt,
  redis,
  aws,
  admin,
  nodemailer,
  stripe,
  rateLimits,
};
