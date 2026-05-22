// Profile picture upload + removal.
//
// Lives in the auth module because it's a property of the authenticated user
// record (not a domain object). Mounted by authRoutes.js as:
//   PUT    /api/auth/profile/picture   — upload/replace
//   DELETE /api/auth/profile/picture   — remove
//
// Storage: local disk under <repo>/uploads/profile-pictures. The express
// `/uploads` static handler in server.js serves them publicly. In a future
// migration to S3/Vercel Blob, swap the multer storage engine and the URL
// construction in `buildPublicUrl` — the controller surface stays the same.
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import asyncHandler from '../../../middleware/asyncHandler.js';
import User from '../../../models/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Repo root is four levels up from this file (modules/auth/controllers → src → repo).
const UPLOAD_DIR = path.resolve(__dirname, '..', '..', '..', '..', 'uploads', 'profile-pictures');

// Ensure target directory exists on cold start; multer will not create
// nested dirs and a missing folder surfaces as ENOENT inside a generic
// "internal server error" which is annoying to debug.
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB — matches the FE pre-flight check.
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const stamp = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `profile-${req.userId}-${stamp}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  if (ALLOWED_MIME.includes(file.mimetype)) return cb(null, true);
  cb(new Error('Only JPG, PNG, WebP, or GIF images are allowed'));
};

export const upload = multer({
  storage,
  limits: { fileSize: MAX_BYTES },
  fileFilter,
});

const buildPublicUrl = (filename) => `/uploads/profile-pictures/${filename}`;

// Remove a previously-stored profile picture file from disk. Best-effort —
// we never block the response on this and we never let an ENOENT surface
// as a 500 (the file may have already been cleaned up, or it may be an
// external URL like a Google avatar that we never owned).
const safeUnlinkProfilePicture = (publicUrl) => {
  if (!publicUrl || typeof publicUrl !== 'string') return;
  if (!publicUrl.startsWith('/uploads/profile-pictures/')) return;
  const filename = path.basename(publicUrl);
  const absolute = path.join(UPLOAD_DIR, filename);
  fs.unlink(absolute, (err) => {
    if (err && err.code !== 'ENOENT') {
      console.error('Failed to delete old profile picture:', err);
    }
  });
};

/**
 * PUT /api/auth/profile/picture
 * multipart/form-data; field name: profilePicture
 */
export const updateProfilePicture = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res
      .status(400)
      .json({ success: false, message: 'No file uploaded' });
  }

  const user = await User.findById(req.userId);
  if (!user) {
    safeUnlinkProfilePicture(buildPublicUrl(req.file.filename));
    return res
      .status(404)
      .json({ success: false, message: 'User not found' });
  }

  // Clean up the previous file BEFORE replacing the field so a partial
  // failure leaves us with the new file (not orphaned).
  const previous = user.profilePicture;
  user.profilePicture = buildPublicUrl(req.file.filename);
  await user.save();
  safeUnlinkProfilePicture(previous);

  res.json({
    success: true,
    message: 'Profile picture updated successfully',
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      profilePicture: user.profilePicture,
      avatar: user.avatar,
    },
  });
});

/**
 * DELETE /api/auth/profile/picture
 */
export const removeProfilePicture = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) {
    return res
      .status(404)
      .json({ success: false, message: 'User not found' });
  }

  const previous = user.profilePicture;
  user.profilePicture = null;
  await user.save();
  safeUnlinkProfilePicture(previous);

  res.json({
    success: true,
    message: 'Profile picture removed',
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      profilePicture: user.profilePicture,
      avatar: user.avatar,
    },
  });
});

// Multer error → 4xx translation. Without this, multer rejections fall into
// the generic error handler and become 500s, which is wrong for a 5 MB
// limit hit or a non-image upload (both are user errors).
export const handleUploadError = (err, _req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        message: 'Profile picture must be 5 MB or smaller',
      });
    }
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err && err.message && err.message.toLowerCase().includes('allowed')) {
    return res.status(415).json({ success: false, message: err.message });
  }
  return next(err);
};
