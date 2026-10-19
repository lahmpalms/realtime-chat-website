export type AppEnvironment = 'development' | 'staging' | 'production';

export interface AppConfig {
  environment: AppEnvironment;
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    enableConsole: boolean;
    enableRemote: boolean;
  };
  features: {
    enableAnalytics: boolean;
    enableErrorReporting: boolean;
  };
}

export function validateFirebaseEnvironment(values: Record<string, string | undefined>): void {
  const missing = Object.entries(values).filter(([, value]) => !value?.trim()).map(([key]) => key);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}. See .env.example.`);
  }
}

export function getConfig(): AppConfig {
  const env = (process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV || 'development') as AppEnvironment;
  const isProd = env === 'production';

  // Validate critical Firebase env vars in production
  if (isProd) {
    validateFirebaseEnvironment({
      NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      NEXT_PUBLIC_FIREBASE_DATABASE_URL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
      NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    });
  }

  return {
    environment: env,
    logging: {
      level: isProd ? 'info' : 'debug',
      enableConsole: !isProd || process.env.NEXT_PUBLIC_ENABLE_CONSOLE_LOGS === 'true',
      enableRemote: isProd,
    },
    features: {
      enableAnalytics: isProd,
      enableErrorReporting: isProd,
    },
  };
}


