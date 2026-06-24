const REQUIRED_VARIABLES = [
  'DB_HOST',
  'DB_USERNAME',
  'DB_PASSWORD',
  'DB_NAME',
  'JWT_SECRET',
  'JWT_EXPIRATION_TIME',
  'JWT_REFRESH_EXPIRATION_TIME',
] as const;

function parseNumber(name: string, value: unknown, fallback?: number): number {
  const rawValue = value ?? fallback;
  const parsedValue = Number(rawValue);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsedValue;
}

function parseBoolean(name: string, value: unknown, fallback = false): boolean {
  if (value === undefined || value === '') return fallback;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;

  throw new Error(`${name} must be either true or false`);
}

export function validateEnvironment(
  config: Record<string, unknown>,
): Record<string, unknown> {
  for (const variable of REQUIRED_VARIABLES) {
    if (typeof config[variable] !== 'string' || !config[variable].trim()) {
      throw new Error(`${variable} is required`);
    }
  }

  const nodeEnv = String(config.NODE_ENV ?? 'development');
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    throw new Error('NODE_ENV must be development, test, or production');
  }

  const synchronize = parseBoolean('DB_SYNC', config.DB_SYNC);
  if (nodeEnv === 'production' && synchronize) {
    throw new Error('DB_SYNC must be false in production; use migrations instead');
  }

  return {
    ...config,
    NODE_ENV: nodeEnv,
    DB_PORT: parseNumber('DB_PORT', config.DB_PORT, 5432),
    DB_SYNC: synchronize,
    PORT: parseNumber('PORT', config.PORT, 3001),
    CORS_ORIGINS: String(config.CORS_ORIGINS ?? 'http://localhost:3000'),
  };
}
