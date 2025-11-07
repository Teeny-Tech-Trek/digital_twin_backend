import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import session from "express-session";
import passport from "passport";
import path from "path";
import { fileURLToPath } from "url";
import { connectDB } from "./config/db.js";
import "./config/passport.js";
import authRoutes from "./routes/authRoutes.js";
import digitalTwinRoutes from "./routes/digitalTwinRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import leadRoutes from "./routes/leadRoutes.js";
import { errorHandler } from "./middleware/errorMiddleware.js";

dotenv.config();
connectDB();

const app = express();

// ✅ For ES modules (__dirname replacement)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());
app.use(cookieParser());

// ✅ CORS
app.use(
  cors({
    origin: "https://digitaltwin.techtrekkers.ai", // your frontend port
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    credentials: true,
  })
);

// ✅ Serve static uploads (⭐ ADD THIS ⭐)
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

// ✅ Passport + session setup
app.use(
  session({
    secret: "keyboard cat",
    resave: false,
    saveUninitialized: false,
  })
);
app.use(passport.initialize());
app.use(passport.session());

// ✅ Health check
app.get("/", (req, res) => res.send("🚀 Digital Twin Backend Running"));

// ✅ Routes
app.use("/api/auth", authRoutes);
app.use("/api/digital-twin", digitalTwinRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/leads", leadRoutes);

// ✅ Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`✅ Server running on http://localhost:${PORT}`)
);
