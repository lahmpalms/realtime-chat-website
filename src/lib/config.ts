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

export function getConfig(): AppConfig {
  const env = (process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV || 'development') as AppEnvironment;
  const isProd = env === 'production';

  // Validate critical Firebase env vars in production
  if (isProd) {
    const required = [
      'NEXT_PUBLIC_FIREBASE_API_KEY',
      'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
      'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
      'NEXT_PUBLIC_FIREBASE_DATABASE_URL',
    ];
    const missing = required.filter((k) => !process.env[k]);
    if (missing.length) {
      // Throw early; Next.js will surface this during build/start
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
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


