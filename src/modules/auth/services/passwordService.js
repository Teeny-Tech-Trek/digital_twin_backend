import bcrypt from 'bcryptjs';

/**
 * Password hashing and verification service
 */
const passwordService = {
  /**
   * Hash password with bcrypt (10 rounds)
   */
  async hash(password) {
    if (!password || typeof password !== 'string') {
      throw new Error('Password must be a non-empty string');
    }
    
    // Validate minimum length (8 characters)
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }
    
    // Validate complexity: at least one uppercase, lowercase, number
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    
    if (!hasUpperCase || !hasLowerCase || !hasNumber) {
      throw new Error(
        'Password must contain uppercase, lowercase, and numbers'
      );
    }
    
    return bcrypt.hash(password, 10);
  },

  /**
   * Verify password against hash
   */
  async verify(password, hash) {
    if (!password || !hash) {
      return false;
    }
    return bcrypt.compare(password, hash);
  },

  /**
   * Validate password meets requirements
   */
  validatePassword(password) {
    const errors = [];
    
    if (!password) {
      errors.push('Password is required');
    }
    
    if (password && password.length < 8) {
      errors.push('Password must be at least 8 characters');
    }
    
    if (password && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    
    if (password && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    
    if (password && !/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
};

export default passwordService;
