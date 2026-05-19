import Joi from 'joi';

/**
 * Request validation schemas for auth endpoints
 */

// Signup validation
export const signupSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .required()
    .messages({
      'string.empty': 'Name is required',
      'string.min': 'Name must be at least 2 characters',
      'string.max': 'Name must be less than 100 characters'
    }),

  email: Joi.string()
    .email()
    .lowercase()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'string.empty': 'Email is required'
    }),

  password: Joi.string()
    .min(8)
    .max(100)
    .required()
    .pattern(/[A-Z]/)
    .pattern(/[a-z]/)
    .pattern(/[0-9]/)
    .messages({
      'string.empty': 'Password is required',
      'string.min': 'Password must be at least 8 characters',
      'string.max': 'Password must be less than 100 characters',
      'string.pattern.base':
        'Password must contain uppercase letters, lowercase letters, and numbers'
    })
});

// Login validation
export const loginSchema = Joi.object({
  email: Joi.string()
    .email()
    .lowercase()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'string.empty': 'Email is required'
    }),

  password: Joi.string()
    .required()
    .messages({
      'string.empty': 'Password is required'
    })
});

// Google login validation
export const googleLoginSchema = Joi.object({
  token: Joi.string()
    .required()
    .messages({
      'string.empty': 'Google token is required'
    })
});

// Refresh token validation
export const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string()
    .required()
    .messages({
      'string.empty': 'Refresh token is required'
    })
});

// Password reset request validation
export const forgotPasswordSchema = Joi.object({
  email: Joi.string()
    .email()
    .lowercase()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'string.empty': 'Email is required'
    })
});

// Password reset validation
export const resetPasswordSchema = Joi.object({
  token: Joi.string()
    .required()
    .messages({
      'string.empty': 'Reset token is required'
    }),

  password: Joi.string()
    .min(8)
    .max(100)
    .required()
    .pattern(/[A-Z]/)
    .pattern(/[a-z]/)
    .pattern(/[0-9]/)
    .messages({
      'string.empty': 'Password is required',
      'string.min': 'Password must be at least 8 characters',
      'string.max': 'Password must be less than 100 characters',
      'string.pattern.base':
        'Password must contain uppercase letters, lowercase letters, and numbers'
    })
});

// Email verification validation
export const verifyEmailSchema = Joi.object({
  token: Joi.string()
    .required()
    .messages({
      'string.empty': 'Verification token is required'
    })
});

// Change password validation
export const changePasswordSchema = Joi.object({
  oldPassword: Joi.string()
    .required()
    .messages({
      'string.empty': 'Current password is required'
    }),

  newPassword: Joi.string()
    .min(8)
    .max(100)
    .required()
    .pattern(/[A-Z]/)
    .pattern(/[a-z]/)
    .pattern(/[0-9]/)
    .messages({
      'string.empty': 'New password is required',
      'string.min': 'Password must be at least 8 characters',
      'string.max': 'Password must be less than 100 characters',
      'string.pattern.base':
        'Password must contain uppercase letters, lowercase letters, and numbers'
    })
});

// Update profile validation
export const updateProfileSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .messages({
      'string.min': 'Name must be at least 2 characters',
      'string.max': 'Name must be less than 100 characters'
    }),

  profilePicture: Joi.string()
    .uri()
    .messages({
      'string.uri': 'Profile picture must be a valid URL'
    }),

  avatar: Joi.string()
    .uri()
    .messages({
      'string.uri': 'Avatar must be a valid URL'
    })
});

/**
 * Validation middleware factory
 */
export const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const messages = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: messages
      });
    }

    // Replace request body with validated data
    req.body = value;
    next();
  };
};

export default {
  signupSchema,
  loginSchema,
  googleLoginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  changePasswordSchema,
  updateProfileSchema,
  validateRequest
};
