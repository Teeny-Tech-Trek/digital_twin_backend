# Code Citations

## License: unknown
https://github.com/iamnishantgarg/Shopee/blob/d9b6055bee263b3444c5b9920a480dce1e577e7f/middleware/authMiddleware.js

```
Now I'll generate a comprehensive architecture audit. Based on my deep analysis of both frontend and backend code, here's the complete assessment:

---

# ARCHITECTURE AUDIT: DIGITAL TWIN PLATFORM
## Production-Grade Pre-Implementation Review

---

## EXECUTIVE SUMMARY

This is a **user-centric SaaS platform** with:
- **Manual authentication** (email/password) + **REST-based Google OAuth**
- **React 18 + TypeScript frontend** with shadcn/ui component library
- **Express.js backend** with MongoDB + Mongoose ORM
- **JWT token-based auth** (7-day expiry) with localStorage persistence
- **Per-user digital twin profiles** with complex nested data structures
- **Lead tracking system** for business intelligence

### Current Auth Status: **FUNCTIONAL BUT INCOMPLETE**
- Manual signup/login flows are implemented
- Google OAuth foundation exists but frontend implementation is commented out
- No refresh token mechanism
- No password reset flow
- No email verification

---

## 1. CURRENT FRONTEND ARCHITECTURE

### Framework & Tooling
```
React 18.3.1 + TypeScript + Vite (module-based)
Build Tool: Vite with React SWC plugin
Styling: Tailwind CSS + shadcn/ui components
State Management: React Context API + TanStack React Query
HTTP Client: Axios with interceptors
Routing: React Router v6.30.2
Animation: Framer Motion + GSAP
```

### Project Structure
```
src/
├── pages/
│   ├── Login.tsx              (Email/password login form)
│   ├── Signup.tsx             (Email/password signup form)
│   ├── Dashboard.tsx          (User dashboard with twins & leads)
│   ├── Chatbot.tsx            (Chat interface for digital twins)
│   ├── Index.tsx              (Digital twin wizard/builder)
│   ├── Landing.tsx            (Marketing landing page)
│   └── LandingPages/          (Landing page variants)
├── components/
│   ├── GoogleOAuth.tsx        (INCOMPLETE - Google auth component)
│   ├── DigitalTwinWizard.tsx (Wizard for creating twins)
│   └── ui/                    (Reusable shadcn/ui components)
├── contexts/
│   ├── AuthContext.tsx        (PARTIALLY COMMENTED OUT)
│   ├── DigitalTwinContext.tsx (Digital twin state management)
│   └── ProtectedRoute.tsx     (Route protection wrapper)
├── services/
│   └── api.service.ts         (Centralized API calls)
├── hooks/
│   ├── use-mobile.tsx
│   └── use-toast.ts
├── lib/
│   └── utils.ts
├── types/
│   └── digitalTwin.ts
└── axios.config.ts            (Axios instance with interceptors)
```

### Authentication Flow (Current)

#### SIGNUP Flow
```
User Input (name, email, password, confirm password)
  ↓
useAuth.signup() via AuthContext
  ↓
POST /api/auth/signup (email, password)
  ↓
Response: { user, token }
  ↓
Store: localStorage['token'] + localStorage['user']
  ↓
Update: AuthContext state
  ↓
Navigate: /wizard (digital twin builder)
```

#### LOGIN Flow
```
User Input (email, password)
  ↓
useAuth.login() via AuthContext
  ↓
POST /api/auth/login (email, password)
  ↓
Response: { user, token }
  ↓
Store: localStorage['token'] + localStorage['user']
  ↓
Update: AuthContext state
  ↓
Navigate: /dashboard
```

#### GOOGLE AUTH Flow (INCOMPLETE/COMMENTED)
```
Frontend attempts to:
1. Load Google API (window.google)
2. Initialize Google OAuth2 with client ID
3. Show One Tap UI or redirect to passport flow
4. Parse JWT credential
5. POST /api/auth/google with parsed data

Backend:
  POST /api/auth/google → createGoogleUser → return token
  OR
  GET /api/auth/google → passport.authenticate()
  → GET /api/auth/google/callback → redirect /dashboard
```

### Token & Session Management

**Token Storage Strategy:**
- Location: `localStorage['token']` (INSECURE - vulnerable to XSS)
- Format: JWT (Bearer token)
- Expiry: 7 days (server-side)
- Refresh: NONE (manual re-login required)

**Session Restoration:**
```typescript
// On app load via AuthContext
useEffect(() => {
  const storedToken = localStorage.getItem('token');
  const storedUser = localStorage.getItem('user');
  
  if (storedToken) {
    setToken(storedToken);
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    } else {
      getProfile(); // Fetch profile if missing
    }
  }
  setIsLoading(false);
}, []);
```

**Axios Interceptor:**
```typescript
// Request: Auto-attach token
interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response: Handle 401 on protected routes
interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !isAuthRequest) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login'; // Hard redirect
    }
    return Promise.reject(error);
  }
);
```

### Protected Routes
```typescript
// ProtectedRoute.tsx
if (isLoading) return <Loader />;
return user ? <>{children}</> : <Navigate to="/login" />;
```

### Current Auth Context (Status: PARTIALLY DISABLED)
- Most methods are commented out
- Fallback to basic fetch-based implementation in some places
- useAuth hook is the primary interface
- No error recovery for network failures

### Onboarding Flow
```
1. User lands on Landing.tsx (marketing site)
2. User clicks "Get Started" → Signup.tsx
3. Fill name, email, password
4. POST /api/auth/signup
5. Auto-logged in
6. Redirect to /wizard (Digital Twin Builder)
7. Fill detailed profile (identity, skills, experience, etc.)
8. POST /api/digital-twin/create
9. Redirect to /dashboard
10. View digital twin, see leads, manage profile
```

### Key Frontend Issues Identified

| Issue | Severity | Impact |
|-------|----------|---------|
| Token stored in localStorage | CRITICAL | XSS vulnerability, no CSRF protection |
| No refresh token mechanism | HIGH | User must re-login after 7 days |
| AuthContext partially commented | HIGH | Code maintainability, unclear intent |
| GoogleOAuth unfinished | HIGH | Google auth non-functional |
| No password reset UI/flow | MEDIUM | Users locked out if forgotten password |
| No email verification | MEDIUM | Spam/invalid emails possible |
| Hard redirect on 401 (losing context) | MEDIUM | Bad UX, state loss |
| No request retry logic | MEDIUM | Network hiccups = failed requests |
| Profile picture upload hardcoded URL | MEDIUM | Breaks with different API endpoints |
| No loading/error states in Dashboard | LOW | May seem frozen during loads |
| Axios base URL env var inconsistent | LOW | Frontend/backend URL mismatch risk |

### Strengths
✅ Modern React + TypeScript foundation
✅ Centralized API service layer (clean separation)
✅ Reusable shadcn/ui components
✅ Protected route abstraction
✅ Axios interceptor pattern
✅ React Query integration for data fetching
✅ Framer Motion for animations
✅ Type-safe with zod validation support

---

## 2. CURRENT BACKEND ARCHITECTURE

### Framework & Technology Stack
```
Node.js + Express.js 5.1.0 (modern version)
Database: MongoDB + Mongoose 8.19.2 (ES modules)
Authentication: Passport.js + JWT
File Upload: Multer
Password Security: bcryptjs
API Docs: None (manual implementation)
Environment: dotenv (but not fully used)
Error Handling: Custom middleware
```

### Project Structure
```
src/
├── server.js                  (Express app setup, middlewares, routes)
├── config/
│   ├── db.js                  (MongoDB connection)
│   └── passport.js            (Google OAuth strategy)
├── models/
│   ├── User.js                (User schema)
│   ├── DigitalTwin.js         (Digital twin schema - complex)
│   ├── Lead.js                (Lead tracking)
│   └── Message.js             (Chat messages - not analyzed)
├── controllers/
│   ├── authController.js      (Signup, login, Google auth)
│   ├── profileController.js   (Profile management, picture upload)
│   ├── digitalTwinController.js (Twin CRUD operations)
│   ├── chatController.js      (Chat operations)
│   └── leadController.js      (Lead CRUD operations)
├── middleware/
│   ├── authMiddleware.js      (JWT token verification)
│   ├── errorMiddleware.js     (Global error handler)
│   └── asyncHandler.js        (Async error wrapper)
├── routes/
│   ├── authRoutes.js          (Auth endpoints)
│   ├── digitalTwinRoutes.js   (Twin endpoints)
│   ├── chatRoutes.js          (Chat endpoints)
│   └── leadRoutes.js          (Lead endpoints)
├── services/
│   ├── authService.js         (Auth business logic)
│   ├── digitalTwinService.js  (Twin business logic)
│   ├── chatService.js         (Chat business logic)
│   └── leadService.js         (Lead business logic)
├── utils/
│   └── generateToken.js       (JWT token generation)
└── uploads/
    └── profile-pictures/      (File storage for profile pics)
```

### User Model (Current Schema)
```javascript
{
  name: String (required),
  email: String (required, unique),
  password: String (optional - for manual auth),
  googleId: String (optional - for Google auth),
  avatar: String (optional - from Google),
  profilePicture: String (optional - uploaded),
  timestamps: true
}
```

**Issues with User Model:**
- ❌ No `provider` field (can't track auth method)
- ❌ No `emailVerified` field (no email verification)
- ❌ No `lastLogin` tracking
- ❌ No `isActive` flag (no soft deletes)
- ❌ No `refreshToken` storage (no refresh mechanism)
- ❌ Both `password` and `googleId` optional (allows creating invalid users)
- ⚠️ `profilePicture` and `avatar` are separate (confusion)

### Digital Twin Model (Current)
```javascript
{
  user: ObjectId (ref: User, required, unique per user),
  identity: {
    name: String,
    role: String,
    tagline: String,
    bio: String
  },
  businesses: [
    {
      name: String,
      role: String,
      description: String,
      link: String,
      products: [String],
      duration: String
    }
  ],
  experience: [
    {
      company: String,
      role: String,
      duration: String,
      key_projects: [String]
    }
  ],
  education: [
    {
      institution: String,
      degree: String,
      year: String
    }
  ],
  skills: {
    list: [String],
    coreDomains: String,
    signatureStrengths: String
  },
  personality: {
    traits: [String],
    leadership_style: String,
    decision_style: String,
    tone: String,
    archetype: String,
    values: [String]
  },
  story: {
    mission: String,
    impact: String,
    themes: [String]
  },
  networking: {
    audience: String,
    intent: String,
    boundaries: [String]
  },
  links: {
    linkedin: String,
    website: String,
    portfolio: String,
    socials: [String]
  },
  isActive: Boolean (default: true),
  lastUpdated: Date,
  timestamps: true,
  indexes: [user, text search on identity]
}
```

✅ Well-designed schema for digital twin profiles
✅ Good separation of concerns (identity, skills, personality, etc.)
✅ Text search indexes for discovery
⚠️ No versioning/history tracking
⚠️ No public/private field separation (all data treated as public on /public/:twinId)

### Authentication Flow (Backend)

#### SIGNUP Flow
```javascript
// POST /api/auth/signup
{
  name, email, password
} 
  ↓
authService.register()
  - Check user exists (findOne)
  - Hash password (bcryptjs)
  - Create user
  - Generate JWT token (7d expiry)
  - Return { user, token }
```

#### LOGIN Flow
```javascript
// POST /api/auth/login
{
  email, password
}
  ↓
authService.login()
  - Find user by email
  - Verify password (bcryptjs compare)
  - Generate JWT token
  - Return { user, token }
```

#### GOOGLE AUTH (REST Endpoint)
```javascript
// POST /api/auth/google
{
  googleId, name, email, avatar
}
  ↓
authService.googleLogin()
  - Find user by email (⚠️ CRITICAL: searches by email, not googleId!)
  - If not found, create with googleId, name, email, avatar
  - Generate JWT token
  - Return { user, token }
```

#### GOOGLE AUTH (Passport Flow - INCOMPLETE)
```javascript
// GET /api/auth/google
  ↓
passport.authenticate('google', { scope: ['profile', 'email'] })
  ↓
// User logs in on Google
  ↓
// GET /api/auth/google/callback
  ↓
GoogleStrategy callback:
  - Extract: id, displayName, emails, photos
  - Find user by googleId
  - If not found, create user
  - Serialize user session
  ↓
Redirect to CLIENT_URL/dashboard
```

### Token Generation & Verification

**Generate:**
```javascript
jwt.sign(
  { id: userId },
  process.env.JWT_SECRET,
  { expiresIn: "7d" }
)
```

**Verify (in protect middleware):**
```javascript
// Bearer token in Authorization header
const token = req.headers.authorization.split(" ")[1];
const decoded = jwt.verify(token, process.env.JWT_SECRET);
req.user = User.findById(decoded.id).select("-password");
```

**Issues:**
- ❌ No refresh token mechanism
- ❌ JWT_SECRET must be strong (not validated in code)
- ❌ No token rotation
- ❌ No token blacklist for logout
- ❌ 7-day expiry may be too long for sensitive operations

### Middleware Stack

**Order in server.js:**
1. `express.json()` - Body parser
2. `cookieParser()` - Cookie parsing
3. `cors()` - CORS handling (origin checking, credentials)
4. `express.static(/uploads)` - Static file serving
5. `passport.initialize()` - Passport setup
6. `passport.session()` - Session management
7. Routes
8. `errorHandler` - Global error handler

**CORS Configuration:**
```javascript
const allowedOrigins = [
  process.env.CLIENT_URL,
  "https://digitaltwin.techtrekkers.ai"
];

const isLocalFrontend = /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);

cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || isLocalFrontend(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true
})
```

**Issues:**
- ⚠️ Relies on `process.env.CLIENT_URL` being set (may not be in dev)
- ⚠️ Loose CORS on localhost (dangerous in production if not careful)
- ✅ Credentials allowed (needed for cookies)

### Auth Middleware
```javascript
// protect middleware (very basic)
export const protect = async (req, res, next) => {
  let token;
  
  if (req.headers.authorization?.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select("-password");
      next();
    } catch (err) {
      res.status(401).json({ message: "Not authorized, token failed" });
    }
  }
  
  if (!token) {
    res.status(401).json({ message: "Not authorized, no token" });
  }
};
```

**Issues:**
- ❌ No checks for rev
```


## License: unknown
https://github.com/devastion/tmdb-api-use/blob/22998f24ac5a464ecb9d76cbc6e735b3eba07cd5/server/middleware/authMiddleware.js

```
Now I'll generate a comprehensive architecture audit. Based on my deep analysis of both frontend and backend code, here's the complete assessment:

---

# ARCHITECTURE AUDIT: DIGITAL TWIN PLATFORM
## Production-Grade Pre-Implementation Review

---

## EXECUTIVE SUMMARY

This is a **user-centric SaaS platform** with:
- **Manual authentication** (email/password) + **REST-based Google OAuth**
- **React 18 + TypeScript frontend** with shadcn/ui component library
- **Express.js backend** with MongoDB + Mongoose ORM
- **JWT token-based auth** (7-day expiry) with localStorage persistence
- **Per-user digital twin profiles** with complex nested data structures
- **Lead tracking system** for business intelligence

### Current Auth Status: **FUNCTIONAL BUT INCOMPLETE**
- Manual signup/login flows are implemented
- Google OAuth foundation exists but frontend implementation is commented out
- No refresh token mechanism
- No password reset flow
- No email verification

---

## 1. CURRENT FRONTEND ARCHITECTURE

### Framework & Tooling
```
React 18.3.1 + TypeScript + Vite (module-based)
Build Tool: Vite with React SWC plugin
Styling: Tailwind CSS + shadcn/ui components
State Management: React Context API + TanStack React Query
HTTP Client: Axios with interceptors
Routing: React Router v6.30.2
Animation: Framer Motion + GSAP
```

### Project Structure
```
src/
├── pages/
│   ├── Login.tsx              (Email/password login form)
│   ├── Signup.tsx             (Email/password signup form)
│   ├── Dashboard.tsx          (User dashboard with twins & leads)
│   ├── Chatbot.tsx            (Chat interface for digital twins)
│   ├── Index.tsx              (Digital twin wizard/builder)
│   ├── Landing.tsx            (Marketing landing page)
│   └── LandingPages/          (Landing page variants)
├── components/
│   ├── GoogleOAuth.tsx        (INCOMPLETE - Google auth component)
│   ├── DigitalTwinWizard.tsx (Wizard for creating twins)
│   └── ui/                    (Reusable shadcn/ui components)
├── contexts/
│   ├── AuthContext.tsx        (PARTIALLY COMMENTED OUT)
│   ├── DigitalTwinContext.tsx (Digital twin state management)
│   └── ProtectedRoute.tsx     (Route protection wrapper)
├── services/
│   └── api.service.ts         (Centralized API calls)
├── hooks/
│   ├── use-mobile.tsx
│   └── use-toast.ts
├── lib/
│   └── utils.ts
├── types/
│   └── digitalTwin.ts
└── axios.config.ts            (Axios instance with interceptors)
```

### Authentication Flow (Current)

#### SIGNUP Flow
```
User Input (name, email, password, confirm password)
  ↓
useAuth.signup() via AuthContext
  ↓
POST /api/auth/signup (email, password)
  ↓
Response: { user, token }
  ↓
Store: localStorage['token'] + localStorage['user']
  ↓
Update: AuthContext state
  ↓
Navigate: /wizard (digital twin builder)
```

#### LOGIN Flow
```
User Input (email, password)
  ↓
useAuth.login() via AuthContext
  ↓
POST /api/auth/login (email, password)
  ↓
Response: { user, token }
  ↓
Store: localStorage['token'] + localStorage['user']
  ↓
Update: AuthContext state
  ↓
Navigate: /dashboard
```

#### GOOGLE AUTH Flow (INCOMPLETE/COMMENTED)
```
Frontend attempts to:
1. Load Google API (window.google)
2. Initialize Google OAuth2 with client ID
3. Show One Tap UI or redirect to passport flow
4. Parse JWT credential
5. POST /api/auth/google with parsed data

Backend:
  POST /api/auth/google → createGoogleUser → return token
  OR
  GET /api/auth/google → passport.authenticate()
  → GET /api/auth/google/callback → redirect /dashboard
```

### Token & Session Management

**Token Storage Strategy:**
- Location: `localStorage['token']` (INSECURE - vulnerable to XSS)
- Format: JWT (Bearer token)
- Expiry: 7 days (server-side)
- Refresh: NONE (manual re-login required)

**Session Restoration:**
```typescript
// On app load via AuthContext
useEffect(() => {
  const storedToken = localStorage.getItem('token');
  const storedUser = localStorage.getItem('user');
  
  if (storedToken) {
    setToken(storedToken);
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    } else {
      getProfile(); // Fetch profile if missing
    }
  }
  setIsLoading(false);
}, []);
```

**Axios Interceptor:**
```typescript
// Request: Auto-attach token
interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response: Handle 401 on protected routes
interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !isAuthRequest) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login'; // Hard redirect
    }
    return Promise.reject(error);
  }
);
```

### Protected Routes
```typescript
// ProtectedRoute.tsx
if (isLoading) return <Loader />;
return user ? <>{children}</> : <Navigate to="/login" />;
```

### Current Auth Context (Status: PARTIALLY DISABLED)
- Most methods are commented out
- Fallback to basic fetch-based implementation in some places
- useAuth hook is the primary interface
- No error recovery for network failures

### Onboarding Flow
```
1. User lands on Landing.tsx (marketing site)
2. User clicks "Get Started" → Signup.tsx
3. Fill name, email, password
4. POST /api/auth/signup
5. Auto-logged in
6. Redirect to /wizard (Digital Twin Builder)
7. Fill detailed profile (identity, skills, experience, etc.)
8. POST /api/digital-twin/create
9. Redirect to /dashboard
10. View digital twin, see leads, manage profile
```

### Key Frontend Issues Identified

| Issue | Severity | Impact |
|-------|----------|---------|
| Token stored in localStorage | CRITICAL | XSS vulnerability, no CSRF protection |
| No refresh token mechanism | HIGH | User must re-login after 7 days |
| AuthContext partially commented | HIGH | Code maintainability, unclear intent |
| GoogleOAuth unfinished | HIGH | Google auth non-functional |
| No password reset UI/flow | MEDIUM | Users locked out if forgotten password |
| No email verification | MEDIUM | Spam/invalid emails possible |
| Hard redirect on 401 (losing context) | MEDIUM | Bad UX, state loss |
| No request retry logic | MEDIUM | Network hiccups = failed requests |
| Profile picture upload hardcoded URL | MEDIUM | Breaks with different API endpoints |
| No loading/error states in Dashboard | LOW | May seem frozen during loads |
| Axios base URL env var inconsistent | LOW | Frontend/backend URL mismatch risk |

### Strengths
✅ Modern React + TypeScript foundation
✅ Centralized API service layer (clean separation)
✅ Reusable shadcn/ui components
✅ Protected route abstraction
✅ Axios interceptor pattern
✅ React Query integration for data fetching
✅ Framer Motion for animations
✅ Type-safe with zod validation support

---

## 2. CURRENT BACKEND ARCHITECTURE

### Framework & Technology Stack
```
Node.js + Express.js 5.1.0 (modern version)
Database: MongoDB + Mongoose 8.19.2 (ES modules)
Authentication: Passport.js + JWT
File Upload: Multer
Password Security: bcryptjs
API Docs: None (manual implementation)
Environment: dotenv (but not fully used)
Error Handling: Custom middleware
```

### Project Structure
```
src/
├── server.js                  (Express app setup, middlewares, routes)
├── config/
│   ├── db.js                  (MongoDB connection)
│   └── passport.js            (Google OAuth strategy)
├── models/
│   ├── User.js                (User schema)
│   ├── DigitalTwin.js         (Digital twin schema - complex)
│   ├── Lead.js                (Lead tracking)
│   └── Message.js             (Chat messages - not analyzed)
├── controllers/
│   ├── authController.js      (Signup, login, Google auth)
│   ├── profileController.js   (Profile management, picture upload)
│   ├── digitalTwinController.js (Twin CRUD operations)
│   ├── chatController.js      (Chat operations)
│   └── leadController.js      (Lead CRUD operations)
├── middleware/
│   ├── authMiddleware.js      (JWT token verification)
│   ├── errorMiddleware.js     (Global error handler)
│   └── asyncHandler.js        (Async error wrapper)
├── routes/
│   ├── authRoutes.js          (Auth endpoints)
│   ├── digitalTwinRoutes.js   (Twin endpoints)
│   ├── chatRoutes.js          (Chat endpoints)
│   └── leadRoutes.js          (Lead endpoints)
├── services/
│   ├── authService.js         (Auth business logic)
│   ├── digitalTwinService.js  (Twin business logic)
│   ├── chatService.js         (Chat business logic)
│   └── leadService.js         (Lead business logic)
├── utils/
│   └── generateToken.js       (JWT token generation)
└── uploads/
    └── profile-pictures/      (File storage for profile pics)
```

### User Model (Current Schema)
```javascript
{
  name: String (required),
  email: String (required, unique),
  password: String (optional - for manual auth),
  googleId: String (optional - for Google auth),
  avatar: String (optional - from Google),
  profilePicture: String (optional - uploaded),
  timestamps: true
}
```

**Issues with User Model:**
- ❌ No `provider` field (can't track auth method)
- ❌ No `emailVerified` field (no email verification)
- ❌ No `lastLogin` tracking
- ❌ No `isActive` flag (no soft deletes)
- ❌ No `refreshToken` storage (no refresh mechanism)
- ❌ Both `password` and `googleId` optional (allows creating invalid users)
- ⚠️ `profilePicture` and `avatar` are separate (confusion)

### Digital Twin Model (Current)
```javascript
{
  user: ObjectId (ref: User, required, unique per user),
  identity: {
    name: String,
    role: String,
    tagline: String,
    bio: String
  },
  businesses: [
    {
      name: String,
      role: String,
      description: String,
      link: String,
      products: [String],
      duration: String
    }
  ],
  experience: [
    {
      company: String,
      role: String,
      duration: String,
      key_projects: [String]
    }
  ],
  education: [
    {
      institution: String,
      degree: String,
      year: String
    }
  ],
  skills: {
    list: [String],
    coreDomains: String,
    signatureStrengths: String
  },
  personality: {
    traits: [String],
    leadership_style: String,
    decision_style: String,
    tone: String,
    archetype: String,
    values: [String]
  },
  story: {
    mission: String,
    impact: String,
    themes: [String]
  },
  networking: {
    audience: String,
    intent: String,
    boundaries: [String]
  },
  links: {
    linkedin: String,
    website: String,
    portfolio: String,
    socials: [String]
  },
  isActive: Boolean (default: true),
  lastUpdated: Date,
  timestamps: true,
  indexes: [user, text search on identity]
}
```

✅ Well-designed schema for digital twin profiles
✅ Good separation of concerns (identity, skills, personality, etc.)
✅ Text search indexes for discovery
⚠️ No versioning/history tracking
⚠️ No public/private field separation (all data treated as public on /public/:twinId)

### Authentication Flow (Backend)

#### SIGNUP Flow
```javascript
// POST /api/auth/signup
{
  name, email, password
} 
  ↓
authService.register()
  - Check user exists (findOne)
  - Hash password (bcryptjs)
  - Create user
  - Generate JWT token (7d expiry)
  - Return { user, token }
```

#### LOGIN Flow
```javascript
// POST /api/auth/login
{
  email, password
}
  ↓
authService.login()
  - Find user by email
  - Verify password (bcryptjs compare)
  - Generate JWT token
  - Return { user, token }
```

#### GOOGLE AUTH (REST Endpoint)
```javascript
// POST /api/auth/google
{
  googleId, name, email, avatar
}
  ↓
authService.googleLogin()
  - Find user by email (⚠️ CRITICAL: searches by email, not googleId!)
  - If not found, create with googleId, name, email, avatar
  - Generate JWT token
  - Return { user, token }
```

#### GOOGLE AUTH (Passport Flow - INCOMPLETE)
```javascript
// GET /api/auth/google
  ↓
passport.authenticate('google', { scope: ['profile', 'email'] })
  ↓
// User logs in on Google
  ↓
// GET /api/auth/google/callback
  ↓
GoogleStrategy callback:
  - Extract: id, displayName, emails, photos
  - Find user by googleId
  - If not found, create user
  - Serialize user session
  ↓
Redirect to CLIENT_URL/dashboard
```

### Token Generation & Verification

**Generate:**
```javascript
jwt.sign(
  { id: userId },
  process.env.JWT_SECRET,
  { expiresIn: "7d" }
)
```

**Verify (in protect middleware):**
```javascript
// Bearer token in Authorization header
const token = req.headers.authorization.split(" ")[1];
const decoded = jwt.verify(token, process.env.JWT_SECRET);
req.user = User.findById(decoded.id).select("-password");
```

**Issues:**
- ❌ No refresh token mechanism
- ❌ JWT_SECRET must be strong (not validated in code)
- ❌ No token rotation
- ❌ No token blacklist for logout
- ❌ 7-day expiry may be too long for sensitive operations

### Middleware Stack

**Order in server.js:**
1. `express.json()` - Body parser
2. `cookieParser()` - Cookie parsing
3. `cors()` - CORS handling (origin checking, credentials)
4. `express.static(/uploads)` - Static file serving
5. `passport.initialize()` - Passport setup
6. `passport.session()` - Session management
7. Routes
8. `errorHandler` - Global error handler

**CORS Configuration:**
```javascript
const allowedOrigins = [
  process.env.CLIENT_URL,
  "https://digitaltwin.techtrekkers.ai"
];

const isLocalFrontend = /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);

cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || isLocalFrontend(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true
})
```

**Issues:**
- ⚠️ Relies on `process.env.CLIENT_URL` being set (may not be in dev)
- ⚠️ Loose CORS on localhost (dangerous in production if not careful)
- ✅ Credentials allowed (needed for cookies)

### Auth Middleware
```javascript
// protect middleware (very basic)
export const protect = async (req, res, next) => {
  let token;
  
  if (req.headers.authorization?.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select("-password");
      next();
    } catch (err) {
      res.status(401).json({ message: "Not authorized, token failed" });
    }
  }
  
  if (!token) {
    res.status(401).json({ message: "Not authorized, no token" });
  }
};
```

**Issues:**
- ❌ No checks for rev
```


## License: unknown
https://github.com/iamnishantgarg/Shopee/blob/d9b6055bee263b3444c5b9920a480dce1e577e7f/middleware/authMiddleware.js

```
Now I'll generate a comprehensive architecture audit. Based on my deep analysis of both frontend and backend code, here's the complete assessment:

---

# ARCHITECTURE AUDIT: DIGITAL TWIN PLATFORM
## Production-Grade Pre-Implementation Review

---

## EXECUTIVE SUMMARY

This is a **user-centric SaaS platform** with:
- **Manual authentication** (email/password) + **REST-based Google OAuth**
- **React 18 + TypeScript frontend** with shadcn/ui component library
- **Express.js backend** with MongoDB + Mongoose ORM
- **JWT token-based auth** (7-day expiry) with localStorage persistence
- **Per-user digital twin profiles** with complex nested data structures
- **Lead tracking system** for business intelligence

### Current Auth Status: **FUNCTIONAL BUT INCOMPLETE**
- Manual signup/login flows are implemented
- Google OAuth foundation exists but frontend implementation is commented out
- No refresh token mechanism
- No password reset flow
- No email verification

---

## 1. CURRENT FRONTEND ARCHITECTURE

### Framework & Tooling
```
React 18.3.1 + TypeScript + Vite (module-based)
Build Tool: Vite with React SWC plugin
Styling: Tailwind CSS + shadcn/ui components
State Management: React Context API + TanStack React Query
HTTP Client: Axios with interceptors
Routing: React Router v6.30.2
Animation: Framer Motion + GSAP
```

### Project Structure
```
src/
├── pages/
│   ├── Login.tsx              (Email/password login form)
│   ├── Signup.tsx             (Email/password signup form)
│   ├── Dashboard.tsx          (User dashboard with twins & leads)
│   ├── Chatbot.tsx            (Chat interface for digital twins)
│   ├── Index.tsx              (Digital twin wizard/builder)
│   ├── Landing.tsx            (Marketing landing page)
│   └── LandingPages/          (Landing page variants)
├── components/
│   ├── GoogleOAuth.tsx        (INCOMPLETE - Google auth component)
│   ├── DigitalTwinWizard.tsx (Wizard for creating twins)
│   └── ui/                    (Reusable shadcn/ui components)
├── contexts/
│   ├── AuthContext.tsx        (PARTIALLY COMMENTED OUT)
│   ├── DigitalTwinContext.tsx (Digital twin state management)
│   └── ProtectedRoute.tsx     (Route protection wrapper)
├── services/
│   └── api.service.ts         (Centralized API calls)
├── hooks/
│   ├── use-mobile.tsx
│   └── use-toast.ts
├── lib/
│   └── utils.ts
├── types/
│   └── digitalTwin.ts
└── axios.config.ts            (Axios instance with interceptors)
```

### Authentication Flow (Current)

#### SIGNUP Flow
```
User Input (name, email, password, confirm password)
  ↓
useAuth.signup() via AuthContext
  ↓
POST /api/auth/signup (email, password)
  ↓
Response: { user, token }
  ↓
Store: localStorage['token'] + localStorage['user']
  ↓
Update: AuthContext state
  ↓
Navigate: /wizard (digital twin builder)
```

#### LOGIN Flow
```
User Input (email, password)
  ↓
useAuth.login() via AuthContext
  ↓
POST /api/auth/login (email, password)
  ↓
Response: { user, token }
  ↓
Store: localStorage['token'] + localStorage['user']
  ↓
Update: AuthContext state
  ↓
Navigate: /dashboard
```

#### GOOGLE AUTH Flow (INCOMPLETE/COMMENTED)
```
Frontend attempts to:
1. Load Google API (window.google)
2. Initialize Google OAuth2 with client ID
3. Show One Tap UI or redirect to passport flow
4. Parse JWT credential
5. POST /api/auth/google with parsed data

Backend:
  POST /api/auth/google → createGoogleUser → return token
  OR
  GET /api/auth/google → passport.authenticate()
  → GET /api/auth/google/callback → redirect /dashboard
```

### Token & Session Management

**Token Storage Strategy:**
- Location: `localStorage['token']` (INSECURE - vulnerable to XSS)
- Format: JWT (Bearer token)
- Expiry: 7 days (server-side)
- Refresh: NONE (manual re-login required)

**Session Restoration:**
```typescript
// On app load via AuthContext
useEffect(() => {
  const storedToken = localStorage.getItem('token');
  const storedUser = localStorage.getItem('user');
  
  if (storedToken) {
    setToken(storedToken);
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    } else {
      getProfile(); // Fetch profile if missing
    }
  }
  setIsLoading(false);
}, []);
```

**Axios Interceptor:**
```typescript
// Request: Auto-attach token
interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response: Handle 401 on protected routes
interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !isAuthRequest) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login'; // Hard redirect
    }
    return Promise.reject(error);
  }
);
```

### Protected Routes
```typescript
// ProtectedRoute.tsx
if (isLoading) return <Loader />;
return user ? <>{children}</> : <Navigate to="/login" />;
```

### Current Auth Context (Status: PARTIALLY DISABLED)
- Most methods are commented out
- Fallback to basic fetch-based implementation in some places
- useAuth hook is the primary interface
- No error recovery for network failures

### Onboarding Flow
```
1. User lands on Landing.tsx (marketing site)
2. User clicks "Get Started" → Signup.tsx
3. Fill name, email, password
4. POST /api/auth/signup
5. Auto-logged in
6. Redirect to /wizard (Digital Twin Builder)
7. Fill detailed profile (identity, skills, experience, etc.)
8. POST /api/digital-twin/create
9. Redirect to /dashboard
10. View digital twin, see leads, manage profile
```

### Key Frontend Issues Identified

| Issue | Severity | Impact |
|-------|----------|---------|
| Token stored in localStorage | CRITICAL | XSS vulnerability, no CSRF protection |
| No refresh token mechanism | HIGH | User must re-login after 7 days |
| AuthContext partially commented | HIGH | Code maintainability, unclear intent |
| GoogleOAuth unfinished | HIGH | Google auth non-functional |
| No password reset UI/flow | MEDIUM | Users locked out if forgotten password |
| No email verification | MEDIUM | Spam/invalid emails possible |
| Hard redirect on 401 (losing context) | MEDIUM | Bad UX, state loss |
| No request retry logic | MEDIUM | Network hiccups = failed requests |
| Profile picture upload hardcoded URL | MEDIUM | Breaks with different API endpoints |
| No loading/error states in Dashboard | LOW | May seem frozen during loads |
| Axios base URL env var inconsistent | LOW | Frontend/backend URL mismatch risk |

### Strengths
✅ Modern React + TypeScript foundation
✅ Centralized API service layer (clean separation)
✅ Reusable shadcn/ui components
✅ Protected route abstraction
✅ Axios interceptor pattern
✅ React Query integration for data fetching
✅ Framer Motion for animations
✅ Type-safe with zod validation support

---

## 2. CURRENT BACKEND ARCHITECTURE

### Framework & Technology Stack
```
Node.js + Express.js 5.1.0 (modern version)
Database: MongoDB + Mongoose 8.19.2 (ES modules)
Authentication: Passport.js + JWT
File Upload: Multer
Password Security: bcryptjs
API Docs: None (manual implementation)
Environment: dotenv (but not fully used)
Error Handling: Custom middleware
```

### Project Structure
```
src/
├── server.js                  (Express app setup, middlewares, routes)
├── config/
│   ├── db.js                  (MongoDB connection)
│   └── passport.js            (Google OAuth strategy)
├── models/
│   ├── User.js                (User schema)
│   ├── DigitalTwin.js         (Digital twin schema - complex)
│   ├── Lead.js                (Lead tracking)
│   └── Message.js             (Chat messages - not analyzed)
├── controllers/
│   ├── authController.js      (Signup, login, Google auth)
│   ├── profileController.js   (Profile management, picture upload)
│   ├── digitalTwinController.js (Twin CRUD operations)
│   ├── chatController.js      (Chat operations)
│   └── leadController.js      (Lead CRUD operations)
├── middleware/
│   ├── authMiddleware.js      (JWT token verification)
│   ├── errorMiddleware.js     (Global error handler)
│   └── asyncHandler.js        (Async error wrapper)
├── routes/
│   ├── authRoutes.js          (Auth endpoints)
│   ├── digitalTwinRoutes.js   (Twin endpoints)
│   ├── chatRoutes.js          (Chat endpoints)
│   └── leadRoutes.js          (Lead endpoints)
├── services/
│   ├── authService.js         (Auth business logic)
│   ├── digitalTwinService.js  (Twin business logic)
│   ├── chatService.js         (Chat business logic)
│   └── leadService.js         (Lead business logic)
├── utils/
│   └── generateToken.js       (JWT token generation)
└── uploads/
    └── profile-pictures/      (File storage for profile pics)
```

### User Model (Current Schema)
```javascript
{
  name: String (required),
  email: String (required, unique),
  password: String (optional - for manual auth),
  googleId: String (optional - for Google auth),
  avatar: String (optional - from Google),
  profilePicture: String (optional - uploaded),
  timestamps: true
}
```

**Issues with User Model:**
- ❌ No `provider` field (can't track auth method)
- ❌ No `emailVerified` field (no email verification)
- ❌ No `lastLogin` tracking
- ❌ No `isActive` flag (no soft deletes)
- ❌ No `refreshToken` storage (no refresh mechanism)
- ❌ Both `password` and `googleId` optional (allows creating invalid users)
- ⚠️ `profilePicture` and `avatar` are separate (confusion)

### Digital Twin Model (Current)
```javascript
{
  user: ObjectId (ref: User, required, unique per user),
  identity: {
    name: String,
    role: String,
    tagline: String,
    bio: String
  },
  businesses: [
    {
      name: String,
      role: String,
      description: String,
      link: String,
      products: [String],
      duration: String
    }
  ],
  experience: [
    {
      company: String,
      role: String,
      duration: String,
      key_projects: [String]
    }
  ],
  education: [
    {
      institution: String,
      degree: String,
      year: String
    }
  ],
  skills: {
    list: [String],
    coreDomains: String,
    signatureStrengths: String
  },
  personality: {
    traits: [String],
    leadership_style: String,
    decision_style: String,
    tone: String,
    archetype: String,
    values: [String]
  },
  story: {
    mission: String,
    impact: String,
    themes: [String]
  },
  networking: {
    audience: String,
    intent: String,
    boundaries: [String]
  },
  links: {
    linkedin: String,
    website: String,
    portfolio: String,
    socials: [String]
  },
  isActive: Boolean (default: true),
  lastUpdated: Date,
  timestamps: true,
  indexes: [user, text search on identity]
}
```

✅ Well-designed schema for digital twin profiles
✅ Good separation of concerns (identity, skills, personality, etc.)
✅ Text search indexes for discovery
⚠️ No versioning/history tracking
⚠️ No public/private field separation (all data treated as public on /public/:twinId)

### Authentication Flow (Backend)

#### SIGNUP Flow
```javascript
// POST /api/auth/signup
{
  name, email, password
} 
  ↓
authService.register()
  - Check user exists (findOne)
  - Hash password (bcryptjs)
  - Create user
  - Generate JWT token (7d expiry)
  - Return { user, token }
```

#### LOGIN Flow
```javascript
// POST /api/auth/login
{
  email, password
}
  ↓
authService.login()
  - Find user by email
  - Verify password (bcryptjs compare)
  - Generate JWT token
  - Return { user, token }
```

#### GOOGLE AUTH (REST Endpoint)
```javascript
// POST /api/auth/google
{
  googleId, name, email, avatar
}
  ↓
authService.googleLogin()
  - Find user by email (⚠️ CRITICAL: searches by email, not googleId!)
  - If not found, create with googleId, name, email, avatar
  - Generate JWT token
  - Return { user, token }
```

#### GOOGLE AUTH (Passport Flow - INCOMPLETE)
```javascript
// GET /api/auth/google
  ↓
passport.authenticate('google', { scope: ['profile', 'email'] })
  ↓
// User logs in on Google
  ↓
// GET /api/auth/google/callback
  ↓
GoogleStrategy callback:
  - Extract: id, displayName, emails, photos
  - Find user by googleId
  - If not found, create user
  - Serialize user session
  ↓
Redirect to CLIENT_URL/dashboard
```

### Token Generation & Verification

**Generate:**
```javascript
jwt.sign(
  { id: userId },
  process.env.JWT_SECRET,
  { expiresIn: "7d" }
)
```

**Verify (in protect middleware):**
```javascript
// Bearer token in Authorization header
const token = req.headers.authorization.split(" ")[1];
const decoded = jwt.verify(token, process.env.JWT_SECRET);
req.user = User.findById(decoded.id).select("-password");
```

**Issues:**
- ❌ No refresh token mechanism
- ❌ JWT_SECRET must be strong (not validated in code)
- ❌ No token rotation
- ❌ No token blacklist for logout
- ❌ 7-day expiry may be too long for sensitive operations

### Middleware Stack

**Order in server.js:**
1. `express.json()` - Body parser
2. `cookieParser()` - Cookie parsing
3. `cors()` - CORS handling (origin checking, credentials)
4. `express.static(/uploads)` - Static file serving
5. `passport.initialize()` - Passport setup
6. `passport.session()` - Session management
7. Routes
8. `errorHandler` - Global error handler

**CORS Configuration:**
```javascript
const allowedOrigins = [
  process.env.CLIENT_URL,
  "https://digitaltwin.techtrekkers.ai"
];

const isLocalFrontend = /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);

cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || isLocalFrontend(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true
})
```

**Issues:**
- ⚠️ Relies on `process.env.CLIENT_URL` being set (may not be in dev)
- ⚠️ Loose CORS on localhost (dangerous in production if not careful)
- ✅ Credentials allowed (needed for cookies)

### Auth Middleware
```javascript
// protect middleware (very basic)
export const protect = async (req, res, next) => {
  let token;
  
  if (req.headers.authorization?.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select("-password");
      next();
    } catch (err) {
      res.status(401).json({ message: "Not authorized, token failed" });
    }
  }
  
  if (!token) {
    res.status(401).json({ message: "Not authorized, no token" });
  }
};
```

**Issues:**
- ❌ No checks for rev
```


## License: unknown
https://github.com/devastion/tmdb-api-use/blob/22998f24ac5a464ecb9d76cbc6e735b3eba07cd5/server/middleware/authMiddleware.js

```
Now I'll generate a comprehensive architecture audit. Based on my deep analysis of both frontend and backend code, here's the complete assessment:

---

# ARCHITECTURE AUDIT: DIGITAL TWIN PLATFORM
## Production-Grade Pre-Implementation Review

---

## EXECUTIVE SUMMARY

This is a **user-centric SaaS platform** with:
- **Manual authentication** (email/password) + **REST-based Google OAuth**
- **React 18 + TypeScript frontend** with shadcn/ui component library
- **Express.js backend** with MongoDB + Mongoose ORM
- **JWT token-based auth** (7-day expiry) with localStorage persistence
- **Per-user digital twin profiles** with complex nested data structures
- **Lead tracking system** for business intelligence

### Current Auth Status: **FUNCTIONAL BUT INCOMPLETE**
- Manual signup/login flows are implemented
- Google OAuth foundation exists but frontend implementation is commented out
- No refresh token mechanism
- No password reset flow
- No email verification

---

## 1. CURRENT FRONTEND ARCHITECTURE

### Framework & Tooling
```
React 18.3.1 + TypeScript + Vite (module-based)
Build Tool: Vite with React SWC plugin
Styling: Tailwind CSS + shadcn/ui components
State Management: React Context API + TanStack React Query
HTTP Client: Axios with interceptors
Routing: React Router v6.30.2
Animation: Framer Motion + GSAP
```

### Project Structure
```
src/
├── pages/
│   ├── Login.tsx              (Email/password login form)
│   ├── Signup.tsx             (Email/password signup form)
│   ├── Dashboard.tsx          (User dashboard with twins & leads)
│   ├── Chatbot.tsx            (Chat interface for digital twins)
│   ├── Index.tsx              (Digital twin wizard/builder)
│   ├── Landing.tsx            (Marketing landing page)
│   └── LandingPages/          (Landing page variants)
├── components/
│   ├── GoogleOAuth.tsx        (INCOMPLETE - Google auth component)
│   ├── DigitalTwinWizard.tsx (Wizard for creating twins)
│   └── ui/                    (Reusable shadcn/ui components)
├── contexts/
│   ├── AuthContext.tsx        (PARTIALLY COMMENTED OUT)
│   ├── DigitalTwinContext.tsx (Digital twin state management)
│   └── ProtectedRoute.tsx     (Route protection wrapper)
├── services/
│   └── api.service.ts         (Centralized API calls)
├── hooks/
│   ├── use-mobile.tsx
│   └── use-toast.ts
├── lib/
│   └── utils.ts
├── types/
│   └── digitalTwin.ts
└── axios.config.ts            (Axios instance with interceptors)
```

### Authentication Flow (Current)

#### SIGNUP Flow
```
User Input (name, email, password, confirm password)
  ↓
useAuth.signup() via AuthContext
  ↓
POST /api/auth/signup (email, password)
  ↓
Response: { user, token }
  ↓
Store: localStorage['token'] + localStorage['user']
  ↓
Update: AuthContext state
  ↓
Navigate: /wizard (digital twin builder)
```

#### LOGIN Flow
```
User Input (email, password)
  ↓
useAuth.login() via AuthContext
  ↓
POST /api/auth/login (email, password)
  ↓
Response: { user, token }
  ↓
Store: localStorage['token'] + localStorage['user']
  ↓
Update: AuthContext state
  ↓
Navigate: /dashboard
```

#### GOOGLE AUTH Flow (INCOMPLETE/COMMENTED)
```
Frontend attempts to:
1. Load Google API (window.google)
2. Initialize Google OAuth2 with client ID
3. Show One Tap UI or redirect to passport flow
4. Parse JWT credential
5. POST /api/auth/google with parsed data

Backend:
  POST /api/auth/google → createGoogleUser → return token
  OR
  GET /api/auth/google → passport.authenticate()
  → GET /api/auth/google/callback → redirect /dashboard
```

### Token & Session Management

**Token Storage Strategy:**
- Location: `localStorage['token']` (INSECURE - vulnerable to XSS)
- Format: JWT (Bearer token)
- Expiry: 7 days (server-side)
- Refresh: NONE (manual re-login required)

**Session Restoration:**
```typescript
// On app load via AuthContext
useEffect(() => {
  const storedToken = localStorage.getItem('token');
  const storedUser = localStorage.getItem('user');
  
  if (storedToken) {
    setToken(storedToken);
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    } else {
      getProfile(); // Fetch profile if missing
    }
  }
  setIsLoading(false);
}, []);
```

**Axios Interceptor:**
```typescript
// Request: Auto-attach token
interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response: Handle 401 on protected routes
interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !isAuthRequest) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login'; // Hard redirect
    }
    return Promise.reject(error);
  }
);
```

### Protected Routes
```typescript
// ProtectedRoute.tsx
if (isLoading) return <Loader />;
return user ? <>{children}</> : <Navigate to="/login" />;
```

### Current Auth Context (Status: PARTIALLY DISABLED)
- Most methods are commented out
- Fallback to basic fetch-based implementation in some places
- useAuth hook is the primary interface
- No error recovery for network failures

### Onboarding Flow
```
1. User lands on Landing.tsx (marketing site)
2. User clicks "Get Started" → Signup.tsx
3. Fill name, email, password
4. POST /api/auth/signup
5. Auto-logged in
6. Redirect to /wizard (Digital Twin Builder)
7. Fill detailed profile (identity, skills, experience, etc.)
8. POST /api/digital-twin/create
9. Redirect to /dashboard
10. View digital twin, see leads, manage profile
```

### Key Frontend Issues Identified

| Issue | Severity | Impact |
|-------|----------|---------|
| Token stored in localStorage | CRITICAL | XSS vulnerability, no CSRF protection |
| No refresh token mechanism | HIGH | User must re-login after 7 days |
| AuthContext partially commented | HIGH | Code maintainability, unclear intent |
| GoogleOAuth unfinished | HIGH | Google auth non-functional |
| No password reset UI/flow | MEDIUM | Users locked out if forgotten password |
| No email verification | MEDIUM | Spam/invalid emails possible |
| Hard redirect on 401 (losing context) | MEDIUM | Bad UX, state loss |
| No request retry logic | MEDIUM | Network hiccups = failed requests |
| Profile picture upload hardcoded URL | MEDIUM | Breaks with different API endpoints |
| No loading/error states in Dashboard | LOW | May seem frozen during loads |
| Axios base URL env var inconsistent | LOW | Frontend/backend URL mismatch risk |

### Strengths
✅ Modern React + TypeScript foundation
✅ Centralized API service layer (clean separation)
✅ Reusable shadcn/ui components
✅ Protected route abstraction
✅ Axios interceptor pattern
✅ React Query integration for data fetching
✅ Framer Motion for animations
✅ Type-safe with zod validation support

---

## 2. CURRENT BACKEND ARCHITECTURE

### Framework & Technology Stack
```
Node.js + Express.js 5.1.0 (modern version)
Database: MongoDB + Mongoose 8.19.2 (ES modules)
Authentication: Passport.js + JWT
File Upload: Multer
Password Security: bcryptjs
API Docs: None (manual implementation)
Environment: dotenv (but not fully used)
Error Handling: Custom middleware
```

### Project Structure
```
src/
├── server.js                  (Express app setup, middlewares, routes)
├── config/
│   ├── db.js                  (MongoDB connection)
│   └── passport.js            (Google OAuth strategy)
├── models/
│   ├── User.js                (User schema)
│   ├── DigitalTwin.js         (Digital twin schema - complex)
│   ├── Lead.js                (Lead tracking)
│   └── Message.js             (Chat messages - not analyzed)
├── controllers/
│   ├── authController.js      (Signup, login, Google auth)
│   ├── profileController.js   (Profile management, picture upload)
│   ├── digitalTwinController.js (Twin CRUD operations)
│   ├── chatController.js      (Chat operations)
│   └── leadController.js      (Lead CRUD operations)
├── middleware/
│   ├── authMiddleware.js      (JWT token verification)
│   ├── errorMiddleware.js     (Global error handler)
│   └── asyncHandler.js        (Async error wrapper)
├── routes/
│   ├── authRoutes.js          (Auth endpoints)
│   ├── digitalTwinRoutes.js   (Twin endpoints)
│   ├── chatRoutes.js          (Chat endpoints)
│   └── leadRoutes.js          (Lead endpoints)
├── services/
│   ├── authService.js         (Auth business logic)
│   ├── digitalTwinService.js  (Twin business logic)
│   ├── chatService.js         (Chat business logic)
│   └── leadService.js         (Lead business logic)
├── utils/
│   └── generateToken.js       (JWT token generation)
└── uploads/
    └── profile-pictures/      (File storage for profile pics)
```

### User Model (Current Schema)
```javascript
{
  name: String (required),
  email: String (required, unique),
  password: String (optional - for manual auth),
  googleId: String (optional - for Google auth),
  avatar: String (optional - from Google),
  profilePicture: String (optional - uploaded),
  timestamps: true
}
```

**Issues with User Model:**
- ❌ No `provider` field (can't track auth method)
- ❌ No `emailVerified` field (no email verification)
- ❌ No `lastLogin` tracking
- ❌ No `isActive` flag (no soft deletes)
- ❌ No `refreshToken` storage (no refresh mechanism)
- ❌ Both `password` and `googleId` optional (allows creating invalid users)
- ⚠️ `profilePicture` and `avatar` are separate (confusion)

### Digital Twin Model (Current)
```javascript
{
  user: ObjectId (ref: User, required, unique per user),
  identity: {
    name: String,
    role: String,
    tagline: String,
    bio: String
  },
  businesses: [
    {
      name: String,
      role: String,
      description: String,
      link: String,
      products: [String],
      duration: String
    }
  ],
  experience: [
    {
      company: String,
      role: String,
      duration: String,
      key_projects: [String]
    }
  ],
  education: [
    {
      institution: String,
      degree: String,
      year: String
    }
  ],
  skills: {
    list: [String],
    coreDomains: String,
    signatureStrengths: String
  },
  personality: {
    traits: [String],
    leadership_style: String,
    decision_style: String,
    tone: String,
    archetype: String,
    values: [String]
  },
  story: {
    mission: String,
    impact: String,
    themes: [String]
  },
  networking: {
    audience: String,
    intent: String,
    boundaries: [String]
  },
  links: {
    linkedin: String,
    website: String,
    portfolio: String,
    socials: [String]
  },
  isActive: Boolean (default: true),
  lastUpdated: Date,
  timestamps: true,
  indexes: [user, text search on identity]
}
```

✅ Well-designed schema for digital twin profiles
✅ Good separation of concerns (identity, skills, personality, etc.)
✅ Text search indexes for discovery
⚠️ No versioning/history tracking
⚠️ No public/private field separation (all data treated as public on /public/:twinId)

### Authentication Flow (Backend)

#### SIGNUP Flow
```javascript
// POST /api/auth/signup
{
  name, email, password
} 
  ↓
authService.register()
  - Check user exists (findOne)
  - Hash password (bcryptjs)
  - Create user
  - Generate JWT token (7d expiry)
  - Return { user, token }
```

#### LOGIN Flow
```javascript
// POST /api/auth/login
{
  email, password
}
  ↓
authService.login()
  - Find user by email
  - Verify password (bcryptjs compare)
  - Generate JWT token
  - Return { user, token }
```

#### GOOGLE AUTH (REST Endpoint)
```javascript
// POST /api/auth/google
{
  googleId, name, email, avatar
}
  ↓
authService.googleLogin()
  - Find user by email (⚠️ CRITICAL: searches by email, not googleId!)
  - If not found, create with googleId, name, email, avatar
  - Generate JWT token
  - Return { user, token }
```

#### GOOGLE AUTH (Passport Flow - INCOMPLETE)
```javascript
// GET /api/auth/google
  ↓
passport.authenticate('google', { scope: ['profile', 'email'] })
  ↓
// User logs in on Google
  ↓
// GET /api/auth/google/callback
  ↓
GoogleStrategy callback:
  - Extract: id, displayName, emails, photos
  - Find user by googleId
  - If not found, create user
  - Serialize user session
  ↓
Redirect to CLIENT_URL/dashboard
```

### Token Generation & Verification

**Generate:**
```javascript
jwt.sign(
  { id: userId },
  process.env.JWT_SECRET,
  { expiresIn: "7d" }
)
```

**Verify (in protect middleware):**
```javascript
// Bearer token in Authorization header
const token = req.headers.authorization.split(" ")[1];
const decoded = jwt.verify(token, process.env.JWT_SECRET);
req.user = User.findById(decoded.id).select("-password");
```

**Issues:**
- ❌ No refresh token mechanism
- ❌ JWT_SECRET must be strong (not validated in code)
- ❌ No token rotation
- ❌ No token blacklist for logout
- ❌ 7-day expiry may be too long for sensitive operations

### Middleware Stack

**Order in server.js:**
1. `express.json()` - Body parser
2. `cookieParser()` - Cookie parsing
3. `cors()` - CORS handling (origin checking, credentials)
4. `express.static(/uploads)` - Static file serving
5. `passport.initialize()` - Passport setup
6. `passport.session()` - Session management
7. Routes
8. `errorHandler` - Global error handler

**CORS Configuration:**
```javascript
const allowedOrigins = [
  process.env.CLIENT_URL,
  "https://digitaltwin.techtrekkers.ai"
];

const isLocalFrontend = /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);

cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || isLocalFrontend(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true
})
```

**Issues:**
- ⚠️ Relies on `process.env.CLIENT_URL` being set (may not be in dev)
- ⚠️ Loose CORS on localhost (dangerous in production if not careful)
- ✅ Credentials allowed (needed for cookies)

### Auth Middleware
```javascript
// protect middleware (very basic)
export const protect = async (req, res, next) => {
  let token;
  
  if (req.headers.authorization?.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select("-password");
      next();
    } catch (err) {
      res.status(401).json({ message: "Not authorized, token failed" });
    }
  }
  
  if (!token) {
    res.status(401).json({ message: "Not authorized, no token" });
  }
};
```

**Issues:**
- ❌ No checks for rev
```


## License: unknown
https://github.com/BhargovJD/React-2021/blob/561058e6d7880040f0d5cf1f1c63758f6b13db4a/32%20MernStack/DigitalDiaryApp/backend/middlewares/auth-middleware.js

```
Now I'll generate a comprehensive architecture audit. Based on my deep analysis of both frontend and backend code, here's the complete assessment:

---

# ARCHITECTURE AUDIT: DIGITAL TWIN PLATFORM
## Production-Grade Pre-Implementation Review

---

## EXECUTIVE SUMMARY

This is a **user-centric SaaS platform** with:
- **Manual authentication** (email/password) + **REST-based Google OAuth**
- **React 18 + TypeScript frontend** with shadcn/ui component library
- **Express.js backend** with MongoDB + Mongoose ORM
- **JWT token-based auth** (7-day expiry) with localStorage persistence
- **Per-user digital twin profiles** with complex nested data structures
- **Lead tracking system** for business intelligence

### Current Auth Status: **FUNCTIONAL BUT INCOMPLETE**
- Manual signup/login flows are implemented
- Google OAuth foundation exists but frontend implementation is commented out
- No refresh token mechanism
- No password reset flow
- No email verification

---

## 1. CURRENT FRONTEND ARCHITECTURE

### Framework & Tooling
```
React 18.3.1 + TypeScript + Vite (module-based)
Build Tool: Vite with React SWC plugin
Styling: Tailwind CSS + shadcn/ui components
State Management: React Context API + TanStack React Query
HTTP Client: Axios with interceptors
Routing: React Router v6.30.2
Animation: Framer Motion + GSAP
```

### Project Structure
```
src/
├── pages/
│   ├── Login.tsx              (Email/password login form)
│   ├── Signup.tsx             (Email/password signup form)
│   ├── Dashboard.tsx          (User dashboard with twins & leads)
│   ├── Chatbot.tsx            (Chat interface for digital twins)
│   ├── Index.tsx              (Digital twin wizard/builder)
│   ├── Landing.tsx            (Marketing landing page)
│   └── LandingPages/          (Landing page variants)
├── components/
│   ├── GoogleOAuth.tsx        (INCOMPLETE - Google auth component)
│   ├── DigitalTwinWizard.tsx (Wizard for creating twins)
│   └── ui/                    (Reusable shadcn/ui components)
├── contexts/
│   ├── AuthContext.tsx        (PARTIALLY COMMENTED OUT)
│   ├── DigitalTwinContext.tsx (Digital twin state management)
│   └── ProtectedRoute.tsx     (Route protection wrapper)
├── services/
│   └── api.service.ts         (Centralized API calls)
├── hooks/
│   ├── use-mobile.tsx
│   └── use-toast.ts
├── lib/
│   └── utils.ts
├── types/
│   └── digitalTwin.ts
└── axios.config.ts            (Axios instance with interceptors)
```

### Authentication Flow (Current)

#### SIGNUP Flow
```
User Input (name, email, password, confirm password)
  ↓
useAuth.signup() via AuthContext
  ↓
POST /api/auth/signup (email, password)
  ↓
Response: { user, token }
  ↓
Store: localStorage['token'] + localStorage['user']
  ↓
Update: AuthContext state
  ↓
Navigate: /wizard (digital twin builder)
```

#### LOGIN Flow
```
User Input (email, password)
  ↓
useAuth.login() via AuthContext
  ↓
POST /api/auth/login (email, password)
  ↓
Response: { user, token }
  ↓
Store: localStorage['token'] + localStorage['user']
  ↓
Update: AuthContext state
  ↓
Navigate: /dashboard
```

#### GOOGLE AUTH Flow (INCOMPLETE/COMMENTED)
```
Frontend attempts to:
1. Load Google API (window.google)
2. Initialize Google OAuth2 with client ID
3. Show One Tap UI or redirect to passport flow
4. Parse JWT credential
5. POST /api/auth/google with parsed data

Backend:
  POST /api/auth/google → createGoogleUser → return token
  OR
  GET /api/auth/google → passport.authenticate()
  → GET /api/auth/google/callback → redirect /dashboard
```

### Token & Session Management

**Token Storage Strategy:**
- Location: `localStorage['token']` (INSECURE - vulnerable to XSS)
- Format: JWT (Bearer token)
- Expiry: 7 days (server-side)
- Refresh: NONE (manual re-login required)

**Session Restoration:**
```typescript
// On app load via AuthContext
useEffect(() => {
  const storedToken = localStorage.getItem('token');
  const storedUser = localStorage.getItem('user');
  
  if (storedToken) {
    setToken(storedToken);
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    } else {
      getProfile(); // Fetch profile if missing
    }
  }
  setIsLoading(false);
}, []);
```

**Axios Interceptor:**
```typescript
// Request: Auto-attach token
interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response: Handle 401 on protected routes
interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !isAuthRequest) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login'; // Hard redirect
    }
    return Promise.reject(error);
  }
);
```

### Protected Routes
```typescript
// ProtectedRoute.tsx
if (isLoading) return <Loader />;
return user ? <>{children}</> : <Navigate to="/login" />;
```

### Current Auth Context (Status: PARTIALLY DISABLED)
- Most methods are commented out
- Fallback to basic fetch-based implementation in some places
- useAuth hook is the primary interface
- No error recovery for network failures

### Onboarding Flow
```
1. User lands on Landing.tsx (marketing site)
2. User clicks "Get Started" → Signup.tsx
3. Fill name, email, password
4. POST /api/auth/signup
5. Auto-logged in
6. Redirect to /wizard (Digital Twin Builder)
7. Fill detailed profile (identity, skills, experience, etc.)
8. POST /api/digital-twin/create
9. Redirect to /dashboard
10. View digital twin, see leads, manage profile
```

### Key Frontend Issues Identified

| Issue | Severity | Impact |
|-------|----------|---------|
| Token stored in localStorage | CRITICAL | XSS vulnerability, no CSRF protection |
| No refresh token mechanism | HIGH | User must re-login after 7 days |
| AuthContext partially commented | HIGH | Code maintainability, unclear intent |
| GoogleOAuth unfinished | HIGH | Google auth non-functional |
| No password reset UI/flow | MEDIUM | Users locked out if forgotten password |
| No email verification | MEDIUM | Spam/invalid emails possible |
| Hard redirect on 401 (losing context) | MEDIUM | Bad UX, state loss |
| No request retry logic | MEDIUM | Network hiccups = failed requests |
| Profile picture upload hardcoded URL | MEDIUM | Breaks with different API endpoints |
| No loading/error states in Dashboard | LOW | May seem frozen during loads |
| Axios base URL env var inconsistent | LOW | Frontend/backend URL mismatch risk |

### Strengths
✅ Modern React + TypeScript foundation
✅ Centralized API service layer (clean separation)
✅ Reusable shadcn/ui components
✅ Protected route abstraction
✅ Axios interceptor pattern
✅ React Query integration for data fetching
✅ Framer Motion for animations
✅ Type-safe with zod validation support

---

## 2. CURRENT BACKEND ARCHITECTURE

### Framework & Technology Stack
```
Node.js + Express.js 5.1.0 (modern version)
Database: MongoDB + Mongoose 8.19.2 (ES modules)
Authentication: Passport.js + JWT
File Upload: Multer
Password Security: bcryptjs
API Docs: None (manual implementation)
Environment: dotenv (but not fully used)
Error Handling: Custom middleware
```

### Project Structure
```
src/
├── server.js                  (Express app setup, middlewares, routes)
├── config/
│   ├── db.js                  (MongoDB connection)
│   └── passport.js            (Google OAuth strategy)
├── models/
│   ├── User.js                (User schema)
│   ├── DigitalTwin.js         (Digital twin schema - complex)
│   ├── Lead.js                (Lead tracking)
│   └── Message.js             (Chat messages - not analyzed)
├── controllers/
│   ├── authController.js      (Signup, login, Google auth)
│   ├── profileController.js   (Profile management, picture upload)
│   ├── digitalTwinController.js (Twin CRUD operations)
│   ├── chatController.js      (Chat operations)
│   └── leadController.js      (Lead CRUD operations)
├── middleware/
│   ├── authMiddleware.js      (JWT token verification)
│   ├── errorMiddleware.js     (Global error handler)
│   └── asyncHandler.js        (Async error wrapper)
├── routes/
│   ├── authRoutes.js          (Auth endpoints)
│   ├── digitalTwinRoutes.js   (Twin endpoints)
│   ├── chatRoutes.js          (Chat endpoints)
│   └── leadRoutes.js          (Lead endpoints)
├── services/
│   ├── authService.js         (Auth business logic)
│   ├── digitalTwinService.js  (Twin business logic)
│   ├── chatService.js         (Chat business logic)
│   └── leadService.js         (Lead business logic)
├── utils/
│   └── generateToken.js       (JWT token generation)
└── uploads/
    └── profile-pictures/      (File storage for profile pics)
```

### User Model (Current Schema)
```javascript
{
  name: String (required),
  email: String (required, unique),
  password: String (optional - for manual auth),
  googleId: String (optional - for Google auth),
  avatar: String (optional - from Google),
  profilePicture: String (optional - uploaded),
  timestamps: true
}
```

**Issues with User Model:**
- ❌ No `provider` field (can't track auth method)
- ❌ No `emailVerified` field (no email verification)
- ❌ No `lastLogin` tracking
- ❌ No `isActive` flag (no soft deletes)
- ❌ No `refreshToken` storage (no refresh mechanism)
- ❌ Both `password` and `googleId` optional (allows creating invalid users)
- ⚠️ `profilePicture` and `avatar` are separate (confusion)

### Digital Twin Model (Current)
```javascript
{
  user: ObjectId (ref: User, required, unique per user),
  identity: {
    name: String,
    role: String,
    tagline: String,
    bio: String
  },
  businesses: [
    {
      name: String,
      role: String,
      description: String,
      link: String,
      products: [String],
      duration: String
    }
  ],
  experience: [
    {
      company: String,
      role: String,
      duration: String,
      key_projects: [String]
    }
  ],
  education: [
    {
      institution: String,
      degree: String,
      year: String
    }
  ],
  skills: {
    list: [String],
    coreDomains: String,
    signatureStrengths: String
  },
  personality: {
    traits: [String],
    leadership_style: String,
    decision_style: String,
    tone: String,
    archetype: String,
    values: [String]
  },
  story: {
    mission: String,
    impact: String,
    themes: [String]
  },
  networking: {
    audience: String,
    intent: String,
    boundaries: [String]
  },
  links: {
    linkedin: String,
    website: String,
    portfolio: String,
    socials: [String]
  },
  isActive: Boolean (default: true),
  lastUpdated: Date,
  timestamps: true,
  indexes: [user, text search on identity]
}
```

✅ Well-designed schema for digital twin profiles
✅ Good separation of concerns (identity, skills, personality, etc.)
✅ Text search indexes for discovery
⚠️ No versioning/history tracking
⚠️ No public/private field separation (all data treated as public on /public/:twinId)

### Authentication Flow (Backend)

#### SIGNUP Flow
```javascript
// POST /api/auth/signup
{
  name, email, password
} 
  ↓
authService.register()
  - Check user exists (findOne)
  - Hash password (bcryptjs)
  - Create user
  - Generate JWT token (7d expiry)
  - Return { user, token }
```

#### LOGIN Flow
```javascript
// POST /api/auth/login
{
  email, password
}
  ↓
authService.login()
  - Find user by email
  - Verify password (bcryptjs compare)
  - Generate JWT token
  - Return { user, token }
```

#### GOOGLE AUTH (REST Endpoint)
```javascript
// POST /api/auth/google
{
  googleId, name, email, avatar
}
  ↓
authService.googleLogin()
  - Find user by email (⚠️ CRITICAL: searches by email, not googleId!)
  - If not found, create with googleId, name, email, avatar
  - Generate JWT token
  - Return { user, token }
```

#### GOOGLE AUTH (Passport Flow - INCOMPLETE)
```javascript
// GET /api/auth/google
  ↓
passport.authenticate('google', { scope: ['profile', 'email'] })
  ↓
// User logs in on Google
  ↓
// GET /api/auth/google/callback
  ↓
GoogleStrategy callback:
  - Extract: id, displayName, emails, photos
  - Find user by googleId
  - If not found, create user
  - Serialize user session
  ↓
Redirect to CLIENT_URL/dashboard
```

### Token Generation & Verification

**Generate:**
```javascript
jwt.sign(
  { id: userId },
  process.env.JWT_SECRET,
  { expiresIn: "7d" }
)
```

**Verify (in protect middleware):**
```javascript
// Bearer token in Authorization header
const token = req.headers.authorization.split(" ")[1];
const decoded = jwt.verify(token, process.env.JWT_SECRET);
req.user = User.findById(decoded.id).select("-password");
```

**Issues:**
- ❌ No refresh token mechanism
- ❌ JWT_SECRET must be strong (not validated in code)
- ❌ No token rotation
- ❌ No token blacklist for logout
- ❌ 7-day expiry may be too long for sensitive operations

### Middleware Stack

**Order in server.js:**
1. `express.json()` - Body parser
2. `cookieParser()` - Cookie parsing
3. `cors()` - CORS handling (origin checking, credentials)
4. `express.static(/uploads)` - Static file serving
5. `passport.initialize()` - Passport setup
6. `passport.session()` - Session management
7. Routes
8. `errorHandler` - Global error handler

**CORS Configuration:**
```javascript
const allowedOrigins = [
  process.env.CLIENT_URL,
  "https://digitaltwin.techtrekkers.ai"
];

const isLocalFrontend = /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);

cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || isLocalFrontend(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true
})
```

**Issues:**
- ⚠️ Relies on `process.env.CLIENT_URL` being set (may not be in dev)
- ⚠️ Loose CORS on localhost (dangerous in production if not careful)
- ✅ Credentials allowed (needed for cookies)

### Auth Middleware
```javascript
// protect middleware (very basic)
export const protect = async (req, res, next) => {
  let token;
  
  if (req.headers.authorization?.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select("-password");
      next();
    } catch (err) {
      res.status(401).json({ message: "Not authorized, token failed" });
    }
  }
  
  if (!token) {
    res.status(401).json({ message: "Not authorized, no token" });
  }
};
```

**Issues:**
- ❌ No checks for revoked/blacklisted tokens
- ❌ No token expiry verification (JWT lib handles it, but no custom logic)
- ❌ User.
```


## License: unknown
https://github.com/iamnishantgarg/Shopee/blob/d9b6055bee263b3444c5b9920a480dce1e577e7f/middleware/authMiddleware.js

```
Now I'll generate a comprehensive architecture audit. Based on my deep analysis of both frontend and backend code, here's the complete assessment:

---

# ARCHITECTURE AUDIT: DIGITAL TWIN PLATFORM
## Production-Grade Pre-Implementation Review

---

## EXECUTIVE SUMMARY

This is a **user-centric SaaS platform** with:
- **Manual authentication** (email/password) + **REST-based Google OAuth**
- **React 18 + TypeScript frontend** with shadcn/ui component library
- **Express.js backend** with MongoDB + Mongoose ORM
- **JWT token-based auth** (7-day expiry) with localStorage persistence
- **Per-user digital twin profiles** with complex nested data structures
- **Lead tracking system** for business intelligence

### Current Auth Status: **FUNCTIONAL BUT INCOMPLETE**
- Manual signup/login flows are implemented
- Google OAuth foundation exists but frontend implementation is commented out
- No refresh token mechanism
- No password reset flow
- No email verification

---

## 1. CURRENT FRONTEND ARCHITECTURE

### Framework & Tooling
```
React 18.3.1 + TypeScript + Vite (module-based)
Build Tool: Vite with React SWC plugin
Styling: Tailwind CSS + shadcn/ui components
State Management: React Context API + TanStack React Query
HTTP Client: Axios with interceptors
Routing: React Router v6.30.2
Animation: Framer Motion + GSAP
```

### Project Structure
```
src/
├── pages/
│   ├── Login.tsx              (Email/password login form)
│   ├── Signup.tsx             (Email/password signup form)
│   ├── Dashboard.tsx          (User dashboard with twins & leads)
│   ├── Chatbot.tsx            (Chat interface for digital twins)
│   ├── Index.tsx              (Digital twin wizard/builder)
│   ├── Landing.tsx            (Marketing landing page)
│   └── LandingPages/          (Landing page variants)
├── components/
│   ├── GoogleOAuth.tsx        (INCOMPLETE - Google auth component)
│   ├── DigitalTwinWizard.tsx (Wizard for creating twins)
│   └── ui/                    (Reusable shadcn/ui components)
├── contexts/
│   ├── AuthContext.tsx        (PARTIALLY COMMENTED OUT)
│   ├── DigitalTwinContext.tsx (Digital twin state management)
│   └── ProtectedRoute.tsx     (Route protection wrapper)
├── services/
│   └── api.service.ts         (Centralized API calls)
├── hooks/
│   ├── use-mobile.tsx
│   └── use-toast.ts
├── lib/
│   └── utils.ts
├── types/
│   └── digitalTwin.ts
└── axios.config.ts            (Axios instance with interceptors)
```

### Authentication Flow (Current)

#### SIGNUP Flow
```
User Input (name, email, password, confirm password)
  ↓
useAuth.signup() via AuthContext
  ↓
POST /api/auth/signup (email, password)
  ↓
Response: { user, token }
  ↓
Store: localStorage['token'] + localStorage['user']
  ↓
Update: AuthContext state
  ↓
Navigate: /wizard (digital twin builder)
```

#### LOGIN Flow
```
User Input (email, password)
  ↓
useAuth.login() via AuthContext
  ↓
POST /api/auth/login (email, password)
  ↓
Response: { user, token }
  ↓
Store: localStorage['token'] + localStorage['user']
  ↓
Update: AuthContext state
  ↓
Navigate: /dashboard
```

#### GOOGLE AUTH Flow (INCOMPLETE/COMMENTED)
```
Frontend attempts to:
1. Load Google API (window.google)
2. Initialize Google OAuth2 with client ID
3. Show One Tap UI or redirect to passport flow
4. Parse JWT credential
5. POST /api/auth/google with parsed data

Backend:
  POST /api/auth/google → createGoogleUser → return token
  OR
  GET /api/auth/google → passport.authenticate()
  → GET /api/auth/google/callback → redirect /dashboard
```

### Token & Session Management

**Token Storage Strategy:**
- Location: `localStorage['token']` (INSECURE - vulnerable to XSS)
- Format: JWT (Bearer token)
- Expiry: 7 days (server-side)
- Refresh: NONE (manual re-login required)

**Session Restoration:**
```typescript
// On app load via AuthContext
useEffect(() => {
  const storedToken = localStorage.getItem('token');
  const storedUser = localStorage.getItem('user');
  
  if (storedToken) {
    setToken(storedToken);
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    } else {
      getProfile(); // Fetch profile if missing
    }
  }
  setIsLoading(false);
}, []);
```

**Axios Interceptor:**
```typescript
// Request: Auto-attach token
interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response: Handle 401 on protected routes
interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !isAuthRequest) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login'; // Hard redirect
    }
    return Promise.reject(error);
  }
);
```

### Protected Routes
```typescript
// ProtectedRoute.tsx
if (isLoading) return <Loader />;
return user ? <>{children}</> : <Navigate to="/login" />;
```

### Current Auth Context (Status: PARTIALLY DISABLED)
- Most methods are commented out
- Fallback to basic fetch-based implementation in some places
- useAuth hook is the primary interface
- No error recovery for network failures

### Onboarding Flow
```
1. User lands on Landing.tsx (marketing site)
2. User clicks "Get Started" → Signup.tsx
3. Fill name, email, password
4. POST /api/auth/signup
5. Auto-logged in
6. Redirect to /wizard (Digital Twin Builder)
7. Fill detailed profile (identity, skills, experience, etc.)
8. POST /api/digital-twin/create
9. Redirect to /dashboard
10. View digital twin, see leads, manage profile
```

### Key Frontend Issues Identified

| Issue | Severity | Impact |
|-------|----------|---------|
| Token stored in localStorage | CRITICAL | XSS vulnerability, no CSRF protection |
| No refresh token mechanism | HIGH | User must re-login after 7 days |
| AuthContext partially commented | HIGH | Code maintainability, unclear intent |
| GoogleOAuth unfinished | HIGH | Google auth non-functional |
| No password reset UI/flow | MEDIUM | Users locked out if forgotten password |
| No email verification | MEDIUM | Spam/invalid emails possible |
| Hard redirect on 401 (losing context) | MEDIUM | Bad UX, state loss |
| No request retry logic | MEDIUM | Network hiccups = failed requests |
| Profile picture upload hardcoded URL | MEDIUM | Breaks with different API endpoints |
| No loading/error states in Dashboard | LOW | May seem frozen during loads |
| Axios base URL env var inconsistent | LOW | Frontend/backend URL mismatch risk |

### Strengths
✅ Modern React + TypeScript foundation
✅ Centralized API service layer (clean separation)
✅ Reusable shadcn/ui components
✅ Protected route abstraction
✅ Axios interceptor pattern
✅ React Query integration for data fetching
✅ Framer Motion for animations
✅ Type-safe with zod validation support

---

## 2. CURRENT BACKEND ARCHITECTURE

### Framework & Technology Stack
```
Node.js + Express.js 5.1.0 (modern version)
Database: MongoDB + Mongoose 8.19.2 (ES modules)
Authentication: Passport.js + JWT
File Upload: Multer
Password Security: bcryptjs
API Docs: None (manual implementation)
Environment: dotenv (but not fully used)
Error Handling: Custom middleware
```

### Project Structure
```
src/
├── server.js                  (Express app setup, middlewares, routes)
├── config/
│   ├── db.js                  (MongoDB connection)
│   └── passport.js            (Google OAuth strategy)
├── models/
│   ├── User.js                (User schema)
│   ├── DigitalTwin.js         (Digital twin schema - complex)
│   ├── Lead.js                (Lead tracking)
│   └── Message.js             (Chat messages - not analyzed)
├── controllers/
│   ├── authController.js      (Signup, login, Google auth)
│   ├── profileController.js   (Profile management, picture upload)
│   ├── digitalTwinController.js (Twin CRUD operations)
│   ├── chatController.js      (Chat operations)
│   └── leadController.js      (Lead CRUD operations)
├── middleware/
│   ├── authMiddleware.js      (JWT token verification)
│   ├── errorMiddleware.js     (Global error handler)
│   └── asyncHandler.js        (Async error wrapper)
├── routes/
│   ├── authRoutes.js          (Auth endpoints)
│   ├── digitalTwinRoutes.js   (Twin endpoints)
│   ├── chatRoutes.js          (Chat endpoints)
│   └── leadRoutes.js          (Lead endpoints)
├── services/
│   ├── authService.js         (Auth business logic)
│   ├── digitalTwinService.js  (Twin business logic)
│   ├── chatService.js         (Chat business logic)
│   └── leadService.js         (Lead business logic)
├── utils/
│   └── generateToken.js       (JWT token generation)
└── uploads/
    └── profile-pictures/      (File storage for profile pics)
```

### User Model (Current Schema)
```javascript
{
  name: String (required),
  email: String (required, unique),
  password: String (optional - for manual auth),
  googleId: String (optional - for Google auth),
  avatar: String (optional - from Google),
  profilePicture: String (optional - uploaded),
  timestamps: true
}
```

**Issues with User Model:**
- ❌ No `provider` field (can't track auth method)
- ❌ No `emailVerified` field (no email verification)
- ❌ No `lastLogin` tracking
- ❌ No `isActive` flag (no soft deletes)
- ❌ No `refreshToken` storage (no refresh mechanism)
- ❌ Both `password` and `googleId` optional (allows creating invalid users)
- ⚠️ `profilePicture` and `avatar` are separate (confusion)

### Digital Twin Model (Current)
```javascript
{
  user: ObjectId (ref: User, required, unique per user),
  identity: {
    name: String,
    role: String,
    tagline: String,
    bio: String
  },
  businesses: [
    {
      name: String,
      role: String,
      description: String,
      link: String,
      products: [String],
      duration: String
    }
  ],
  experience: [
    {
      company: String,
      role: String,
      duration: String,
      key_projects: [String]
    }
  ],
  education: [
    {
      institution: String,
      degree: String,
      year: String
    }
  ],
  skills: {
    list: [String],
    coreDomains: String,
    signatureStrengths: String
  },
  personality: {
    traits: [String],
    leadership_style: String,
    decision_style: String,
    tone: String,
    archetype: String,
    values: [String]
  },
  story: {
    mission: String,
    impact: String,
    themes: [String]
  },
  networking: {
    audience: String,
    intent: String,
    boundaries: [String]
  },
  links: {
    linkedin: String,
    website: String,
    portfolio: String,
    socials: [String]
  },
  isActive: Boolean (default: true),
  lastUpdated: Date,
  timestamps: true,
  indexes: [user, text search on identity]
}
```

✅ Well-designed schema for digital twin profiles
✅ Good separation of concerns (identity, skills, personality, etc.)
✅ Text search indexes for discovery
⚠️ No versioning/history tracking
⚠️ No public/private field separation (all data treated as public on /public/:twinId)

### Authentication Flow (Backend)

#### SIGNUP Flow
```javascript
// POST /api/auth/signup
{
  name, email, password
} 
  ↓
authService.register()
  - Check user exists (findOne)
  - Hash password (bcryptjs)
  - Create user
  - Generate JWT token (7d expiry)
  - Return { user, token }
```

#### LOGIN Flow
```javascript
// POST /api/auth/login
{
  email, password
}
  ↓
authService.login()
  - Find user by email
  - Verify password (bcryptjs compare)
  - Generate JWT token
  - Return { user, token }
```

#### GOOGLE AUTH (REST Endpoint)
```javascript
// POST /api/auth/google
{
  googleId, name, email, avatar
}
  ↓
authService.googleLogin()
  - Find user by email (⚠️ CRITICAL: searches by email, not googleId!)
  - If not found, create with googleId, name, email, avatar
  - Generate JWT token
  - Return { user, token }
```

#### GOOGLE AUTH (Passport Flow - INCOMPLETE)
```javascript
// GET /api/auth/google
  ↓
passport.authenticate('google', { scope: ['profile', 'email'] })
  ↓
// User logs in on Google
  ↓
// GET /api/auth/google/callback
  ↓
GoogleStrategy callback:
  - Extract: id, displayName, emails, photos
  - Find user by googleId
  - If not found, create user
  - Serialize user session
  ↓
Redirect to CLIENT_URL/dashboard
```

### Token Generation & Verification

**Generate:**
```javascript
jwt.sign(
  { id: userId },
  process.env.JWT_SECRET,
  { expiresIn: "7d" }
)
```

**Verify (in protect middleware):**
```javascript
// Bearer token in Authorization header
const token = req.headers.authorization.split(" ")[1];
const decoded = jwt.verify(token, process.env.JWT_SECRET);
req.user = User.findById(decoded.id).select("-password");
```

**Issues:**
- ❌ No refresh token mechanism
- ❌ JWT_SECRET must be strong (not validated in code)
- ❌ No token rotation
- ❌ No token blacklist for logout
- ❌ 7-day expiry may be too long for sensitive operations

### Middleware Stack

**Order in server.js:**
1. `express.json()` - Body parser
2. `cookieParser()` - Cookie parsing
3. `cors()` - CORS handling (origin checking, credentials)
4. `express.static(/uploads)` - Static file serving
5. `passport.initialize()` - Passport setup
6. `passport.session()` - Session management
7. Routes
8. `errorHandler` - Global error handler

**CORS Configuration:**
```javascript
const allowedOrigins = [
  process.env.CLIENT_URL,
  "https://digitaltwin.techtrekkers.ai"
];

const isLocalFrontend = /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);

cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || isLocalFrontend(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true
})
```

**Issues:**
- ⚠️ Relies on `process.env.CLIENT_URL` being set (may not be in dev)
- ⚠️ Loose CORS on localhost (dangerous in production if not careful)
- ✅ Credentials allowed (needed for cookies)

### Auth Middleware
```javascript
// protect middleware (very basic)
export const protect = async (req, res, next) => {
  let token;
  
  if (req.headers.authorization?.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select("-password");
      next();
    } catch (err) {
      res.status(401).json({ message: "Not authorized, token failed" });
    }
  }
  
  if (!token) {
    res.status(401).json({ message: "Not authorized, no token" });
  }
};
```

**Issues:**
- ❌ No checks for revoked/blacklisted tokens
- ❌ No token expiry verification (JWT lib handles it, but no custom logic)
- ❌ User.
```


## License: unknown
https://github.com/BhargovJD/React-2021/blob/561058e6d7880040f0d5cf1f1c63758f6b13db4a/32%20MernStack/DigitalDiaryApp/backend/middlewares/auth-middleware.js

```
Now I'll generate a comprehensive architecture audit. Based on my deep analysis of both frontend and backend code, here's the complete assessment:

---

# ARCHITECTURE AUDIT: DIGITAL TWIN PLATFORM
## Production-Grade Pre-Implementation Review

---

## EXECUTIVE SUMMARY

This is a **user-centric SaaS platform** with:
- **Manual authentication** (email/password) + **REST-based Google OAuth**
- **React 18 + TypeScript frontend** with shadcn/ui component library
- **Express.js backend** with MongoDB + Mongoose ORM
- **JWT token-based auth** (7-day expiry) with localStorage persistence
- **Per-user digital twin profiles** with complex nested data structures
- **Lead tracking system** for business intelligence

### Current Auth Status: **FUNCTIONAL BUT INCOMPLETE**
- Manual signup/login flows are implemented
- Google OAuth foundation exists but frontend implementation is commented out
- No refresh token mechanism
- No password reset flow
- No email verification

---

## 1. CURRENT FRONTEND ARCHITECTURE

### Framework & Tooling
```
React 18.3.1 + TypeScript + Vite (module-based)
Build Tool: Vite with React SWC plugin
Styling: Tailwind CSS + shadcn/ui components
State Management: React Context API + TanStack React Query
HTTP Client: Axios with interceptors
Routing: React Router v6.30.2
Animation: Framer Motion + GSAP
```

### Project Structure
```
src/
├── pages/
│   ├── Login.tsx              (Email/password login form)
│   ├── Signup.tsx             (Email/password signup form)
│   ├── Dashboard.tsx          (User dashboard with twins & leads)
│   ├── Chatbot.tsx            (Chat interface for digital twins)
│   ├── Index.tsx              (Digital twin wizard/builder)
│   ├── Landing.tsx            (Marketing landing page)
│   └── LandingPages/          (Landing page variants)
├── components/
│   ├── GoogleOAuth.tsx        (INCOMPLETE - Google auth component)
│   ├── DigitalTwinWizard.tsx (Wizard for creating twins)
│   └── ui/                    (Reusable shadcn/ui components)
├── contexts/
│   ├── AuthContext.tsx        (PARTIALLY COMMENTED OUT)
│   ├── DigitalTwinContext.tsx (Digital twin state management)
│   └── ProtectedRoute.tsx     (Route protection wrapper)
├── services/
│   └── api.service.ts         (Centralized API calls)
├── hooks/
│   ├── use-mobile.tsx
│   └── use-toast.ts
├── lib/
│   └── utils.ts
├── types/
│   └── digitalTwin.ts
└── axios.config.ts            (Axios instance with interceptors)
```

### Authentication Flow (Current)

#### SIGNUP Flow
```
User Input (name, email, password, confirm password)
  ↓
useAuth.signup() via AuthContext
  ↓
POST /api/auth/signup (email, password)
  ↓
Response: { user, token }
  ↓
Store: localStorage['token'] + localStorage['user']
  ↓
Update: AuthContext state
  ↓
Navigate: /wizard (digital twin builder)
```

#### LOGIN Flow
```
User Input (email, password)
  ↓
useAuth.login() via AuthContext
  ↓
POST /api/auth/login (email, password)
  ↓
Response: { user, token }
  ↓
Store: localStorage['token'] + localStorage['user']
  ↓
Update: AuthContext state
  ↓
Navigate: /dashboard
```

#### GOOGLE AUTH Flow (INCOMPLETE/COMMENTED)
```
Frontend attempts to:
1. Load Google API (window.google)
2. Initialize Google OAuth2 with client ID
3. Show One Tap UI or redirect to passport flow
4. Parse JWT credential
5. POST /api/auth/google with parsed data

Backend:
  POST /api/auth/google → createGoogleUser → return token
  OR
  GET /api/auth/google → passport.authenticate()
  → GET /api/auth/google/callback → redirect /dashboard
```

### Token & Session Management

**Token Storage Strategy:**
- Location: `localStorage['token']` (INSECURE - vulnerable to XSS)
- Format: JWT (Bearer token)
- Expiry: 7 days (server-side)
- Refresh: NONE (manual re-login required)

**Session Restoration:**
```typescript
// On app load via AuthContext
useEffect(() => {
  const storedToken = localStorage.getItem('token');
  const storedUser = localStorage.getItem('user');
  
  if (storedToken) {
    setToken(storedToken);
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    } else {
      getProfile(); // Fetch profile if missing
    }
  }
  setIsLoading(false);
}, []);
```

**Axios Interceptor:**
```typescript
// Request: Auto-attach token
interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response: Handle 401 on protected routes
interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !isAuthRequest) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login'; // Hard redirect
    }
    return Promise.reject(error);
  }
);
```

### Protected Routes
```typescript
// ProtectedRoute.tsx
if (isLoading) return <Loader />;
return user ? <>{children}</> : <Navigate to="/login" />;
```

### Current Auth Context (Status: PARTIALLY DISABLED)
- Most methods are commented out
- Fallback to basic fetch-based implementation in some places
- useAuth hook is the primary interface
- No error recovery for network failures

### Onboarding Flow
```
1. User lands on Landing.tsx (marketing site)
2. User clicks "Get Started" → Signup.tsx
3. Fill name, email, password
4. POST /api/auth/signup
5. Auto-logged in
6. Redirect to /wizard (Digital Twin Builder)
7. Fill detailed profile (identity, skills, experience, etc.)
8. POST /api/digital-twin/create
9. Redirect to /dashboard
10. View digital twin, see leads, manage profile
```

### Key Frontend Issues Identified

| Issue | Severity | Impact |
|-------|----------|---------|
| Token stored in localStorage | CRITICAL | XSS vulnerability, no CSRF protection |
| No refresh token mechanism | HIGH | User must re-login after 7 days |
| AuthContext partially commented | HIGH | Code maintainability, unclear intent |
| GoogleOAuth unfinished | HIGH | Google auth non-functional |
| No password reset UI/flow | MEDIUM | Users locked out if forgotten password |
| No email verification | MEDIUM | Spam/invalid emails possible |
| Hard redirect on 401 (losing context) | MEDIUM | Bad UX, state loss |
| No request retry logic | MEDIUM | Network hiccups = failed requests |
| Profile picture upload hardcoded URL | MEDIUM | Breaks with different API endpoints |
| No loading/error states in Dashboard | LOW | May seem frozen during loads |
| Axios base URL env var inconsistent | LOW | Frontend/backend URL mismatch risk |

### Strengths
✅ Modern React + TypeScript foundation
✅ Centralized API service layer (clean separation)
✅ Reusable shadcn/ui components
✅ Protected route abstraction
✅ Axios interceptor pattern
✅ React Query integration for data fetching
✅ Framer Motion for animations
✅ Type-safe with zod validation support

---

## 2. CURRENT BACKEND ARCHITECTURE

### Framework & Technology Stack
```
Node.js + Express.js 5.1.0 (modern version)
Database: MongoDB + Mongoose 8.19.2 (ES modules)
Authentication: Passport.js + JWT
File Upload: Multer
Password Security: bcryptjs
API Docs: None (manual implementation)
Environment: dotenv (but not fully used)
Error Handling: Custom middleware
```

### Project Structure
```
src/
├── server.js                  (Express app setup, middlewares, routes)
├── config/
│   ├── db.js                  (MongoDB connection)
│   └── passport.js            (Google OAuth strategy)
├── models/
│   ├── User.js                (User schema)
│   ├── DigitalTwin.js         (Digital twin schema - complex)
│   ├── Lead.js                (Lead tracking)
│   └── Message.js             (Chat messages - not analyzed)
├── controllers/
│   ├── authController.js      (Signup, login, Google auth)
│   ├── profileController.js   (Profile management, picture upload)
│   ├── digitalTwinController.js (Twin CRUD operations)
│   ├── chatController.js      (Chat operations)
│   └── leadController.js      (Lead CRUD operations)
├── middleware/
│   ├── authMiddleware.js      (JWT token verification)
│   ├── errorMiddleware.js     (Global error handler)
│   └── asyncHandler.js        (Async error wrapper)
├── routes/
│   ├── authRoutes.js          (Auth endpoints)
│   ├── digitalTwinRoutes.js   (Twin endpoints)
│   ├── chatRoutes.js          (Chat endpoints)
│   └── leadRoutes.js          (Lead endpoints)
├── services/
│   ├── authService.js         (Auth business logic)
│   ├── digitalTwinService.js  (Twin business logic)
│   ├── chatService.js         (Chat business logic)
│   └── leadService.js         (Lead business logic)
├── utils/
│   └── generateToken.js       (JWT token generation)
└── uploads/
    └── profile-pictures/      (File storage for profile pics)
```

### User Model (Current Schema)
```javascript
{
  name: String (required),
  email: String (required, unique),
  password: String (optional - for manual auth),
  googleId: String (optional - for Google auth),
  avatar: String (optional - from Google),
  profilePicture: String (optional - uploaded),
  timestamps: true
}
```

**Issues with User Model:**
- ❌ No `provider` field (can't track auth method)
- ❌ No `emailVerified` field (no email verification)
- ❌ No `lastLogin` tracking
- ❌ No `isActive` flag (no soft deletes)
- ❌ No `refreshToken` storage (no refresh mechanism)
- ❌ Both `password` and `googleId` optional (allows creating invalid users)
- ⚠️ `profilePicture` and `avatar` are separate (confusion)

### Digital Twin Model (Current)
```javascript
{
  user: ObjectId (ref: User, required, unique per user),
  identity: {
    name: String,
    role: String,
    tagline: String,
    bio: String
  },
  businesses: [
    {
      name: String,
      role: String,
      description: String,
      link: String,
      products: [String],
      duration: String
    }
  ],
  experience: [
    {
      company: String,
      role: String,
      duration: String,
      key_projects: [String]
    }
  ],
  education: [
    {
      institution: String,
      degree: String,
      year: String
    }
  ],
  skills: {
    list: [String],
    coreDomains: String,
    signatureStrengths: String
  },
  personality: {
    traits: [String],
    leadership_style: String,
    decision_style: String,
    tone: String,
    archetype: String,
    values: [String]
  },
  story: {
    mission: String,
    impact: String,
    themes: [String]
  },
  networking: {
    audience: String,
    intent: String,
    boundaries: [String]
  },
  links: {
    linkedin: String,
    website: String,
    portfolio: String,
    socials: [String]
  },
  isActive: Boolean (default: true),
  lastUpdated: Date,
  timestamps: true,
  indexes: [user, text search on identity]
}
```

✅ Well-designed schema for digital twin profiles
✅ Good separation of concerns (identity, skills, personality, etc.)
✅ Text search indexes for discovery
⚠️ No versioning/history tracking
⚠️ No public/private field separation (all data treated as public on /public/:twinId)

### Authentication Flow (Backend)

#### SIGNUP Flow
```javascript
// POST /api/auth/signup
{
  name, email, password
} 
  ↓
authService.register()
  - Check user exists (findOne)
  - Hash password (bcryptjs)
  - Create user
  - Generate JWT token (7d expiry)
  - Return { user, token }
```

#### LOGIN Flow
```javascript
// POST /api/auth/login
{
  email, password
}
  ↓
authService.login()
  - Find user by email
  - Verify password (bcryptjs compare)
  - Generate JWT token
  - Return { user, token }
```

#### GOOGLE AUTH (REST Endpoint)
```javascript
// POST /api/auth/google
{
  googleId, name, email, avatar
}
  ↓
authService.googleLogin()
  - Find user by email (⚠️ CRITICAL: searches by email, not googleId!)
  - If not found, create with googleId, name, email, avatar
  - Generate JWT token
  - Return { user, token }
```

#### GOOGLE AUTH (Passport Flow - INCOMPLETE)
```javascript
// GET /api/auth/google
  ↓
passport.authenticate('google', { scope: ['profile', 'email'] })
  ↓
// User logs in on Google
  ↓
// GET /api/auth/google/callback
  ↓
GoogleStrategy callback:
  - Extract: id, displayName, emails, photos
  - Find user by googleId
  - If not found, create user
  - Serialize user session
  ↓
Redirect to CLIENT_URL/dashboard
```

### Token Generation & Verification

**Generate:**
```javascript
jwt.sign(
  { id: userId },
  process.env.JWT_SECRET,
  { expiresIn: "7d" }
)
```

**Verify (in protect middleware):**
```javascript
// Bearer token in Authorization header
const token = req.headers.authorization.split(" ")[1];
const decoded = jwt.verify(token, process.env.JWT_SECRET);
req.user = User.findById(decoded.id).select("-password");
```

**Issues:**
- ❌ No refresh token mechanism
- ❌ JWT_SECRET must be strong (not validated in code)
- ❌ No token rotation
- ❌ No token blacklist for logout
- ❌ 7-day expiry may be too long for sensitive operations

### Middleware Stack

**Order in server.js:**
1. `express.json()` - Body parser
2. `cookieParser()` - Cookie parsing
3. `cors()` - CORS handling (origin checking, credentials)
4. `express.static(/uploads)` - Static file serving
5. `passport.initialize()` - Passport setup
6. `passport.session()` - Session management
7. Routes
8. `errorHandler` - Global error handler

**CORS Configuration:**
```javascript
const allowedOrigins = [
  process.env.CLIENT_URL,
  "https://digitaltwin.techtrekkers.ai"
];

const isLocalFrontend = /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);

cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || isLocalFrontend(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true
})
```

**Issues:**
- ⚠️ Relies on `process.env.CLIENT_URL` being set (may not be in dev)
- ⚠️ Loose CORS on localhost (dangerous in production if not careful)
- ✅ Credentials allowed (needed for cookies)

### Auth Middleware
```javascript
// protect middleware (very basic)
export const protect = async (req, res, next) => {
  let token;
  
  if (req.headers.authorization?.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select("-password");
      next();
    } catch (err) {
      res.status(401).json({ message: "Not authorized, token failed" });
    }
  }
  
  if (!token) {
    res.status(401).json({ message: "Not authorized, no token" });
  }
};
```

**Issues:**
- ❌ No checks for revoked/blacklisted tokens
- ❌ No token expiry verification (JWT lib handles it, but no custom logic)
- ❌ User.
```


## License: unknown
https://github.com/devastion/tmdb-api-use/blob/22998f24ac5a464ecb9d76cbc6e735b3eba07cd5/server/middleware/authMiddleware.js

```
Now I'll generate a comprehensive architecture audit. Based on my deep analysis of both frontend and backend code, here's the complete assessment:

---

# ARCHITECTURE AUDIT: DIGITAL TWIN PLATFORM
## Production-Grade Pre-Implementation Review

---

## EXECUTIVE SUMMARY

This is a **user-centric SaaS platform** with:
- **Manual authentication** (email/password) + **REST-based Google OAuth**
- **React 18 + TypeScript frontend** with shadcn/ui component library
- **Express.js backend** with MongoDB + Mongoose ORM
- **JWT token-based auth** (7-day expiry) with localStorage persistence
- **Per-user digital twin profiles** with complex nested data structures
- **Lead tracking system** for business intelligence

### Current Auth Status: **FUNCTIONAL BUT INCOMPLETE**
- Manual signup/login flows are implemented
- Google OAuth foundation exists but frontend implementation is commented out
- No refresh token mechanism
- No password reset flow
- No email verification

---

## 1. CURRENT FRONTEND ARCHITECTURE

### Framework & Tooling
```
React 18.3.1 + TypeScript + Vite (module-based)
Build Tool: Vite with React SWC plugin
Styling: Tailwind CSS + shadcn/ui components
State Management: React Context API + TanStack React Query
HTTP Client: Axios with interceptors
Routing: React Router v6.30.2
Animation: Framer Motion + GSAP
```

### Project Structure
```
src/
├── pages/
│   ├── Login.tsx              (Email/password login form)
│   ├── Signup.tsx             (Email/password signup form)
│   ├── Dashboard.tsx          (User dashboard with twins & leads)
│   ├── Chatbot.tsx            (Chat interface for digital twins)
│   ├── Index.tsx              (Digital twin wizard/builder)
│   ├── Landing.tsx            (Marketing landing page)
│   └── LandingPages/          (Landing page variants)
├── components/
│   ├── GoogleOAuth.tsx        (INCOMPLETE - Google auth component)
│   ├── DigitalTwinWizard.tsx (Wizard for creating twins)
│   └── ui/                    (Reusable shadcn/ui components)
├── contexts/
│   ├── AuthContext.tsx        (PARTIALLY COMMENTED OUT)
│   ├── DigitalTwinContext.tsx (Digital twin state management)
│   └── ProtectedRoute.tsx     (Route protection wrapper)
├── services/
│   └── api.service.ts         (Centralized API calls)
├── hooks/
│   ├── use-mobile.tsx
│   └── use-toast.ts
├── lib/
│   └── utils.ts
├── types/
│   └── digitalTwin.ts
└── axios.config.ts            (Axios instance with interceptors)
```

### Authentication Flow (Current)

#### SIGNUP Flow
```
User Input (name, email, password, confirm password)
  ↓
useAuth.signup() via AuthContext
  ↓
POST /api/auth/signup (email, password)
  ↓
Response: { user, token }
  ↓
Store: localStorage['token'] + localStorage['user']
  ↓
Update: AuthContext state
  ↓
Navigate: /wizard (digital twin builder)
```

#### LOGIN Flow
```
User Input (email, password)
  ↓
useAuth.login() via AuthContext
  ↓
POST /api/auth/login (email, password)
  ↓
Response: { user, token }
  ↓
Store: localStorage['token'] + localStorage['user']
  ↓
Update: AuthContext state
  ↓
Navigate: /dashboard
```

#### GOOGLE AUTH Flow (INCOMPLETE/COMMENTED)
```
Frontend attempts to:
1. Load Google API (window.google)
2. Initialize Google OAuth2 with client ID
3. Show One Tap UI or redirect to passport flow
4. Parse JWT credential
5. POST /api/auth/google with parsed data

Backend:
  POST /api/auth/google → createGoogleUser → return token
  OR
  GET /api/auth/google → passport.authenticate()
  → GET /api/auth/google/callback → redirect /dashboard
```

### Token & Session Management

**Token Storage Strategy:**
- Location: `localStorage['token']` (INSECURE - vulnerable to XSS)
- Format: JWT (Bearer token)
- Expiry: 7 days (server-side)
- Refresh: NONE (manual re-login required)

**Session Restoration:**
```typescript
// On app load via AuthContext
useEffect(() => {
  const storedToken = localStorage.getItem('token');
  const storedUser = localStorage.getItem('user');
  
  if (storedToken) {
    setToken(storedToken);
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    } else {
      getProfile(); // Fetch profile if missing
    }
  }
  setIsLoading(false);
}, []);
```

**Axios Interceptor:**
```typescript
// Request: Auto-attach token
interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response: Handle 401 on protected routes
interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !isAuthRequest) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login'; // Hard redirect
    }
    return Promise.reject(error);
  }
);
```

### Protected Routes
```typescript
// ProtectedRoute.tsx
if (isLoading) return <Loader />;
return user ? <>{children}</> : <Navigate to="/login" />;
```

### Current Auth Context (Status: PARTIALLY DISABLED)
- Most methods are commented out
- Fallback to basic fetch-based implementation in some places
- useAuth hook is the primary interface
- No error recovery for network failures

### Onboarding Flow
```
1. User lands on Landing.tsx (marketing site)
2. User clicks "Get Started" → Signup.tsx
3. Fill name, email, password
4. POST /api/auth/signup
5. Auto-logged in
6. Redirect to /wizard (Digital Twin Builder)
7. Fill detailed profile (identity, skills, experience, etc.)
8. POST /api/digital-twin/create
9. Redirect to /dashboard
10. View digital twin, see leads, manage profile
```

### Key Frontend Issues Identified

| Issue | Severity | Impact |
|-------|----------|---------|
| Token stored in localStorage | CRITICAL | XSS vulnerability, no CSRF protection |
| No refresh token mechanism | HIGH | User must re-login after 7 days |
| AuthContext partially commented | HIGH | Code maintainability, unclear intent |
| GoogleOAuth unfinished | HIGH | Google auth non-functional |
| No password reset UI/flow | MEDIUM | Users locked out if forgotten password |
| No email verification | MEDIUM | Spam/invalid emails possible |
| Hard redirect on 401 (losing context) | MEDIUM | Bad UX, state loss |
| No request retry logic | MEDIUM | Network hiccups = failed requests |
| Profile picture upload hardcoded URL | MEDIUM | Breaks with different API endpoints |
| No loading/error states in Dashboard | LOW | May seem frozen during loads |
| Axios base URL env var inconsistent | LOW | Frontend/backend URL mismatch risk |

### Strengths
✅ Modern React + TypeScript foundation
✅ Centralized API service layer (clean separation)
✅ Reusable shadcn/ui components
✅ Protected route abstraction
✅ Axios interceptor pattern
✅ React Query integration for data fetching
✅ Framer Motion for animations
✅ Type-safe with zod validation support

---

## 2. CURRENT BACKEND ARCHITECTURE

### Framework & Technology Stack
```
Node.js + Express.js 5.1.0 (modern version)
Database: MongoDB + Mongoose 8.19.2 (ES modules)
Authentication: Passport.js + JWT
File Upload: Multer
Password Security: bcryptjs
API Docs: None (manual implementation)
Environment: dotenv (but not fully used)
Error Handling: Custom middleware
```

### Project Structure
```
src/
├── server.js                  (Express app setup, middlewares, routes)
├── config/
│   ├── db.js                  (MongoDB connection)
│   └── passport.js            (Google OAuth strategy)
├── models/
│   ├── User.js                (User schema)
│   ├── DigitalTwin.js         (Digital twin schema - complex)
│   ├── Lead.js                (Lead tracking)
│   └── Message.js             (Chat messages - not analyzed)
├── controllers/
│   ├── authController.js      (Signup, login, Google auth)
│   ├── profileController.js   (Profile management, picture upload)
│   ├── digitalTwinController.js (Twin CRUD operations)
│   ├── chatController.js      (Chat operations)
│   └── leadController.js      (Lead CRUD operations)
├── middleware/
│   ├── authMiddleware.js      (JWT token verification)
│   ├── errorMiddleware.js     (Global error handler)
│   └── asyncHandler.js        (Async error wrapper)
├── routes/
│   ├── authRoutes.js          (Auth endpoints)
│   ├── digitalTwinRoutes.js   (Twin endpoints)
│   ├── chatRoutes.js          (Chat endpoints)
│   └── leadRoutes.js          (Lead endpoints)
├── services/
│   ├── authService.js         (Auth business logic)
│   ├── digitalTwinService.js  (Twin business logic)
│   ├── chatService.js         (Chat business logic)
│   └── leadService.js         (Lead business logic)
├── utils/
│   └── generateToken.js       (JWT token generation)
└── uploads/
    └── profile-pictures/      (File storage for profile pics)
```

### User Model (Current Schema)
```javascript
{
  name: String (required),
  email: String (required, unique),
  password: String (optional - for manual auth),
  googleId: String (optional - for Google auth),
  avatar: String (optional - from Google),
  profilePicture: String (optional - uploaded),
  timestamps: true
}
```

**Issues with User Model:**
- ❌ No `provider` field (can't track auth method)
- ❌ No `emailVerified` field (no email verification)
- ❌ No `lastLogin` tracking
- ❌ No `isActive` flag (no soft deletes)
- ❌ No `refreshToken` storage (no refresh mechanism)
- ❌ Both `password` and `googleId` optional (allows creating invalid users)
- ⚠️ `profilePicture` and `avatar` are separate (confusion)

### Digital Twin Model (Current)
```javascript
{
  user: ObjectId (ref: User, required, unique per user),
  identity: {
    name: String,
    role: String,
    tagline: String,
    bio: String
  },
  businesses: [
    {
      name: String,
      role: String,
      description: String,
      link: String,
      products: [String],
      duration: String
    }
  ],
  experience: [
    {
      company: String,
      role: String,
      duration: String,
      key_projects: [String]
    }
  ],
  education: [
    {
      institution: String,
      degree: String,
      year: String
    }
  ],
  skills: {
    list: [String],
    coreDomains: String,
    signatureStrengths: String
  },
  personality: {
    traits: [String],
    leadership_style: String,
    decision_style: String,
    tone: String,
    archetype: String,
    values: [String]
  },
  story: {
    mission: String,
    impact: String,
    themes: [String]
  },
  networking: {
    audience: String,
    intent: String,
    boundaries: [String]
  },
  links: {
    linkedin: String,
    website: String,
    portfolio: String,
    socials: [String]
  },
  isActive: Boolean (default: true),
  lastUpdated: Date,
  timestamps: true,
  indexes: [user, text search on identity]
}
```

✅ Well-designed schema for digital twin profiles
✅ Good separation of concerns (identity, skills, personality, etc.)
✅ Text search indexes for discovery
⚠️ No versioning/history tracking
⚠️ No public/private field separation (all data treated as public on /public/:twinId)

### Authentication Flow (Backend)

#### SIGNUP Flow
```javascript
// POST /api/auth/signup
{
  name, email, password
} 
  ↓
authService.register()
  - Check user exists (findOne)
  - Hash password (bcryptjs)
  - Create user
  - Generate JWT token (7d expiry)
  - Return { user, token }
```

#### LOGIN Flow
```javascript
// POST /api/auth/login
{
  email, password
}
  ↓
authService.login()
  - Find user by email
  - Verify password (bcryptjs compare)
  - Generate JWT token
  - Return { user, token }
```

#### GOOGLE AUTH (REST Endpoint)
```javascript
// POST /api/auth/google
{
  googleId, name, email, avatar
}
  ↓
authService.googleLogin()
  - Find user by email (⚠️ CRITICAL: searches by email, not googleId!)
  - If not found, create with googleId, name, email, avatar
  - Generate JWT token
  - Return { user, token }
```

#### GOOGLE AUTH (Passport Flow - INCOMPLETE)
```javascript
// GET /api/auth/google
  ↓
passport.authenticate('google', { scope: ['profile', 'email'] })
  ↓
// User logs in on Google
  ↓
// GET /api/auth/google/callback
  ↓
GoogleStrategy callback:
  - Extract: id, displayName, emails, photos
  - Find user by googleId
  - If not found, create user
  - Serialize user session
  ↓
Redirect to CLIENT_URL/dashboard
```

### Token Generation & Verification

**Generate:**
```javascript
jwt.sign(
  { id: userId },
  process.env.JWT_SECRET,
  { expiresIn: "7d" }
)
```

**Verify (in protect middleware):**
```javascript
// Bearer token in Authorization header
const token = req.headers.authorization.split(" ")[1];
const decoded = jwt.verify(token, process.env.JWT_SECRET);
req.user = User.findById(decoded.id).select("-password");
```

**Issues:**
- ❌ No refresh token mechanism
- ❌ JWT_SECRET must be strong (not validated in code)
- ❌ No token rotation
- ❌ No token blacklist for logout
- ❌ 7-day expiry may be too long for sensitive operations

### Middleware Stack

**Order in server.js:**
1. `express.json()` - Body parser
2. `cookieParser()` - Cookie parsing
3. `cors()` - CORS handling (origin checking, credentials)
4. `express.static(/uploads)` - Static file serving
5. `passport.initialize()` - Passport setup
6. `passport.session()` - Session management
7. Routes
8. `errorHandler` - Global error handler

**CORS Configuration:**
```javascript
const allowedOrigins = [
  process.env.CLIENT_URL,
  "https://digitaltwin.techtrekkers.ai"
];

const isLocalFrontend = /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);

cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || isLocalFrontend(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true
})
```

**Issues:**
- ⚠️ Relies on `process.env.CLIENT_URL` being set (may not be in dev)
- ⚠️ Loose CORS on localhost (dangerous in production if not careful)
- ✅ Credentials allowed (needed for cookies)

### Auth Middleware
```javascript
// protect middleware (very basic)
export const protect = async (req, res, next) => {
  let token;
  
  if (req.headers.authorization?.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select("-password");
      next();
    } catch (err) {
      res.status(401).json({ message: "Not authorized, token failed" });
    }
  }
  
  if (!token) {
    res.status(401).json({ message: "Not authorized, no token" });
  }
};
```

**Issues:**
- ❌ No checks for revoked/blacklisted tokens
- ❌ No token expiry verification (JWT lib handles it, but no custom logic)
- ❌ User.
```


## License: unknown
https://github.com/iamnishantgarg/Shopee/blob/d9b6055bee263b3444c5b9920a480dce1e577e7f/middleware/authMiddleware.js

```
Now I'll generate a comprehensive architecture audit. Based on my deep analysis of both frontend and backend code, here's the complete assessment:

---

# ARCHITECTURE AUDIT: DIGITAL TWIN PLATFORM
## Production-Grade Pre-Implementation Review

---

## EXECUTIVE SUMMARY

This is a **user-centric SaaS platform** with:
- **Manual authentication** (email/password) + **REST-based Google OAuth**
- **React 18 + TypeScript frontend** with shadcn/ui component library
- **Express.js backend** with MongoDB + Mongoose ORM
- **JWT token-based auth** (7-day expiry) with localStorage persistence
- **Per-user digital twin profiles** with complex nested data structures
- **Lead tracking system** for business intelligence

### Current Auth Status: **FUNCTIONAL BUT INCOMPLETE**
- Manual signup/login flows are implemented
- Google OAuth foundation exists but frontend implementation is commented out
- No refresh token mechanism
- No password reset flow
- No email verification

---

## 1. CURRENT FRONTEND ARCHITECTURE

### Framework & Tooling
```
React 18.3.1 + TypeScript + Vite (module-based)
Build Tool: Vite with React SWC plugin
Styling: Tailwind CSS + shadcn/ui components
State Management: React Context API + TanStack React Query
HTTP Client: Axios with interceptors
Routing: React Router v6.30.2
Animation: Framer Motion + GSAP
```

### Project Structure
```
src/
├── pages/
│   ├── Login.tsx              (Email/password login form)
│   ├── Signup.tsx             (Email/password signup form)
│   ├── Dashboard.tsx          (User dashboard with twins & leads)
│   ├── Chatbot.tsx            (Chat interface for digital twins)
│   ├── Index.tsx              (Digital twin wizard/builder)
│   ├── Landing.tsx            (Marketing landing page)
│   └── LandingPages/          (Landing page variants)
├── components/
│   ├── GoogleOAuth.tsx        (INCOMPLETE - Google auth component)
│   ├── DigitalTwinWizard.tsx (Wizard for creating twins)
│   └── ui/                    (Reusable shadcn/ui components)
├── contexts/
│   ├── AuthContext.tsx        (PARTIALLY COMMENTED OUT)
│   ├── DigitalTwinContext.tsx (Digital twin state management)
│   └── ProtectedRoute.tsx     (Route protection wrapper)
├── services/
│   └── api.service.ts         (Centralized API calls)
├── hooks/
│   ├── use-mobile.tsx
│   └── use-toast.ts
├── lib/
│   └── utils.ts
├── types/
│   └── digitalTwin.ts
└── axios.config.ts            (Axios instance with interceptors)
```

### Authentication Flow (Current)

#### SIGNUP Flow
```
User Input (name, email, password, confirm password)
  ↓
useAuth.signup() via AuthContext
  ↓
POST /api/auth/signup (email, password)
  ↓
Response: { user, token }
  ↓
Store: localStorage['token'] + localStorage['user']
  ↓
Update: AuthContext state
  ↓
Navigate: /wizard (digital twin builder)
```

#### LOGIN Flow
```
User Input (email, password)
  ↓
useAuth.login() via AuthContext
  ↓
POST /api/auth/login (email, password)
  ↓
Response: { user, token }
  ↓
Store: localStorage['token'] + localStorage['user']
  ↓
Update: AuthContext state
  ↓
Navigate: /dashboard
```

#### GOOGLE AUTH Flow (INCOMPLETE/COMMENTED)
```
Frontend attempts to:
1. Load Google API (window.google)
2. Initialize Google OAuth2 with client ID
3. Show One Tap UI or redirect to passport flow
4. Parse JWT credential
5. POST /api/auth/google with parsed data

Backend:
  POST /api/auth/google → createGoogleUser → return token
  OR
  GET /api/auth/google → passport.authenticate()
  → GET /api/auth/google/callback → redirect /dashboard
```

### Token & Session Management

**Token Storage Strategy:**
- Location: `localStorage['token']` (INSECURE - vulnerable to XSS)
- Format: JWT (Bearer token)
- Expiry: 7 days (server-side)
- Refresh: NONE (manual re-login required)

**Session Restoration:**
```typescript
// On app load via AuthContext
useEffect(() => {
  const storedToken = localStorage.getItem('token');
  const storedUser = localStorage.getItem('user');
  
  if (storedToken) {
    setToken(storedToken);
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    } else {
      getProfile(); // Fetch profile if missing
    }
  }
  setIsLoading(false);
}, []);
```

**Axios Interceptor:**
```typescript
// Request: Auto-attach token
interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response: Handle 401 on protected routes
interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !isAuthRequest) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login'; // Hard redirect
    }
    return Promise.reject(error);
  }
);
```

### Protected Routes
```typescript
// ProtectedRoute.tsx
if (isLoading) return <Loader />;
return user ? <>{children}</> : <Navigate to="/login" />;
```

### Current Auth Context (Status: PARTIALLY DISABLED)
- Most methods are commented out
- Fallback to basic fetch-based implementation in some places
- useAuth hook is the primary interface
- No error recovery for network failures

### Onboarding Flow
```
1. User lands on Landing.tsx (marketing site)
2. User clicks "Get Started" → Signup.tsx
3. Fill name, email, password
4. POST /api/auth/signup
5. Auto-logged in
6. Redirect to /wizard (Digital Twin Builder)
7. Fill detailed profile (identity, skills, experience, etc.)
8. POST /api/digital-twin/create
9. Redirect to /dashboard
10. View digital twin, see leads, manage profile
```

### Key Frontend Issues Identified

| Issue | Severity | Impact |
|-------|----------|---------|
| Token stored in localStorage | CRITICAL | XSS vulnerability, no CSRF protection |
| No refresh token mechanism | HIGH | User must re-login after 7 days |
| AuthContext partially commented | HIGH | Code maintainability, unclear intent |
| GoogleOAuth unfinished | HIGH | Google auth non-functional |
| No password reset UI/flow | MEDIUM | Users locked out if forgotten password |
| No email verification | MEDIUM | Spam/invalid emails possible |
| Hard redirect on 401 (losing context) | MEDIUM | Bad UX, state loss |
| No request retry logic | MEDIUM | Network hiccups = failed requests |
| Profile picture upload hardcoded URL | MEDIUM | Breaks with different API endpoints |
| No loading/error states in Dashboard | LOW | May seem frozen during loads |
| Axios base URL env var inconsistent | LOW | Frontend/backend URL mismatch risk |

### Strengths
✅ Modern React + TypeScript foundation
✅ Centralized API service layer (clean separation)
✅ Reusable shadcn/ui components
✅ Protected route abstraction
✅ Axios interceptor pattern
✅ React Query integration for data fetching
✅ Framer Motion for animations
✅ Type-safe with zod validation support

---

## 2. CURRENT BACKEND ARCHITECTURE

### Framework & Technology Stack
```
Node.js + Express.js 5.1.0 (modern version)
Database: MongoDB + Mongoose 8.19.2 (ES modules)
Authentication: Passport.js + JWT
File Upload: Multer
Password Security: bcryptjs
API Docs: None (manual implementation)
Environment: dotenv (but not fully used)
Error Handling: Custom middleware
```

### Project Structure
```
src/
├── server.js                  (Express app setup, middlewares, routes)
├── config/
│   ├── db.js                  (MongoDB connection)
│   └── passport.js            (Google OAuth strategy)
├── models/
│   ├── User.js                (User schema)
│   ├── DigitalTwin.js         (Digital twin schema - complex)
│   ├── Lead.js                (Lead tracking)
│   └── Message.js             (Chat messages - not analyzed)
├── controllers/
│   ├── authController.js      (Signup, login, Google auth)
│   ├── profileController.js   (Profile management, picture upload)
│   ├── digitalTwinController.js (Twin CRUD operations)
│   ├── chatController.js      (Chat operations)
│   └── leadController.js      (Lead CRUD operations)
├── middleware/
│   ├── authMiddleware.js      (JWT token verification)
│   ├── errorMiddleware.js     (Global error handler)
│   └── asyncHandler.js        (Async error wrapper)
├── routes/
│   ├── authRoutes.js          (Auth endpoints)
│   ├── digitalTwinRoutes.js   (Twin endpoints)
│   ├── chatRoutes.js          (Chat endpoints)
│   └── leadRoutes.js          (Lead endpoints)
├── services/
│   ├── authService.js         (Auth business logic)
│   ├── digitalTwinService.js  (Twin business logic)
│   ├── chatService.js         (Chat business logic)
│   └── leadService.js         (Lead business logic)
├── utils/
│   └── generateToken.js       (JWT token generation)
└── uploads/
    └── profile-pictures/      (File storage for profile pics)
```

### User Model (Current Schema)
```javascript
{
  name: String (required),
  email: String (required, unique),
  password: String (optional - for manual auth),
  googleId: String (optional - for Google auth),
  avatar: String (optional - from Google),
  profilePicture: String (optional - uploaded),
  timestamps: true
}
```

**Issues with User Model:**
- ❌ No `provider` field (can't track auth method)
- ❌ No `emailVerified` field (no email verification)
- ❌ No `lastLogin` tracking
- ❌ No `isActive` flag (no soft deletes)
- ❌ No `refreshToken` storage (no refresh mechanism)
- ❌ Both `password` and `googleId` optional (allows creating invalid users)
- ⚠️ `profilePicture` and `avatar` are separate (confusion)

### Digital Twin Model (Current)
```javascript
{
  user: ObjectId (ref: User, required, unique per user),
  identity: {
    name: String,
    role: String,
    tagline: String,
    bio: String
  },
  businesses: [
    {
      name: String,
      role: String,
      description: String,
      link: String,
      products: [String],
      duration: String
    }
  ],
  experience: [
    {
      company: String,
      role: String,
      duration: String,
      key_projects: [String]
    }
  ],
  education: [
    {
      institution: String,
      degree: String,
      year: String
    }
  ],
  skills: {
    list: [String],
    coreDomains: String,
    signatureStrengths: String
  },
  personality: {
    traits: [String],
    leadership_style: String,
    decision_style: String,
    tone: String,
    archetype: String,
    values: [String]
  },
  story: {
    mission: String,
    impact: String,
    themes: [String]
  },
  networking: {
    audience: String,
    intent: String,
    boundaries: [String]
  },
  links: {
    linkedin: String,
    website: String,
    portfolio: String,
    socials: [String]
  },
  isActive: Boolean (default: true),
  lastUpdated: Date,
  timestamps: true,
  indexes: [user, text search on identity]
}
```

✅ Well-designed schema for digital twin profiles
✅ Good separation of concerns (identity, skills, personality, etc.)
✅ Text search indexes for discovery
⚠️ No versioning/history tracking
⚠️ No public/private field separation (all data treated as public on /public/:twinId)

### Authentication Flow (Backend)

#### SIGNUP Flow
```javascript
// POST /api/auth/signup
{
  name, email, password
} 
  ↓
authService.register()
  - Check user exists (findOne)
  - Hash password (bcryptjs)
  - Create user
  - Generate JWT token (7d expiry)
  - Return { user, token }
```

#### LOGIN Flow
```javascript
// POST /api/auth/login
{
  email, password
}
  ↓
authService.login()
  - Find user by email
  - Verify password (bcryptjs compare)
  - Generate JWT token
  - Return { user, token }
```

#### GOOGLE AUTH (REST Endpoint)
```javascript
// POST /api/auth/google
{
  googleId, name, email, avatar
}
  ↓
authService.googleLogin()
  - Find user by email (⚠️ CRITICAL: searches by email, not googleId!)
  - If not found, create with googleId, name, email, avatar
  - Generate JWT token
  - Return { user, token }
```

#### GOOGLE AUTH (Passport Flow - INCOMPLETE)
```javascript
// GET /api/auth/google
  ↓
passport.authenticate('google', { scope: ['profile', 'email'] })
  ↓
// User logs in on Google
  ↓
// GET /api/auth/google/callback
  ↓
GoogleStrategy callback:
  - Extract: id, displayName, emails, photos
  - Find user by googleId
  - If not found, create user
  - Serialize user session
  ↓
Redirect to CLIENT_URL/dashboard
```

### Token Generation & Verification

**Generate:**
```javascript
jwt.sign(
  { id: userId },
  process.env.JWT_SECRET,
  { expiresIn: "7d" }
)
```

**Verify (in protect middleware):**
```javascript
// Bearer token in Authorization header
const token = req.headers.authorization.split(" ")[1];
const decoded = jwt.verify(token, process.env.JWT_SECRET);
req.user = User.findById(decoded.id).select("-password");
```

**Issues:**
- ❌ No refresh token mechanism
- ❌ JWT_SECRET must be strong (not validated in code)
- ❌ No token rotation
- ❌ No token blacklist for logout
- ❌ 7-day expiry may be too long for sensitive operations

### Middleware Stack

**Order in server.js:**
1. `express.json()` - Body parser
2. `cookieParser()` - Cookie parsing
3. `cors()` - CORS handling (origin checking, credentials)
4. `express.static(/uploads)` - Static file serving
5. `passport.initialize()` - Passport setup
6. `passport.session()` - Session management
7. Routes
8. `errorHandler` - Global error handler

**CORS Configuration:**
```javascript
const allowedOrigins = [
  process.env.CLIENT_URL,
  "https://digitaltwin.techtrekkers.ai"
];

const isLocalFrontend = /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);

cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || isLocalFrontend(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true
})
```

**Issues:**
- ⚠️ Relies on `process.env.CLIENT_URL` being set (may not be in dev)
- ⚠️ Loose CORS on localhost (dangerous in production if not careful)
- ✅ Credentials allowed (needed for cookies)

### Auth Middleware
```javascript
// protect middleware (very basic)
export const protect = async (req, res, next) => {
  let token;
  
  if (req.headers.authorization?.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select("-password");
      next();
    } catch (err) {
      res.status(401).json({ message: "Not authorized, token failed" });
    }
  }
  
  if (!token) {
    res.status(401).json({ message: "Not authorized, no token" });
  }
};
```

**Issues:**
- ❌ No checks for revoked/blacklisted tokens
- ❌ No token expiry verification (JWT lib handles it, but no custom logic)
- ❌ User.
```


## License: unknown
https://github.com/BhargovJD/React-2021/blob/561058e6d7880040f0d5cf1f1c63758f6b13db4a/32%20MernStack/DigitalDiaryApp/backend/middlewares/auth-middleware.js

```
Now I'll generate a comprehensive architecture audit. Based on my deep analysis of both frontend and backend code, here's the complete assessment:

---

# ARCHITECTURE AUDIT: DIGITAL TWIN PLATFORM
## Production-Grade Pre-Implementation Review

---

## EXECUTIVE SUMMARY

This is a **user-centric SaaS platform** with:
- **Manual authentication** (email/password) + **REST-based Google OAuth**
- **React 18 + TypeScript frontend** with shadcn/ui component library
- **Express.js backend** with MongoDB + Mongoose ORM
- **JWT token-based auth** (7-day expiry) with localStorage persistence
- **Per-user digital twin profiles** with complex nested data structures
- **Lead tracking system** for business intelligence

### Current Auth Status: **FUNCTIONAL BUT INCOMPLETE**
- Manual signup/login flows are implemented
- Google OAuth foundation exists but frontend implementation is commented out
- No refresh token mechanism
- No password reset flow
- No email verification

---

## 1. CURRENT FRONTEND ARCHITECTURE

### Framework & Tooling
```
React 18.3.1 + TypeScript + Vite (module-based)
Build Tool: Vite with React SWC plugin
Styling: Tailwind CSS + shadcn/ui components
State Management: React Context API + TanStack React Query
HTTP Client: Axios with interceptors
Routing: React Router v6.30.2
Animation: Framer Motion + GSAP
```

### Project Structure
```
src/
├── pages/
│   ├── Login.tsx              (Email/password login form)
│   ├── Signup.tsx             (Email/password signup form)
│   ├── Dashboard.tsx          (User dashboard with twins & leads)
│   ├── Chatbot.tsx            (Chat interface for digital twins)
│   ├── Index.tsx              (Digital twin wizard/builder)
│   ├── Landing.tsx            (Marketing landing page)
│   └── LandingPages/          (Landing page variants)
├── components/
│   ├── GoogleOAuth.tsx        (INCOMPLETE - Google auth component)
│   ├── DigitalTwinWizard.tsx (Wizard for creating twins)
│   └── ui/                    (Reusable shadcn/ui components)
├── contexts/
│   ├── AuthContext.tsx        (PARTIALLY COMMENTED OUT)
│   ├── DigitalTwinContext.tsx (Digital twin state management)
│   └── ProtectedRoute.tsx     (Route protection wrapper)
├── services/
│   └── api.service.ts         (Centralized API calls)
├── hooks/
│   ├── use-mobile.tsx
│   └── use-toast.ts
├── lib/
│   └── utils.ts
├── types/
│   └── digitalTwin.ts
└── axios.config.ts            (Axios instance with interceptors)
```

### Authentication Flow (Current)

#### SIGNUP Flow
```
User Input (name, email, password, confirm password)
  ↓
useAuth.signup() via AuthContext
  ↓
POST /api/auth/signup (email, password)
  ↓
Response: { user, token }
  ↓
Store: localStorage['token'] + localStorage['user']
  ↓
Update: AuthContext state
  ↓
Navigate: /wizard (digital twin builder)
```

#### LOGIN Flow
```
User Input (email, password)
  ↓
useAuth.login() via AuthContext
  ↓
POST /api/auth/login (email, password)
  ↓
Response: { user, token }
  ↓
Store: localStorage['token'] + localStorage['user']
  ↓
Update: AuthContext state
  ↓
Navigate: /dashboard
```

#### GOOGLE AUTH Flow (INCOMPLETE/COMMENTED)
```
Frontend attempts to:
1. Load Google API (window.google)
2. Initialize Google OAuth2 with client ID
3. Show One Tap UI or redirect to passport flow
4. Parse JWT credential
5. POST /api/auth/google with parsed data

Backend:
  POST /api/auth/google → createGoogleUser → return token
  OR
  GET /api/auth/google → passport.authenticate()
  → GET /api/auth/google/callback → redirect /dashboard
```

### Token & Session Management

**Token Storage Strategy:**
- Location: `localStorage['token']` (INSECURE - vulnerable to XSS)
- Format: JWT (Bearer token)
- Expiry: 7 days (server-side)
- Refresh: NONE (manual re-login required)

**Session Restoration:**
```typescript
// On app load via AuthContext
useEffect(() => {
  const storedToken = localStorage.getItem('token');
  const storedUser = localStorage.getItem('user');
  
  if (storedToken) {
    setToken(storedToken);
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    } else {
      getProfile(); // Fetch profile if missing
    }
  }
  setIsLoading(false);
}, []);
```

**Axios Interceptor:**
```typescript
// Request: Auto-attach token
interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response: Handle 401 on protected routes
interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !isAuthRequest) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login'; // Hard redirect
    }
    return Promise.reject(error);
  }
);
```

### Protected Routes
```typescript
// ProtectedRoute.tsx
if (isLoading) return <Loader />;
return user ? <>{children}</> : <Navigate to="/login" />;
```

### Current Auth Context (Status: PARTIALLY DISABLED)
- Most methods are commented out
- Fallback to basic fetch-based implementation in some places
- useAuth hook is the primary interface
- No error recovery for network failures

### Onboarding Flow
```
1. User lands on Landing.tsx (marketing site)
2. User clicks "Get Started" → Signup.tsx
3. Fill name, email, password
4. POST /api/auth/signup
5. Auto-logged in
6. Redirect to /wizard (Digital Twin Builder)
7. Fill detailed profile (identity, skills, experience, etc.)
8. POST /api/digital-twin/create
9. Redirect to /dashboard
10. View digital twin, see leads, manage profile
```

### Key Frontend Issues Identified

| Issue | Severity | Impact |
|-------|----------|---------|
| Token stored in localStorage | CRITICAL | XSS vulnerability, no CSRF protection |
| No refresh token mechanism | HIGH | User must re-login after 7 days |
| AuthContext partially commented | HIGH | Code maintainability, unclear intent |
| GoogleOAuth unfinished | HIGH | Google auth non-functional |
| No password reset UI/flow | MEDIUM | Users locked out if forgotten password |
| No email verification | MEDIUM | Spam/invalid emails possible |
| Hard redirect on 401 (losing context) | MEDIUM | Bad UX, state loss |
| No request retry logic | MEDIUM | Network hiccups = failed requests |
| Profile picture upload hardcoded URL | MEDIUM | Breaks with different API endpoints |
| No loading/error states in Dashboard | LOW | May seem frozen during loads |
| Axios base URL env var inconsistent | LOW | Frontend/backend URL mismatch risk |

### Strengths
✅ Modern React + TypeScript foundation
✅ Centralized API service layer (clean separation)
✅ Reusable shadcn/ui components
✅ Protected route abstraction
✅ Axios interceptor pattern
✅ React Query integration for data fetching
✅ Framer Motion for animations
✅ Type-safe with zod validation support

---

## 2. CURRENT BACKEND ARCHITECTURE

### Framework & Technology Stack
```
Node.js + Express.js 5.1.0 (modern version)
Database: MongoDB + Mongoose 8.19.2 (ES modules)
Authentication: Passport.js + JWT
File Upload: Multer
Password Security: bcryptjs
API Docs: None (manual implementation)
Environment: dotenv (but not fully used)
Error Handling: Custom middleware
```

### Project Structure
```
src/
├── server.js                  (Express app setup, middlewares, routes)
├── config/
│   ├── db.js                  (MongoDB connection)
│   └── passport.js            (Google OAuth strategy)
├── models/
│   ├── User.js                (User schema)
│   ├── DigitalTwin.js         (Digital twin schema - complex)
│   ├── Lead.js                (Lead tracking)
│   └── Message.js             (Chat messages - not analyzed)
├── controllers/
│   ├── authController.js      (Signup, login, Google auth)
│   ├── profileController.js   (Profile management, picture upload)
│   ├── digitalTwinController.js (Twin CRUD operations)
│   ├── chatController.js      (Chat operations)
│   └── leadController.js      (Lead CRUD operations)
├── middleware/
│   ├── authMiddleware.js      (JWT token verification)
│   ├── errorMiddleware.js     (Global error handler)
│   └── asyncHandler.js        (Async error wrapper)
├── routes/
│   ├── authRoutes.js          (Auth endpoints)
│   ├── digitalTwinRoutes.js   (Twin endpoints)
│   ├── chatRoutes.js          (Chat endpoints)
│   └── leadRoutes.js          (Lead endpoints)
├── services/
│   ├── authService.js         (Auth business logic)
│   ├── digitalTwinService.js  (Twin business logic)
│   ├── chatService.js         (Chat business logic)
│   └── leadService.js         (Lead business logic)
├── utils/
│   └── generateToken.js       (JWT token generation)
└── uploads/
    └── profile-pictures/      (File storage for profile pics)
```

### User Model (Current Schema)
```javascript
{
  name: String (required),
  email: String (required, unique),
  password: String (optional - for manual auth),
  googleId: String (optional - for Google auth),
  avatar: String (optional - from Google),
  profilePicture: String (optional - uploaded),
  timestamps: true
}
```

**Issues with User Model:**
- ❌ No `provider` field (can't track auth method)
- ❌ No `emailVerified` field (no email verification)
- ❌ No `lastLogin` tracking
- ❌ No `isActive` flag (no soft deletes)
- ❌ No `refreshToken` storage (no refresh mechanism)
- ❌ Both `password` and `googleId` optional (allows creating invalid users)
- ⚠️ `profilePicture` and `avatar` are separate (confusion)

### Digital Twin Model (Current)
```javascript
{
  user: ObjectId (ref: User, required, unique per user),
  identity: {
    name: String,
    role: String,
    tagline: String,
    bio: String
  },
  businesses: [
    {
      name: String,
      role: String,
      description: String,
      link: String,
      products: [String],
      duration: String
    }
  ],
  experience: [
    {
      company: String,
      role: String,
      duration: String,
      key_projects: [String]
    }
  ],
  education: [
    {
      institution: String,
      degree: String,
      year: String
    }
  ],
  skills: {
    list: [String],
    coreDomains: String,
    signatureStrengths: String
  },
  personality: {
    traits: [String],
    leadership_style: String,
    decision_style: String,
    tone: String,
    archetype: String,
    values: [String]
  },
  story: {
    mission: String,
    impact: String,
    themes: [String]
  },
  networking: {
    audience: String,
    intent: String,
    boundaries: [String]
  },
  links: {
    linkedin: String,
    website: String,
    portfolio: String,
    socials: [String]
  },
  isActive: Boolean (default: true),
  lastUpdated: Date,
  timestamps: true,
  indexes: [user, text search on identity]
}
```

✅ Well-designed schema for digital twin profiles
✅ Good separation of concerns (identity, skills, personality, etc.)
✅ Text search indexes for discovery
⚠️ No versioning/history tracking
⚠️ No public/private field separation (all data treated as public on /public/:twinId)

### Authentication Flow (Backend)

#### SIGNUP Flow
```javascript
// POST /api/auth/signup
{
  name, email, password
} 
  ↓
authService.register()
  - Check user exists (findOne)
  - Hash password (bcryptjs)
  - Create user
  - Generate JWT token (7d expiry)
  - Return { user, token }
```

#### LOGIN Flow
```javascript
// POST /api/auth/login
{
  email, password
}
  ↓
authService.login()
  - Find user by email
  - Verify password (bcryptjs compare)
  - Generate JWT token
  - Return { user, token }
```

#### GOOGLE AUTH (REST Endpoint)
```javascript
// POST /api/auth/google
{
  googleId, name, email, avatar
}
  ↓
authService.googleLogin()
  - Find user by email (⚠️ CRITICAL: searches by email, not googleId!)
  - If not found, create with googleId, name, email, avatar
  - Generate JWT token
  - Return { user, token }
```

#### GOOGLE AUTH (Passport Flow - INCOMPLETE)
```javascript
// GET /api/auth/google
  ↓
passport.authenticate('google', { scope: ['profile', 'email'] })
  ↓
// User logs in on Google
  ↓
// GET /api/auth/google/callback
  ↓
GoogleStrategy callback:
  - Extract: id, displayName, emails, photos
  - Find user by googleId
  - If not found, create user
  - Serialize user session
  ↓
Redirect to CLIENT_URL/dashboard
```

### Token Generation & Verification

**Generate:**
```javascript
jwt.sign(
  { id: userId },
  process.env.JWT_SECRET,
  { expiresIn: "7d" }
)
```

**Verify (in protect middleware):**
```javascript
// Bearer token in Authorization header
const token = req.headers.authorization.split(" ")[1];
const decoded = jwt.verify(token, process.env.JWT_SECRET);
req.user = User.findById(decoded.id).select("-password");
```

**Issues:**
- ❌ No refresh token mechanism
- ❌ JWT_SECRET must be strong (not validated in code)
- ❌ No token rotation
- ❌ No token blacklist for logout
- ❌ 7-day expiry may be too long for sensitive operations

### Middleware Stack

**Order in server.js:**
1. `express.json()` - Body parser
2. `cookieParser()` - Cookie parsing
3. `cors()` - CORS handling (origin checking, credentials)
4. `express.static(/uploads)` - Static file serving
5. `passport.initialize()` - Passport setup
6. `passport.session()` - Session management
7. Routes
8. `errorHandler` - Global error handler

**CORS Configuration:**
```javascript
const allowedOrigins = [
  process.env.CLIENT_URL,
  "https://digitaltwin.techtrekkers.ai"
];

const isLocalFrontend = /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);

cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || isLocalFrontend(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true
})
```

**Issues:**
- ⚠️ Relies on `process.env.CLIENT_URL` being set (may not be in dev)
- ⚠️ Loose CORS on localhost (dangerous in production if not careful)
- ✅ Credentials allowed (needed for cookies)

### Auth Middleware
```javascript
// protect middleware (very basic)
export const protect = async (req, res, next) => {
  let token;
  
  if (req.headers.authorization?.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select("-password");
      next();
    } catch (err) {
      res.status(401).json({ message: "Not authorized, token failed" });
    }
  }
  
  if (!token) {
    res.status(401).json({ message: "Not authorized, no token" });
  }
};
```

**Issues:**
- ❌ No checks for revoked/blacklisted tokens
- ❌ No token expiry verification (JWT lib handles it, but no custom logic)
- ❌ User.
```


## License: unknown
https://github.com/devastion/tmdb-api-use/blob/22998f24ac5a464ecb9d76cbc6e735b3eba07cd5/server/middleware/authMiddleware.js

```
Now I'll generate a comprehensive architecture audit. Based on my deep analysis of both frontend and backend code, here's the complete assessment:

---

# ARCHITECTURE AUDIT: DIGITAL TWIN PLATFORM
## Production-Grade Pre-Implementation Review

---

## EXECUTIVE SUMMARY

This is a **user-centric SaaS platform** with:
- **Manual authentication** (email/password) + **REST-based Google OAuth**
- **React 18 + TypeScript frontend** with shadcn/ui component library
- **Express.js backend** with MongoDB + Mongoose ORM
- **JWT token-based auth** (7-day expiry) with localStorage persistence
- **Per-user digital twin profiles** with complex nested data structures
- **Lead tracking system** for business intelligence

### Current Auth Status: **FUNCTIONAL BUT INCOMPLETE**
- Manual signup/login flows are implemented
- Google OAuth foundation exists but frontend implementation is commented out
- No refresh token mechanism
- No password reset flow
- No email verification

---

## 1. CURRENT FRONTEND ARCHITECTURE

### Framework & Tooling
```
React 18.3.1 + TypeScript + Vite (module-based)
Build Tool: Vite with React SWC plugin
Styling: Tailwind CSS + shadcn/ui components
State Management: React Context API + TanStack React Query
HTTP Client: Axios with interceptors
Routing: React Router v6.30.2
Animation: Framer Motion + GSAP
```

### Project Structure
```
src/
├── pages/
│   ├── Login.tsx              (Email/password login form)
│   ├── Signup.tsx             (Email/password signup form)
│   ├── Dashboard.tsx          (User dashboard with twins & leads)
│   ├── Chatbot.tsx            (Chat interface for digital twins)
│   ├── Index.tsx              (Digital twin wizard/builder)
│   ├── Landing.tsx            (Marketing landing page)
│   └── LandingPages/          (Landing page variants)
├── components/
│   ├── GoogleOAuth.tsx        (INCOMPLETE - Google auth component)
│   ├── DigitalTwinWizard.tsx (Wizard for creating twins)
│   └── ui/                    (Reusable shadcn/ui components)
├── contexts/
│   ├── AuthContext.tsx        (PARTIALLY COMMENTED OUT)
│   ├── DigitalTwinContext.tsx (Digital twin state management)
│   └── ProtectedRoute.tsx     (Route protection wrapper)
├── services/
│   └── api.service.ts         (Centralized API calls)
├── hooks/
│   ├── use-mobile.tsx
│   └── use-toast.ts
├── lib/
│   └── utils.ts
├── types/
│   └── digitalTwin.ts
└── axios.config.ts            (Axios instance with interceptors)
```

### Authentication Flow (Current)

#### SIGNUP Flow
```
User Input (name, email, password, confirm password)
  ↓
useAuth.signup() via AuthContext
  ↓
POST /api/auth/signup (email, password)
  ↓
Response: { user, token }
  ↓
Store: localStorage['token'] + localStorage['user']
  ↓
Update: AuthContext state
  ↓
Navigate: /wizard (digital twin builder)
```

#### LOGIN Flow
```
User Input (email, password)
  ↓
useAuth.login() via AuthContext
  ↓
POST /api/auth/login (email, password)
  ↓
Response: { user, token }
  ↓
Store: localStorage['token'] + localStorage['user']
  ↓
Update: AuthContext state
  ↓
Navigate: /dashboard
```

#### GOOGLE AUTH Flow (INCOMPLETE/COMMENTED)
```
Frontend attempts to:
1. Load Google API (window.google)
2. Initialize Google OAuth2 with client ID
3. Show One Tap UI or redirect to passport flow
4. Parse JWT credential
5. POST /api/auth/google with parsed data

Backend:
  POST /api/auth/google → createGoogleUser → return token
  OR
  GET /api/auth/google → passport.authenticate()
  → GET /api/auth/google/callback → redirect /dashboard
```

### Token & Session Management

**Token Storage Strategy:**
- Location: `localStorage['token']` (INSECURE - vulnerable to XSS)
- Format: JWT (Bearer token)
- Expiry: 7 days (server-side)
- Refresh: NONE (manual re-login required)

**Session Restoration:**
```typescript
// On app load via AuthContext
useEffect(() => {
  const storedToken = localStorage.getItem('token');
  const storedUser = localStorage.getItem('user');
  
  if (storedToken) {
    setToken(storedToken);
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    } else {
      getProfile(); // Fetch profile if missing
    }
  }
  setIsLoading(false);
}, []);
```

**Axios Interceptor:**
```typescript
// Request: Auto-attach token
interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response: Handle 401 on protected routes
interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !isAuthRequest) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login'; // Hard redirect
    }
    return Promise.reject(error);
  }
);
```

### Protected Routes
```typescript
// ProtectedRoute.tsx
if (isLoading) return <Loader />;
return user ? <>{children}</> : <Navigate to="/login" />;
```

### Current Auth Context (Status: PARTIALLY DISABLED)
- Most methods are commented out
- Fallback to basic fetch-based implementation in some places
- useAuth hook is the primary interface
- No error recovery for network failures

### Onboarding Flow
```
1. User lands on Landing.tsx (marketing site)
2. User clicks "Get Started" → Signup.tsx
3. Fill name, email, password
4. POST /api/auth/signup
5. Auto-logged in
6. Redirect to /wizard (Digital Twin Builder)
7. Fill detailed profile (identity, skills, experience, etc.)
8. POST /api/digital-twin/create
9. Redirect to /dashboard
10. View digital twin, see leads, manage profile
```

### Key Frontend Issues Identified

| Issue | Severity | Impact |
|-------|----------|---------|
| Token stored in localStorage | CRITICAL | XSS vulnerability, no CSRF protection |
| No refresh token mechanism | HIGH | User must re-login after 7 days |
| AuthContext partially commented | HIGH | Code maintainability, unclear intent |
| GoogleOAuth unfinished | HIGH | Google auth non-functional |
| No password reset UI/flow | MEDIUM | Users locked out if forgotten password |
| No email verification | MEDIUM | Spam/invalid emails possible |
| Hard redirect on 401 (losing context) | MEDIUM | Bad UX, state loss |
| No request retry logic | MEDIUM | Network hiccups = failed requests |
| Profile picture upload hardcoded URL | MEDIUM | Breaks with different API endpoints |
| No loading/error states in Dashboard | LOW | May seem frozen during loads |
| Axios base URL env var inconsistent | LOW | Frontend/backend URL mismatch risk |

### Strengths
✅ Modern React + TypeScript foundation
✅ Centralized API service layer (clean separation)
✅ Reusable shadcn/ui components
✅ Protected route abstraction
✅ Axios interceptor pattern
✅ React Query integration for data fetching
✅ Framer Motion for animations
✅ Type-safe with zod validation support

---

## 2. CURRENT BACKEND ARCHITECTURE

### Framework & Technology Stack
```
Node.js + Express.js 5.1.0 (modern version)
Database: MongoDB + Mongoose 8.19.2 (ES modules)
Authentication: Passport.js + JWT
File Upload: Multer
Password Security: bcryptjs
API Docs: None (manual implementation)
Environment: dotenv (but not fully used)
Error Handling: Custom middleware
```

### Project Structure
```
src/
├── server.js                  (Express app setup, middlewares, routes)
├── config/
│   ├── db.js                  (MongoDB connection)
│   └── passport.js            (Google OAuth strategy)
├── models/
│   ├── User.js                (User schema)
│   ├── DigitalTwin.js         (Digital twin schema - complex)
│   ├── Lead.js                (Lead tracking)
│   └── Message.js             (Chat messages - not analyzed)
├── controllers/
│   ├── authController.js      (Signup, login, Google auth)
│   ├── profileController.js   (Profile management, picture upload)
│   ├── digitalTwinController.js (Twin CRUD operations)
│   ├── chatController.js      (Chat operations)
│   └── leadController.js      (Lead CRUD operations)
├── middleware/
│   ├── authMiddleware.js      (JWT token verification)
│   ├── errorMiddleware.js     (Global error handler)
│   └── asyncHandler.js        (Async error wrapper)
├── routes/
│   ├── authRoutes.js          (Auth endpoints)
│   ├── digitalTwinRoutes.js   (Twin endpoints)
│   ├── chatRoutes.js          (Chat endpoints)
│   └── leadRoutes.js          (Lead endpoints)
├── services/
│   ├── authService.js         (Auth business logic)
│   ├── digitalTwinService.js  (Twin business logic)
│   ├── chatService.js         (Chat business logic)
│   └── leadService.js         (Lead business logic)
├── utils/
│   └── generateToken.js       (JWT token generation)
└── uploads/
    └── profile-pictures/      (File storage for profile pics)
```

### User Model (Current Schema)
```javascript
{
  name: String (required),
  email: String (required, unique),
  password: String (optional - for manual auth),
  googleId: String (optional - for Google auth),
  avatar: String (optional - from Google),
  profilePicture: String (optional - uploaded),
  timestamps: true
}
```

**Issues with User Model:**
- ❌ No `provider` field (can't track auth method)
- ❌ No `emailVerified` field (no email verification)
- ❌ No `lastLogin` tracking
- ❌ No `isActive` flag (no soft deletes)
- ❌ No `refreshToken` storage (no refresh mechanism)
- ❌ Both `password` and `googleId` optional (allows creating invalid users)
- ⚠️ `profilePicture` and `avatar` are separate (confusion)

### Digital Twin Model (Current)
```javascript
{
  user: ObjectId (ref: User, required, unique per user),
  identity: {
    name: String,
    role: String,
    tagline: String,
    bio: String
  },
  businesses: [
    {
      name: String,
      role: String,
      description: String,
      link: String,
      products: [String],
      duration: String
    }
  ],
  experience: [
    {
      company: String,
      role: String,
      duration: String,
      key_projects: [String]
    }
  ],
  education: [
    {
      institution: String,
      degree: String,
      year: String
    }
  ],
  skills: {
    list: [String],
    coreDomains: String,
    signatureStrengths: String
  },
  personality: {
    traits: [String],
    leadership_style: String,
    decision_style: String,
    tone: String,
    archetype: String,
    values: [String]
  },
  story: {
    mission: String,
    impact: String,
    themes: [String]
  },
  networking: {
    audience: String,
    intent: String,
    boundaries: [String]
  },
  links: {
    linkedin: String,
    website: String,
    portfolio: String,
    socials: [String]
  },
  isActive: Boolean (default: true),
  lastUpdated: Date,
  timestamps: true,
  indexes: [user, text search on identity]
}
```

✅ Well-designed schema for digital twin profiles
✅ Good separation of concerns (identity, skills, personality, etc.)
✅ Text search indexes for discovery
⚠️ No versioning/history tracking
⚠️ No public/private field separation (all data treated as public on /public/:twinId)

### Authentication Flow (Backend)

#### SIGNUP Flow
```javascript
// POST /api/auth/signup
{
  name, email, password
} 
  ↓
authService.register()
  - Check user exists (findOne)
  - Hash password (bcryptjs)
  - Create user
  - Generate JWT token (7d expiry)
  - Return { user, token }
```

#### LOGIN Flow
```javascript
// POST /api/auth/login
{
  email, password
}
  ↓
authService.login()
  - Find user by email
  - Verify password (bcryptjs compare)
  - Generate JWT token
  - Return { user, token }
```

#### GOOGLE AUTH (REST Endpoint)
```javascript
// POST /api/auth/google
{
  googleId, name, email, avatar
}
  ↓
authService.googleLogin()
  - Find user by email (⚠️ CRITICAL: searches by email, not googleId!)
  - If not found, create with googleId, name, email, avatar
  - Generate JWT token
  - Return { user, token }
```

#### GOOGLE AUTH (Passport Flow - INCOMPLETE)
```javascript
// GET /api/auth/google
  ↓
passport.authenticate('google', { scope: ['profile', 'email'] })
  ↓
// User logs in on Google
  ↓
// GET /api/auth/google/callback
  ↓
GoogleStrategy callback:
  - Extract: id, displayName, emails, photos
  - Find user by googleId
  - If not found, create user
  - Serialize user session
  ↓
Redirect to CLIENT_URL/dashboard
```

### Token Generation & Verification

**Generate:**
```javascript
jwt.sign(
  { id: userId },
  process.env.JWT_SECRET,
  { expiresIn: "7d" }
)
```

**Verify (in protect middleware):**
```javascript
// Bearer token in Authorization header
const token = req.headers.authorization.split(" ")[1];
const decoded = jwt.verify(token, process.env.JWT_SECRET);
req.user = User.findById(decoded.id).select("-password");
```

**Issues:**
- ❌ No refresh token mechanism
- ❌ JWT_SECRET must be strong (not validated in code)
- ❌ No token rotation
- ❌ No token blacklist for logout
- ❌ 7-day expiry may be too long for sensitive operations

### Middleware Stack

**Order in server.js:**
1. `express.json()` - Body parser
2. `cookieParser()` - Cookie parsing
3. `cors()` - CORS handling (origin checking, credentials)
4. `express.static(/uploads)` - Static file serving
5. `passport.initialize()` - Passport setup
6. `passport.session()` - Session management
7. Routes
8. `errorHandler` - Global error handler

**CORS Configuration:**
```javascript
const allowedOrigins = [
  process.env.CLIENT_URL,
  "https://digitaltwin.techtrekkers.ai"
];

const isLocalFrontend = /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);

cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || isLocalFrontend(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true
})
```

**Issues:**
- ⚠️ Relies on `process.env.CLIENT_URL` being set (may not be in dev)
- ⚠️ Loose CORS on localhost (dangerous in production if not careful)
- ✅ Credentials allowed (needed for cookies)

### Auth Middleware
```javascript
// protect middleware (very basic)
export const protect = async (req, res, next) => {
  let token;
  
  if (req.headers.authorization?.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select("-password");
      next();
    } catch (err) {
      res.status(401).json({ message: "Not authorized, token failed" });
    }
  }
  
  if (!token) {
    res.status(401).json({ message: "Not authorized, no token" });
  }
};
```

**Issues:**
- ❌ No checks for revoked/blacklisted tokens
- ❌ No token expiry verification (JWT lib handles it, but no custom logic)
- ❌ User.
```


## License: unknown
https://github.com/iamnishantgarg/Shopee/blob/d9b6055bee263b3444c5b9920a480dce1e577e7f/middleware/authMiddleware.js

```
Now I'll generate a comprehensive architecture audit. Based on my deep analysis of both frontend and backend code, here's the complete assessment:

---

# ARCHITECTURE AUDIT: DIGITAL TWIN PLATFORM
## Production-Grade Pre-Implementation Review

---

## EXECUTIVE SUMMARY

This is a **user-centric SaaS platform** with:
- **Manual authentication** (email/password) + **REST-based Google OAuth**
- **React 18 + TypeScript frontend** with shadcn/ui component library
- **Express.js backend** with MongoDB + Mongoose ORM
- **JWT token-based auth** (7-day expiry) with localStorage persistence
- **Per-user digital twin profiles** with complex nested data structures
- **Lead tracking system** for business intelligence

### Current Auth Status: **FUNCTIONAL BUT INCOMPLETE**
- Manual signup/login flows are implemented
- Google OAuth foundation exists but frontend implementation is commented out
- No refresh token mechanism
- No password reset flow
- No email verification

---

## 1. CURRENT FRONTEND ARCHITECTURE

### Framework & Tooling
```
React 18.3.1 + TypeScript + Vite (module-based)
Build Tool: Vite with React SWC plugin
Styling: Tailwind CSS + shadcn/ui components
State Management: React Context API + TanStack React Query
HTTP Client: Axios with interceptors
Routing: React Router v6.30.2
Animation: Framer Motion + GSAP
```

### Project Structure
```
src/
├── pages/
│   ├── Login.tsx              (Email/password login form)
│   ├── Signup.tsx             (Email/password signup form)
│   ├── Dashboard.tsx          (User dashboard with twins & leads)
│   ├── Chatbot.tsx            (Chat interface for digital twins)
│   ├── Index.tsx              (Digital twin wizard/builder)
│   ├── Landing.tsx            (Marketing landing page)
│   └── LandingPages/          (Landing page variants)
├── components/
│   ├── GoogleOAuth.tsx        (INCOMPLETE - Google auth component)
│   ├── DigitalTwinWizard.tsx (Wizard for creating twins)
│   └── ui/                    (Reusable shadcn/ui components)
├── contexts/
│   ├── AuthContext.tsx        (PARTIALLY COMMENTED OUT)
│   ├── DigitalTwinContext.tsx (Digital twin state management)
│   └── ProtectedRoute.tsx     (Route protection wrapper)
├── services/
│   └── api.service.ts         (Centralized API calls)
├── hooks/
│   ├── use-mobile.tsx
│   └── use-toast.ts
├── lib/
│   └── utils.ts
├── types/
│   └── digitalTwin.ts
└── axios.config.ts            (Axios instance with interceptors)
```

### Authentication Flow (Current)

#### SIGNUP Flow
```
User Input (name, email, password, confirm password)
  ↓
useAuth.signup() via AuthContext
  ↓
POST /api/auth/signup (email, password)
  ↓
Response: { user, token }
  ↓
Store: localStorage['token'] + localStorage['user']
  ↓
Update: AuthContext state
  ↓
Navigate: /wizard (digital twin builder)
```

#### LOGIN Flow
```
User Input (email, password)
  ↓
useAuth.login() via AuthContext
  ↓
POST /api/auth/login (email, password)
  ↓
Response: { user, token }
  ↓
Store: localStorage['token'] + localStorage['user']
  ↓
Update: AuthContext state
  ↓
Navigate: /dashboard
```

#### GOOGLE AUTH Flow (INCOMPLETE/COMMENTED)
```
Frontend attempts to:
1. Load Google API (window.google)
2. Initialize Google OAuth2 with client ID
3. Show One Tap UI or redirect to passport flow
4. Parse JWT credential
5. POST /api/auth/google with parsed data

Backend:
  POST /api/auth/google → createGoogleUser → return token
  OR
  GET /api/auth/google → passport.authenticate()
  → GET /api/auth/google/callback → redirect /dashboard
```

### Token & Session Management

**Token Storage Strategy:**
- Location: `localStorage['token']` (INSECURE - vulnerable to XSS)
- Format: JWT (Bearer token)
- Expiry: 7 days (server-side)
- Refresh: NONE (manual re-login required)

**Session Restoration:**
```typescript
// On app load via AuthContext
useEffect(() => {
  const storedToken = localStorage.getItem('token');
  const storedUser = localStorage.getItem('user');
  
  if (storedToken) {
    setToken(storedToken);
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    } else {
      getProfile(); // Fetch profile if missing
    }
  }
  setIsLoading(false);
}, []);
```

**Axios Interceptor:**
```typescript
// Request: Auto-attach token
interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response: Handle 401 on protected routes
interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !isAuthRequest) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login'; // Hard redirect
    }
    return Promise.reject(error);
  }
);
```

### Protected Routes
```typescript
// ProtectedRoute.tsx
if (isLoading) return <Loader />;
return user ? <>{children}</> : <Navigate to="/login" />;
```

### Current Auth Context (Status: PARTIALLY DISABLED)
- Most methods are commented out
- Fallback to basic fetch-based implementation in some places
- useAuth hook is the primary interface
- No error recovery for network failures

### Onboarding Flow
```
1. User lands on Landing.tsx (marketing site)
2. User clicks "Get Started" → Signup.tsx
3. Fill name, email, password
4. POST /api/auth/signup
5. Auto-logged in
6. Redirect to /wizard (Digital Twin Builder)
7. Fill detailed profile (identity, skills, experience, etc.)
8. POST /api/digital-twin/create
9. Redirect to /dashboard
10. View digital twin, see leads, manage profile
```

### Key Frontend Issues Identified

| Issue | Severity | Impact |
|-------|----------|---------|
| Token stored in localStorage | CRITICAL | XSS vulnerability, no CSRF protection |
| No refresh token mechanism | HIGH | User must re-login after 7 days |
| AuthContext partially commented | HIGH | Code maintainability, unclear intent |
| GoogleOAuth unfinished | HIGH | Google auth non-functional |
| No password reset UI/flow | MEDIUM | Users locked out if forgotten password |
| No email verification | MEDIUM | Spam/invalid emails possible |
| Hard redirect on 401 (losing context) | MEDIUM | Bad UX, state loss |
| No request retry logic | MEDIUM | Network hiccups = failed requests |
| Profile picture upload hardcoded URL | MEDIUM | Breaks with different API endpoints |
| No loading/error states in Dashboard | LOW | May seem frozen during loads |
| Axios base URL env var inconsistent | LOW | Frontend/backend URL mismatch risk |

### Strengths
✅ Modern React + TypeScript foundation
✅ Centralized API service layer (clean separation)
✅ Reusable shadcn/ui components
✅ Protected route abstraction
✅ Axios interceptor pattern
✅ React Query integration for data fetching
✅ Framer Motion for animations
✅ Type-safe with zod validation support

---

## 2. CURRENT BACKEND ARCHITECTURE

### Framework & Technology Stack
```
Node.js + Express.js 5.1.0 (modern version)
Database: MongoDB + Mongoose 8.19.2 (ES modules)
Authentication: Passport.js + JWT
File Upload: Multer
Password Security: bcryptjs
API Docs: None (manual implementation)
Environment: dotenv (but not fully used)
Error Handling: Custom middleware
```

### Project Structure
```
src/
├── server.js                  (Express app setup, middlewares, routes)
├── config/
│   ├── db.js                  (MongoDB connection)
│   └── passport.js            (Google OAuth strategy)
├── models/
│   ├── User.js                (User schema)
│   ├── DigitalTwin.js         (Digital twin schema - complex)
│   ├── Lead.js                (Lead tracking)
│   └── Message.js             (Chat messages - not analyzed)
├── controllers/
│   ├── authController.js      (Signup, login, Google auth)
│   ├── profileController.js   (Profile management, picture upload)
│   ├── digitalTwinController.js (Twin CRUD operations)
│   ├── chatController.js      (Chat operations)
│   └── leadController.js      (Lead CRUD operations)
├── middleware/
│   ├── authMiddleware.js      (JWT token verification)
│   ├── errorMiddleware.js     (Global error handler)
│   └── asyncHandler.js        (Async error wrapper)
├── routes/
│   ├── authRoutes.js          (Auth endpoints)
│   ├── digitalTwinRoutes.js   (Twin endpoints)
│   ├── chatRoutes.js          (Chat endpoints)
│   └── leadRoutes.js          (Lead endpoints)
├── services/
│   ├── authService.js         (Auth business logic)
│   ├── digitalTwinService.js  (Twin business logic)
│   ├── chatService.js         (Chat business logic)
│   └── leadService.js         (Lead business logic)
├── utils/
│   └── generateToken.js       (JWT token generation)
└── uploads/
    └── profile-pictures/      (File storage for profile pics)
```

### User Model (Current Schema)
```javascript
{
  name: String (required),
  email: String (required, unique),
  password: String (optional - for manual auth),
  googleId: String (optional - for Google auth),
  avatar: String (optional - from Google),
  profilePicture: String (optional - uploaded),
  timestamps: true
}
```

**Issues with User Model:**
- ❌ No `provider` field (can't track auth method)
- ❌ No `emailVerified` field (no email verification)
- ❌ No `lastLogin` tracking
- ❌ No `isActive` flag (no soft deletes)
- ❌ No `refreshToken` storage (no refresh mechanism)
- ❌ Both `password` and `googleId` optional (allows creating invalid users)
- ⚠️ `profilePicture` and `avatar` are separate (confusion)

### Digital Twin Model (Current)
```javascript
{
  user: ObjectId (ref: User, required, unique per user),
  identity: {
    name: String,
    role: String,
    tagline: String,
    bio: String
  },
  businesses: [
    {
      name: String,
      role: String,
      description: String,
      link: String,
      products: [String],
      duration: String
    }
  ],
  experience: [
    {
      company: String,
      role: String,
      duration: String,
      key_projects: [String]
    }
  ],
  education: [
    {
      institution: String,
      degree: String,
      year: String
    }
  ],
  skills: {
    list: [String],
    coreDomains: String,
    signatureStrengths: String
  },
  personality: {
    traits: [String],
    leadership_style: String,
    decision_style: String,
    tone: String,
    archetype: String,
    values: [String]
  },
  story: {
    mission: String,
    impact: String,
    themes: [String]
  },
  networking: {
    audience: String,
    intent: String,
    boundaries: [String]
  },
  links: {
    linkedin: String,
    website: String,
    portfolio: String,
    socials: [String]
  },
  isActive: Boolean (default: true),
  lastUpdated: Date,
  timestamps: true,
  indexes: [user, text search on identity]
}
```

✅ Well-designed schema for digital twin profiles
✅ Good separation of concerns (identity, skills, personality, etc.)
✅ Text search indexes for discovery
⚠️ No versioning/history tracking
⚠️ No public/private field separation (all data treated as public on /public/:twinId)

### Authentication Flow (Backend)

#### SIGNUP Flow
```javascript
// POST /api/auth/signup
{
  name, email, password
} 
  ↓
authService.register()
  - Check user exists (findOne)
  - Hash password (bcryptjs)
  - Create user
  - Generate JWT token (7d expiry)
  - Return { user, token }
```

#### LOGIN Flow
```javascript
// POST /api/auth/login
{
  email, password
}
  ↓
authService.login()
  - Find user by email
  - Verify password (bcryptjs compare)
  - Generate JWT token
  - Return { user, token }
```

#### GOOGLE AUTH (REST Endpoint)
```javascript
// POST /api/auth/google
{
  googleId, name, email, avatar
}
  ↓
authService.googleLogin()
  - Find user by email (⚠️ CRITICAL: searches by email, not googleId!)
  - If not found, create with googleId, name, email, avatar
  - Generate JWT token
  - Return { user, token }
```

#### GOOGLE AUTH (Passport Flow - INCOMPLETE)
```javascript
// GET /api/auth/google
  ↓
passport.authenticate('google', { scope: ['profile', 'email'] })
  ↓
// User logs in on Google
  ↓
// GET /api/auth/google/callback
  ↓
GoogleStrategy callback:
  - Extract: id, displayName, emails, photos
  - Find user by googleId
  - If not found, create user
  - Serialize user session
  ↓
Redirect to CLIENT_URL/dashboard
```

### Token Generation & Verification

**Generate:**
```javascript
jwt.sign(
  { id: userId },
  process.env.JWT_SECRET,
  { expiresIn: "7d" }
)
```

**Verify (in protect middleware):**
```javascript
// Bearer token in Authorization header
const token = req.headers.authorization.split(" ")[1];
const decoded = jwt.verify(token, process.env.JWT_SECRET);
req.user = User.findById(decoded.id).select("-password");
```

**Issues:**
- ❌ No refresh token mechanism
- ❌ JWT_SECRET must be strong (not validated in code)
- ❌ No token rotation
- ❌ No token blacklist for logout
- ❌ 7-day expiry may be too long for sensitive operations

### Middleware Stack

**Order in server.js:**
1. `express.json()` - Body parser
2. `cookieParser()` - Cookie parsing
3. `cors()` - CORS handling (origin checking, credentials)
4. `express.static(/uploads)` - Static file serving
5. `passport.initialize()` - Passport setup
6. `passport.session()` - Session management
7. Routes
8. `errorHandler` - Global error handler

**CORS Configuration:**
```javascript
const allowedOrigins = [
  process.env.CLIENT_URL,
  "https://digitaltwin.techtrekkers.ai"
];

const isLocalFrontend = /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);

cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || isLocalFrontend(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true
})
```

**Issues:**
- ⚠️ Relies on `process.env.CLIENT_URL` being set (may not be in dev)
- ⚠️ Loose CORS on localhost (dangerous in production if not careful)
- ✅ Credentials allowed (needed for cookies)

### Auth Middleware
```javascript
// protect middleware (very basic)
export const protect = async (req, res, next) => {
  let token;
  
  if (req.headers.authorization?.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select("-password");
      next();
    } catch (err) {
      res.status(401).json({ message: "Not authorized, token failed" });
    }
  }
  
  if (!token) {
    res.status(401).json({ message: "Not authorized, no token" });
  }
};
```

**Issues:**
- ❌ No checks for revoked/blacklisted tokens
- ❌ No token expiry verification (JWT lib handles it, but no custom logic)
- ❌ User.
```


## License: unknown
https://github.com/BhargovJD/React-2021/blob/561058e6d7880040f0d5cf1f1c63758f6b13db4a/32%20MernStack/DigitalDiaryApp/backend/middlewares/auth-middleware.js

```
Now I'll generate a comprehensive architecture audit. Based on my deep analysis of both frontend and backend code, here's the complete assessment:

---

# ARCHITECTURE AUDIT: DIGITAL TWIN PLATFORM
## Production-Grade Pre-Implementation Review

---

## EXECUTIVE SUMMARY

This is a **user-centric SaaS platform** with:
- **Manual authentication** (email/password) + **REST-based Google OAuth**
- **React 18 + TypeScript frontend** with shadcn/ui component library
- **Express.js backend** with MongoDB + Mongoose ORM
- **JWT token-based auth** (7-day expiry) with localStorage persistence
- **Per-user digital twin profiles** with complex nested data structures
- **Lead tracking system** for business intelligence

### Current Auth Status: **FUNCTIONAL BUT INCOMPLETE**
- Manual signup/login flows are implemented
- Google OAuth foundation exists but frontend implementation is commented out
- No refresh token mechanism
- No password reset flow
- No email verification

---

## 1. CURRENT FRONTEND ARCHITECTURE

### Framework & Tooling
```
React 18.3.1 + TypeScript + Vite (module-based)
Build Tool: Vite with React SWC plugin
Styling: Tailwind CSS + shadcn/ui components
State Management: React Context API + TanStack React Query
HTTP Client: Axios with interceptors
Routing: React Router v6.30.2
Animation: Framer Motion + GSAP
```

### Project Structure
```
src/
├── pages/
│   ├── Login.tsx              (Email/password login form)
│   ├── Signup.tsx             (Email/password signup form)
│   ├── Dashboard.tsx          (User dashboard with twins & leads)
│   ├── Chatbot.tsx            (Chat interface for digital twins)
│   ├── Index.tsx              (Digital twin wizard/builder)
│   ├── Landing.tsx            (Marketing landing page)
│   └── LandingPages/          (Landing page variants)
├── components/
│   ├── GoogleOAuth.tsx        (INCOMPLETE - Google auth component)
│   ├── DigitalTwinWizard.tsx (Wizard for creating twins)
│   └── ui/                    (Reusable shadcn/ui components)
├── contexts/
│   ├── AuthContext.tsx        (PARTIALLY COMMENTED OUT)
│   ├── DigitalTwinContext.tsx (Digital twin state management)
│   └── ProtectedRoute.tsx     (Route protection wrapper)
├── services/
│   └── api.service.ts         (Centralized API calls)
├── hooks/
│   ├── use-mobile.tsx
│   └── use-toast.ts
├── lib/
│   └── utils.ts
├── types/
│   └── digitalTwin.ts
└── axios.config.ts            (Axios instance with interceptors)
```

### Authentication Flow (Current)

#### SIGNUP Flow
```
User Input (name, email, password, confirm password)
  ↓
useAuth.signup() via AuthContext
  ↓
POST /api/auth/signup (email, password)
  ↓
Response: { user, token }
  ↓
Store: localStorage['token'] + localStorage['user']
  ↓
Update: AuthContext state
  ↓
Navigate: /wizard (digital twin builder)
```

#### LOGIN Flow
```
User Input (email, password)
  ↓
useAuth.login() via AuthContext
  ↓
POST /api/auth/login (email, password)
  ↓
Response: { user, token }
  ↓
Store: localStorage['token'] + localStorage['user']
  ↓
Update: AuthContext state
  ↓
Navigate: /dashboard
```

#### GOOGLE AUTH Flow (INCOMPLETE/COMMENTED)
```
Frontend attempts to:
1. Load Google API (window.google)
2. Initialize Google OAuth2 with client ID
3. Show One Tap UI or redirect to passport flow
4. Parse JWT credential
5. POST /api/auth/google with parsed data

Backend:
  POST /api/auth/google → createGoogleUser → return token
  OR
  GET /api/auth/google → passport.authenticate()
  → GET /api/auth/google/callback → redirect /dashboard
```

### Token & Session Management

**Token Storage Strategy:**
- Location: `localStorage['token']` (INSECURE - vulnerable to XSS)
- Format: JWT (Bearer token)
- Expiry: 7 days (server-side)
- Refresh: NONE (manual re-login required)

**Session Restoration:**
```typescript
// On app load via AuthContext
useEffect(() => {
  const storedToken = localStorage.getItem('token');
  const storedUser = localStorage.getItem('user');
  
  if (storedToken) {
    setToken(storedToken);
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    } else {
      getProfile(); // Fetch profile if missing
    }
  }
  setIsLoading(false);
}, []);
```

**Axios Interceptor:**
```typescript
// Request: Auto-attach token
interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response: Handle 401 on protected routes
interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !isAuthRequest) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login'; // Hard redirect
    }
    return Promise.reject(error);
  }
);
```

### Protected Routes
```typescript
// ProtectedRoute.tsx
if (isLoading) return <Loader />;
return user ? <>{children}</> : <Navigate to="/login" />;
```

### Current Auth Context (Status: PARTIALLY DISABLED)
- Most methods are commented out
- Fallback to basic fetch-based implementation in some places
- useAuth hook is the primary interface
- No error recovery for network failures

### Onboarding Flow
```
1. User lands on Landing.tsx (marketing site)
2. User clicks "Get Started" → Signup.tsx
3. Fill name, email, password
4. POST /api/auth/signup
5. Auto-logged in
6. Redirect to /wizard (Digital Twin Builder)
7. Fill detailed profile (identity, skills, experience, etc.)
8. POST /api/digital-twin/create
9. Redirect to /dashboard
10. View digital twin, see leads, manage profile
```

### Key Frontend Issues Identified

| Issue | Severity | Impact |
|-------|----------|---------|
| Token stored in localStorage | CRITICAL | XSS vulnerability, no CSRF protection |
| No refresh token mechanism | HIGH | User must re-login after 7 days |
| AuthContext partially commented | HIGH | Code maintainability, unclear intent |
| GoogleOAuth unfinished | HIGH | Google auth non-functional |
| No password reset UI/flow | MEDIUM | Users locked out if forgotten password |
| No email verification | MEDIUM | Spam/invalid emails possible |
| Hard redirect on 401 (losing context) | MEDIUM | Bad UX, state loss |
| No request retry logic | MEDIUM | Network hiccups = failed requests |
| Profile picture upload hardcoded URL | MEDIUM | Breaks with different API endpoints |
| No loading/error states in Dashboard | LOW | May seem frozen during loads |
| Axios base URL env var inconsistent | LOW | Frontend/backend URL mismatch risk |

### Strengths
✅ Modern React + TypeScript foundation
✅ Centralized API service layer (clean separation)
✅ Reusable shadcn/ui components
✅ Protected route abstraction
✅ Axios interceptor pattern
✅ React Query integration for data fetching
✅ Framer Motion for animations
✅ Type-safe with zod validation support

---

## 2. CURRENT BACKEND ARCHITECTURE

### Framework & Technology Stack
```
Node.js + Express.js 5.1.0 (modern version)
Database: MongoDB + Mongoose 8.19.2 (ES modules)
Authentication: Passport.js + JWT
File Upload: Multer
Password Security: bcryptjs
API Docs: None (manual implementation)
Environment: dotenv (but not fully used)
Error Handling: Custom middleware
```

### Project Structure
```
src/
├── server.js                  (Express app setup, middlewares, routes)
├── config/
│   ├── db.js                  (MongoDB connection)
│   └── passport.js            (Google OAuth strategy)
├── models/
│   ├── User.js                (User schema)
│   ├── DigitalTwin.js         (Digital twin schema - complex)
│   ├── Lead.js                (Lead tracking)
│   └── Message.js             (Chat messages - not analyzed)
├── controllers/
│   ├── authController.js      (Signup, login, Google auth)
│   ├── profileController.js   (Profile management, picture upload)
│   ├── digitalTwinController.js (Twin CRUD operations)
│   ├── chatController.js      (Chat operations)
│   └── leadController.js      (Lead CRUD operations)
├── middleware/
│   ├── authMiddleware.js      (JWT token verification)
│   ├── errorMiddleware.js     (Global error handler)
│   └── asyncHandler.js        (Async error wrapper)
├── routes/
│   ├── authRoutes.js          (Auth endpoints)
│   ├── digitalTwinRoutes.js   (Twin endpoints)
│   ├── chatRoutes.js          (Chat endpoints)
│   └── leadRoutes.js          (Lead endpoints)
├── services/
│   ├── authService.js         (Auth business logic)
│   ├── digitalTwinService.js  (Twin business logic)
│   ├── chatService.js         (Chat business logic)
│   └── leadService.js         (Lead business logic)
├── utils/
│   └── generateToken.js       (JWT token generation)
└── uploads/
    └── profile-pictures/      (File storage for profile pics)
```

### User Model (Current Schema)
```javascript
{
  name: String (required),
  email: String (required, unique),
  password: String (optional - for manual auth),
  googleId: String (optional - for Google auth),
  avatar: String (optional - from Google),
  profilePicture: String (optional - uploaded),
  timestamps: true
}
```

**Issues with User Model:**
- ❌ No `provider` field (can't track auth method)
- ❌ No `emailVerified` field (no email verification)
- ❌ No `lastLogin` tracking
- ❌ No `isActive` flag (no soft deletes)
- ❌ No `refreshToken` storage (no refresh mechanism)
- ❌ Both `password` and `googleId` optional (allows creating invalid users)
- ⚠️ `profilePicture` and `avatar` are separate (confusion)

### Digital Twin Model (Current)
```javascript
{
  user: ObjectId (ref: User, required, unique per user),
  identity: {
    name: String,
    role: String,
    tagline: String,
    bio: String
  },
  businesses: [
    {
      name: String,
      role: String,
      description: String,
      link: String,
      products: [String],
      duration: String
    }
  ],
  experience: [
    {
      company: String,
      role: String,
      duration: String,
      key_projects: [String]
    }
  ],
  education: [
    {
      institution: String,
      degree: String,
      year: String
    }
  ],
  skills: {
    list: [String],
    coreDomains: String,
    signatureStrengths: String
  },
  personality: {
    traits: [String],
    leadership_style: String,
    decision_style: String,
    tone: String,
    archetype: String,
    values: [String]
  },
  story: {
    mission: String,
    impact: String,
    themes: [String]
  },
  networking: {
    audience: String,
    intent: String,
    boundaries: [String]
  },
  links: {
    linkedin: String,
    website: String,
    portfolio: String,
    socials: [String]
  },
  isActive: Boolean (default: true),
  lastUpdated: Date,
  timestamps: true,
  indexes: [user, text search on identity]
}
```

✅ Well-designed schema for digital twin profiles
✅ Good separation of concerns (identity, skills, personality, etc.)
✅ Text search indexes for discovery
⚠️ No versioning/history tracking
⚠️ No public/private field separation (all data treated as public on /public/:twinId)

### Authentication Flow (Backend)

#### SIGNUP Flow
```javascript
// POST /api/auth/signup
{
  name, email, password
} 
  ↓
authService.register()
  - Check user exists (findOne)
  - Hash password (bcryptjs)
  - Create user
  - Generate JWT token (7d expiry)
  - Return { user, token }
```

#### LOGIN Flow
```javascript
// POST /api/auth/login
{
  email, password
}
  ↓
authService.login()
  - Find user by email
  - Verify password (bcryptjs compare)
  - Generate JWT token
  - Return { user, token }
```

#### GOOGLE AUTH (REST Endpoint)
```javascript
// POST /api/auth/google
{
  googleId, name, email, avatar
}
  ↓
authService.googleLogin()
  - Find user by email (⚠️ CRITICAL: searches by email, not googleId!)
  - If not found, create with googleId, name, email, avatar
  - Generate JWT token
  - Return { user, token }
```

#### GOOGLE AUTH (Passport Flow - INCOMPLETE)
```javascript
// GET /api/auth/google
  ↓
passport.authenticate('google', { scope: ['profile', 'email'] })
  ↓
// User logs in on Google
  ↓
// GET /api/auth/google/callback
  ↓
GoogleStrategy callback:
  - Extract: id, displayName, emails, photos
  - Find user by googleId
  - If not found, create user
  - Serialize user session
  ↓
Redirect to CLIENT_URL/dashboard
```

### Token Generation & Verification

**Generate:**
```javascript
jwt.sign(
  { id: userId },
  process.env.JWT_SECRET,
  { expiresIn: "7d" }
)
```

**Verify (in protect middleware):**
```javascript
// Bearer token in Authorization header
const token = req.headers.authorization.split(" ")[1];
const decoded = jwt.verify(token, process.env.JWT_SECRET);
req.user = User.findById(decoded.id).select("-password");
```

**Issues:**
- ❌ No refresh token mechanism
- ❌ JWT_SECRET must be strong (not validated in code)
- ❌ No token rotation
- ❌ No token blacklist for logout
- ❌ 7-day expiry may be too long for sensitive operations

### Middleware Stack

**Order in server.js:**
1. `express.json()` - Body parser
2. `cookieParser()` - Cookie parsing
3. `cors()` - CORS handling (origin checking, credentials)
4. `express.static(/uploads)` - Static file serving
5. `passport.initialize()` - Passport setup
6. `passport.session()` - Session management
7. Routes
8. `errorHandler` - Global error handler

**CORS Configuration:**
```javascript
const allowedOrigins = [
  process.env.CLIENT_URL,
  "https://digitaltwin.techtrekkers.ai"
];

const isLocalFrontend = /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);

cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || isLocalFrontend(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true
})
```

**Issues:**
- ⚠️ Relies on `process.env.CLIENT_URL` being set (may not be in dev)
- ⚠️ Loose CORS on localhost (dangerous in production if not careful)
- ✅ Credentials allowed (needed for cookies)

### Auth Middleware
```javascript
// protect middleware (very basic)
export const protect = async (req, res, next) => {
  let token;
  
  if (req.headers.authorization?.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select("-password");
      next();
    } catch (err) {
      res.status(401).json({ message: "Not authorized, token failed" });
    }
  }
  
  if (!token) {
    res.status(401).json({ message: "Not authorized, no token" });
  }
};
```

**Issues:**
- ❌ No checks for revoked/blacklisted tokens
- ❌ No token expiry verification (JWT lib handles it, but no custom logic)
- ❌ User.
```


## License: unknown
https://github.com/devastion/tmdb-api-use/blob/22998f24ac5a464ecb9d76cbc6e735b3eba07cd5/server/middleware/authMiddleware.js

```
Now I'll generate a comprehensive architecture audit. Based on my deep analysis of both frontend and backend code, here's the complete assessment:

---

# ARCHITECTURE AUDIT: DIGITAL TWIN PLATFORM
## Production-Grade Pre-Implementation Review

---

## EXECUTIVE SUMMARY

This is a **user-centric SaaS platform** with:
- **Manual authentication** (email/password) + **REST-based Google OAuth**
- **React 18 + TypeScript frontend** with shadcn/ui component library
- **Express.js backend** with MongoDB + Mongoose ORM
- **JWT token-based auth** (7-day expiry) with localStorage persistence
- **Per-user digital twin profiles** with complex nested data structures
- **Lead tracking system** for business intelligence

### Current Auth Status: **FUNCTIONAL BUT INCOMPLETE**
- Manual signup/login flows are implemented
- Google OAuth foundation exists but frontend implementation is commented out
- No refresh token mechanism
- No password reset flow
- No email verification

---

## 1. CURRENT FRONTEND ARCHITECTURE

### Framework & Tooling
```
React 18.3.1 + TypeScript + Vite (module-based)
Build Tool: Vite with React SWC plugin
Styling: Tailwind CSS + shadcn/ui components
State Management: React Context API + TanStack React Query
HTTP Client: Axios with interceptors
Routing: React Router v6.30.2
Animation: Framer Motion + GSAP
```

### Project Structure
```
src/
├── pages/
│   ├── Login.tsx              (Email/password login form)
│   ├── Signup.tsx             (Email/password signup form)
│   ├── Dashboard.tsx          (User dashboard with twins & leads)
│   ├── Chatbot.tsx            (Chat interface for digital twins)
│   ├── Index.tsx              (Digital twin wizard/builder)
│   ├── Landing.tsx            (Marketing landing page)
│   └── LandingPages/          (Landing page variants)
├── components/
│   ├── GoogleOAuth.tsx        (INCOMPLETE - Google auth component)
│   ├── DigitalTwinWizard.tsx (Wizard for creating twins)
│   └── ui/                    (Reusable shadcn/ui components)
├── contexts/
│   ├── AuthContext.tsx        (PARTIALLY COMMENTED OUT)
│   ├── DigitalTwinContext.tsx (Digital twin state management)
│   └── ProtectedRoute.tsx     (Route protection wrapper)
├── services/
│   └── api.service.ts         (Centralized API calls)
├── hooks/
│   ├── use-mobile.tsx
│   └── use-toast.ts
├── lib/
│   └── utils.ts
├── types/
│   └── digitalTwin.ts
└── axios.config.ts            (Axios instance with interceptors)
```

### Authentication Flow (Current)

#### SIGNUP Flow
```
User Input (name, email, password, confirm password)
  ↓
useAuth.signup() via AuthContext
  ↓
POST /api/auth/signup (email, password)
  ↓
Response: { user, token }
  ↓
Store: localStorage['token'] + localStorage['user']
  ↓
Update: AuthContext state
  ↓
Navigate: /wizard (digital twin builder)
```

#### LOGIN Flow
```
User Input (email, password)
  ↓
useAuth.login() via AuthContext
  ↓
POST /api/auth/login (email, password)
  ↓
Response: { user, token }
  ↓
Store: localStorage['token'] + localStorage['user']
  ↓
Update: AuthContext state
  ↓
Navigate: /dashboard
```

#### GOOGLE AUTH Flow (INCOMPLETE/COMMENTED)
```
Frontend attempts to:
1. Load Google API (window.google)
2. Initialize Google OAuth2 with client ID
3. Show One Tap UI or redirect to passport flow
4. Parse JWT credential
5. POST /api/auth/google with parsed data

Backend:
  POST /api/auth/google → createGoogleUser → return token
  OR
  GET /api/auth/google → passport.authenticate()
  → GET /api/auth/google/callback → redirect /dashboard
```

### Token & Session Management

**Token Storage Strategy:**
- Location: `localStorage['token']` (INSECURE - vulnerable to XSS)
- Format: JWT (Bearer token)
- Expiry: 7 days (server-side)
- Refresh: NONE (manual re-login required)

**Session Restoration:**
```typescript
// On app load via AuthContext
useEffect(() => {
  const storedToken = localStorage.getItem('token');
  const storedUser = localStorage.getItem('user');
  
  if (storedToken) {
    setToken(storedToken);
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    } else {
      getProfile(); // Fetch profile if missing
    }
  }
  setIsLoading(false);
}, []);
```

**Axios Interceptor:**
```typescript
// Request: Auto-attach token
interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response: Handle 401 on protected routes
interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !isAuthRequest) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login'; // Hard redirect
    }
    return Promise.reject(error);
  }
);
```

### Protected Routes
```typescript
// ProtectedRoute.tsx
if (isLoading) return <Loader />;
return user ? <>{children}</> : <Navigate to="/login" />;
```

### Current Auth Context (Status: PARTIALLY DISABLED)
- Most methods are commented out
- Fallback to basic fetch-based implementation in some places
- useAuth hook is the primary interface
- No error recovery for network failures

### Onboarding Flow
```
1. User lands on Landing.tsx (marketing site)
2. User clicks "Get Started" → Signup.tsx
3. Fill name, email, password
4. POST /api/auth/signup
5. Auto-logged in
6. Redirect to /wizard (Digital Twin Builder)
7. Fill detailed profile (identity, skills, experience, etc.)
8. POST /api/digital-twin/create
9. Redirect to /dashboard
10. View digital twin, see leads, manage profile
```

### Key Frontend Issues Identified

| Issue | Severity | Impact |
|-------|----------|---------|
| Token stored in localStorage | CRITICAL | XSS vulnerability, no CSRF protection |
| No refresh token mechanism | HIGH | User must re-login after 7 days |
| AuthContext partially commented | HIGH | Code maintainability, unclear intent |
| GoogleOAuth unfinished | HIGH | Google auth non-functional |
| No password reset UI/flow | MEDIUM | Users locked out if forgotten password |
| No email verification | MEDIUM | Spam/invalid emails possible |
| Hard redirect on 401 (losing context) | MEDIUM | Bad UX, state loss |
| No request retry logic | MEDIUM | Network hiccups = failed requests |
| Profile picture upload hardcoded URL | MEDIUM | Breaks with different API endpoints |
| No loading/error states in Dashboard | LOW | May seem frozen during loads |
| Axios base URL env var inconsistent | LOW | Frontend/backend URL mismatch risk |

### Strengths
✅ Modern React + TypeScript foundation
✅ Centralized API service layer (clean separation)
✅ Reusable shadcn/ui components
✅ Protected route abstraction
✅ Axios interceptor pattern
✅ React Query integration for data fetching
✅ Framer Motion for animations
✅ Type-safe with zod validation support

---

## 2. CURRENT BACKEND ARCHITECTURE

### Framework & Technology Stack
```
Node.js + Express.js 5.1.0 (modern version)
Database: MongoDB + Mongoose 8.19.2 (ES modules)
Authentication: Passport.js + JWT
File Upload: Multer
Password Security: bcryptjs
API Docs: None (manual implementation)
Environment: dotenv (but not fully used)
Error Handling: Custom middleware
```

### Project Structure
```
src/
├── server.js                  (Express app setup, middlewares, routes)
├── config/
│   ├── db.js                  (MongoDB connection)
│   └── passport.js            (Google OAuth strategy)
├── models/
│   ├── User.js                (User schema)
│   ├── DigitalTwin.js         (Digital twin schema - complex)
│   ├── Lead.js                (Lead tracking)
│   └── Message.js             (Chat messages - not analyzed)
├── controllers/
│   ├── authController.js      (Signup, login, Google auth)
│   ├── profileController.js   (Profile management, picture upload)
│   ├── digitalTwinController.js (Twin CRUD operations)
│   ├── chatController.js      (Chat operations)
│   └── leadController.js      (Lead CRUD operations)
├── middleware/
│   ├── authMiddleware.js      (JWT token verification)
│   ├── errorMiddleware.js     (Global error handler)
│   └── asyncHandler.js        (Async error wrapper)
├── routes/
│   ├── authRoutes.js          (Auth endpoints)
│   ├── digitalTwinRoutes.js   (Twin endpoints)
│   ├── chatRoutes.js          (Chat endpoints)
│   └── leadRoutes.js          (Lead endpoints)
├── services/
│   ├── authService.js         (Auth business logic)
│   ├── digitalTwinService.js  (Twin business logic)
│   ├── chatService.js         (Chat business logic)
│   └── leadService.js         (Lead business logic)
├── utils/
│   └── generateToken.js       (JWT token generation)
└── uploads/
    └── profile-pictures/      (File storage for profile pics)
```

### User Model (Current Schema)
```javascript
{
  name: String (required),
  email: String (required, unique),
  password: String (optional - for manual auth),
  googleId: String (optional - for Google auth),
  avatar: String (optional - from Google),
  profilePicture: String (optional - uploaded),
  timestamps: true
}
```

**Issues with User Model:**
- ❌ No `provider` field (can't track auth method)
- ❌ No `emailVerified` field (no email verification)
- ❌ No `lastLogin` tracking
- ❌ No `isActive` flag (no soft deletes)
- ❌ No `refreshToken` storage (no refresh mechanism)
- ❌ Both `password` and `googleId` optional (allows creating invalid users)
- ⚠️ `profilePicture` and `avatar` are separate (confusion)

### Digital Twin Model (Current)
```javascript
{
  user: ObjectId (ref: User, required, unique per user),
  identity: {
    name: String,
    role: String,
    tagline: String,
    bio: String
  },
  businesses: [
    {
      name: String,
      role: String,
      description: String,
      link: String,
      products: [String],
      duration: String
    }
  ],
  experience: [
    {
      company: String,
      role: String,
      duration: String,
      key_projects: [String]
    }
  ],
  education: [
    {
      institution: String,
      degree: String,
      year: String
    }
  ],
  skills: {
    list: [String],
    coreDomains: String,
    signatureStrengths: String
  },
  personality: {
    traits: [String],
    leadership_style: String,
    decision_style: String,
    tone: String,
    archetype: String,
    values: [String]
  },
  story: {
    mission: String,
    impact: String,
    themes: [String]
  },
  networking: {
    audience: String,
    intent: String,
    boundaries: [String]
  },
  links: {
    linkedin: String,
    website: String,
    portfolio: String,
    socials: [String]
  },
  isActive: Boolean (default: true),
  lastUpdated: Date,
  timestamps: true,
  indexes: [user, text search on identity]
}
```

✅ Well-designed schema for digital twin profiles
✅ Good separation of concerns (identity, skills, personality, etc.)
✅ Text search indexes for discovery
⚠️ No versioning/history tracking
⚠️ No public/private field separation (all data treated as public on /public/:twinId)

### Authentication Flow (Backend)

#### SIGNUP Flow
```javascript
// POST /api/auth/signup
{
  name, email, password
} 
  ↓
authService.register()
  - Check user exists (findOne)
  - Hash password (bcryptjs)
  - Create user
  - Generate JWT token (7d expiry)
  - Return { user, token }
```

#### LOGIN Flow
```javascript
// POST /api/auth/login
{
  email, password
}
  ↓
authService.login()
  - Find user by email
  - Verify password (bcryptjs compare)
  - Generate JWT token
  - Return { user, token }
```

#### GOOGLE AUTH (REST Endpoint)
```javascript
// POST /api/auth/google
{
  googleId, name, email, avatar
}
  ↓
authService.googleLogin()
  - Find user by email (⚠️ CRITICAL: searches by email, not googleId!)
  - If not found, create with googleId, name, email, avatar
  - Generate JWT token
  - Return { user, token }
```

#### GOOGLE AUTH (Passport Flow - INCOMPLETE)
```javascript
// GET /api/auth/google
  ↓
passport.authenticate('google', { scope: ['profile', 'email'] })
  ↓
// User logs in on Google
  ↓
// GET /api/auth/google/callback
  ↓
GoogleStrategy callback:
  - Extract: id, displayName, emails, photos
  - Find user by googleId
  - If not found, create user
  - Serialize user session
  ↓
Redirect to CLIENT_URL/dashboard
```

### Token Generation & Verification

**Generate:**
```javascript
jwt.sign(
  { id: userId },
  process.env.JWT_SECRET,
  { expiresIn: "7d" }
)
```

**Verify (in protect middleware):**
```javascript
// Bearer token in Authorization header
const token = req.headers.authorization.split(" ")[1];
const decoded = jwt.verify(token, process.env.JWT_SECRET);
req.user = User.findById(decoded.id).select("-password");
```

**Issues:**
- ❌ No refresh token mechanism
- ❌ JWT_SECRET must be strong (not validated in code)
- ❌ No token rotation
- ❌ No token blacklist for logout
- ❌ 7-day expiry may be too long for sensitive operations

### Middleware Stack

**Order in server.js:**
1. `express.json()` - Body parser
2. `cookieParser()` - Cookie parsing
3. `cors()` - CORS handling (origin checking, credentials)
4. `express.static(/uploads)` - Static file serving
5. `passport.initialize()` - Passport setup
6. `passport.session()` - Session management
7. Routes
8. `errorHandler` - Global error handler

**CORS Configuration:**
```javascript
const allowedOrigins = [
  process.env.CLIENT_URL,
  "https://digitaltwin.techtrekkers.ai"
];

const isLocalFrontend = /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);

cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || isLocalFrontend(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true
})
```

**Issues:**
- ⚠️ Relies on `process.env.CLIENT_URL` being set (may not be in dev)
- ⚠️ Loose CORS on localhost (dangerous in production if not careful)
- ✅ Credentials allowed (needed for cookies)

### Auth Middleware
```javascript
// protect middleware (very basic)
export const protect = async (req, res, next) => {
  let token;
  
  if (req.headers.authorization?.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select("-password");
      next();
    } catch (err) {
      res.status(401).json({ message: "Not authorized, token failed" });
    }
  }
  
  if (!token) {
    res.status(401).json({ message: "Not authorized, no token" });
  }
};
```

**Issues:**
- ❌ No checks for revoked/blacklisted tokens
- ❌ No token expiry verification (JWT lib handles it, but no custom logic)
- ❌ User.
```

