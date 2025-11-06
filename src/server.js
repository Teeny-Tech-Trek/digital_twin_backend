import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import session from "express-session";
import passport from "passport";
import { connectDB } from "./config/db.js";
import "./config/passport.js";
import authRoutes from "./routes/authRoutes.js";
import digitalTwinRoutes from './routes/digitalTwinRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import leadRoutes from "./routes/leadRoutes.js";
import { errorHandler } from "./middleware/errorMiddleware.js";

dotenv.config();
connectDB();

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: "https://digitaltwin.techtrekkers.ai", // allow this origin
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true
}))

// Passport + session setup
app.use(
  session({
    secret: "keyboard cat",
    resave: false,
    saveUninitialized: false,
  })
);
app.use(passport.initialize());
app.use(passport.session());

// Routes


// Health check
app.get("/", (req, res) => res.send("🚀 Digital Twin Backend Running"));

app.use("/api/auth", authRoutes);
app.use('/api/digital-twin', digitalTwinRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/leads", leadRoutes);

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`✅ Server running on http://localhost:${PORT}`)
);
