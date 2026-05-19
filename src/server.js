import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import session from "express-session";
import passport from "passport";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import { connectDB } from "./config/db.js";
import envValidation from "./config/envValidation.js";
import "./config/passport.js";
import authRoutes from "./modules/auth/routes/authRoutes.js";
import digitalTwinRoutes from "./routes/digitalTwinRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import leadRoutes from "./routes/leadRoutes.js";
import billingRoutes from "./modules/billing/billing.routes.js";
import billingIntegrationRoutes from "./modules/billing/billing.integration.routes.js";
import { errorHandler } from "./middleware/errorMiddleware.js";

dotenv.config();

// ✅ Validate environment variables before starting
envValidation();

// ✅ Connect to database
connectDB();

const app = express();

// ✅ For ES modules (__dirname replacement)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Security Middleware
// Helmet helps secure Express apps by setting various HTTP headers
app.use(helmet());

// ✅ Body Parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cookieParser());

// ✅ Rate Limiting
// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

// Auth endpoints rate limiter (stricter)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 login attempts per windowMs
  skipSuccessfulRequests: true, // don't count successful requests
  message: 'Too many failed login attempts, please try again later.'
});

// ✅ CORS Configuration
const allowedOrigins = [
  process.env.CLIENT_URL,
  "https://digitaltwin.techtrekkers.ai",
].filter(Boolean);

const isLocalFrontend = (origin) =>
  /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || isLocalFrontend(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked origin: ${origin}`));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    maxAge: 86400 // 24 hours
  })
);

// ✅ Static file serving
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

// ✅ Session Setup (kept for backward compatibility with Passport)
app.use(
  session({
    secret: process.env.SESSION_SECRET || process.env.JWT_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  })
);

app.use(passport.initialize());
app.use(passport.session());

// ✅ Health check
app.get("/", (req, res) => {
  res.json({
    status: 'ok',
    message: '🚀 Digital Twin Backend Running',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// ✅ Routes
// Apply general rate limiter to API routes
app.use("/api/", apiLimiter);

// Auth routes with stricter rate limiting
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/signup", authLimiter);
app.use("/api/auth", authRoutes);

// Other API routes
app.use("/api/digital-twin", digitalTwinRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/leads", leadRoutes);

// Billing (centralized TTT Payment Service integration).
// Public routes (frontend-facing): /api/billing/{plans,status,create-order,...}
// Internal routes (TTT callbacks): /api/billing/internal/{activate-plan,payment-failed}
// Both routers share the same /api/billing prefix; the internal routes
// authenticate via the shared x-internal-api-key header inside the handler.
app.use("/api/billing", billingRoutes);
app.use("/api/billing", billingIntegrationRoutes);

// ✅ 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.path}`
  });
});

// ✅ Global Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`✅ Server running on http://localhost:${PORT}`)
);
