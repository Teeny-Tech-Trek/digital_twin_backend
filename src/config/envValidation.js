/**
 * Environment validation
 * Ensures all required environment variables are set and have valid values
 * Fails early if critical config is missing
 */

const validateEnv = () => {
  const required = [
    'MONGO_URI',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'CLIENT_URL'
  ];

  const missing = [];

  for (const key of required) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    console.error(
      `\n❌ CRITICAL: Missing required environment variables:\n${missing.map(k => `   - ${k}`).join('\n')}\n`
    );
    process.exit(1);
  }

  // Validate JWT_SECRET strength
  if (process.env.JWT_SECRET.length < 32) {
    console.error(
      '\n❌ CRITICAL: JWT_SECRET must be at least 32 characters long\n'
    );
    process.exit(1);
  }

  if (process.env.JWT_REFRESH_SECRET.length < 32) {
    console.error(
      '\n❌ CRITICAL: JWT_REFRESH_SECRET must be at least 32 characters long\n'
    );
    process.exit(1);
  }

  // Validate URLs
  try {
    new URL(process.env.CLIENT_URL);
  } catch (error) {
    console.error(
      `\n❌ CRITICAL: CLIENT_URL is not a valid URL: ${process.env.CLIENT_URL}\n`
    );
    process.exit(1);
  }

  console.log('✅ Environment validation passed');
  return true;
};

export default validateEnv;
