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
// Helmet helps secure Express apps by setting various HTTP headers.
//
// We override the default Cross-Origin-Resource-Policy ('same-origin') to
// 'cross-origin' because the FE (e.g. https://nettwin.techtrekkers.ai) and
// API (https://api.nettwin.techtrekkers.ai) are on different origins, and
// the FE embeds user-uploaded images served from `/uploads` via <img>.
// With the default CORP, Chrome blocks those <img> requests with
// ERR_BLOCKED_BY_RESPONSE.NotSameOrigin even though CORS is configured —
// CORP is a separate browser policy that applies to no-cors subresource
// loads like images. 'cross-origin' is the correct policy for public
// avatar files that are explicitly meant to be embedded elsewhere.
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// ✅ Body Parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cookieParser());

// ✅ Rate Limiting
// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  skip: (req) =>
    req.path.startsWith("/api/digital-twin/jobs/") ||
    req.path === "/api/digital-twin/ingestion-status" ||
    req.path === "/api/digital-twin/internal/ingest-complete" ||
    req.path === "/api/digital-twin/internal/ingestion-complete",
});

// Auth endpoints rate limiter (stricter)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 login attempts per windowMs
  skipSuccessfulRequests: true, // don't count successful requests
  message: 'Too many failed login attempts, please try again later.'
});

// ✅ CORS Configuration
//
// Three categories of allowed origin:
//   1. Hardcoded production hosts (NetTwin's known domains).
//   2. process.env.CLIENT_URL — the primary frontend URL for this env.
//   3. process.env.ADDITIONAL_ALLOWED_ORIGINS — comma-separated escape hatch
//      for ad-hoc URLs (preview deploys, partner integrations, etc.) without
//      a code change. Whitespace around commas is trimmed.
//   4. Any localhost:<port> origin (covers Vite/CRA dev servers).
const hardcodedOrigins = [
  "https://nettwin-test.vercel.app",       // Vercel preview / staging
  "https://nettwin.techtrekkers.ai",       // production frontend
  "https://digitaltwin.techtrekkers.ai",   // legacy production frontend
];

const extraOrigins = (process.env.ADDITIONAL_ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const allowedOrigins = [
  process.env.CLIENT_URL,
  ...hardcodedOrigins,
  ...extraOrigins,
].filter(Boolean);

const isLocalFrontend = (origin) =>
  /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);

// Some browsers send Origin with a trailing slash on a few embed scenarios.
// Normalize both sides before comparing so a stray "/" doesn't reject a
// legitimate request.
const normalizeOrigin = (origin) =>
  typeof origin === "string" ? origin.replace(/\/$/, "") : origin;
const normalizedAllowed = new Set(allowedOrigins.map(normalizeOrigin));

app.use(
  cors({
    origin: (origin, callback) => {
      const normalized = normalizeOrigin(origin);
      if (
        !origin ||
        normalizedAllowed.has(normalized) ||
        isLocalFrontend(origin)
      ) {
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
//
// /uploads holds profile pictures embedded as <img src> on the FE origin.
// Belt-and-braces with the global helmet override above: we explicitly stamp
// `Cross-Origin-Resource-Policy: cross-origin` on every static response and
// allow GET/HEAD from any origin. Adding `Access-Control-Allow-Origin: *`
// here covers the case where the asset is fetched via `fetch()` (e.g. for
// generating a downloadable QR / vCard) — `*` is safe because these files
// are public and there's no cookie context.
app.use(
  "/uploads",
  (req, res, next) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    next();
  },
  express.static(path.join(__dirname, "..", "uploads"), {
    // Short cache so a replaced avatar surfaces quickly. The FE also
    // appends `?v=<timestamp>` after an upload, which already guarantees
    // a fresh fetch — this is just the secondary guard.
    maxAge: "1h",
    fallthrough: true,
  })
);

// ✅ Session Setup (kept for backward compatibility with Passport)
app.use(
  session({
    secret: process.env.SESSION_SECRET || process.env.JWT_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      // 'lax' instead of 'strict' so the session cookie survives top-level
      // returns from OAuth/email flows. Passport session is still only used
      // for backward compatibility — JWT is the real auth — but mismatched
      // SameSite between session and refreshToken cookies caused subtle
      // logout-on-back-button bugs in prod.
      sameSite: 'lax',
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
