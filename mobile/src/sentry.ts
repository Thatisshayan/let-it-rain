import * as Sentry from "@sentry/react-native";

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

export function initSentry() {
  if (!SENTRY_DSN) return;

  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: 0.2,
    profilesSampleRate: 0.2,
    environment: process.env.EXPO_PUBLIC_APP_ENVIRONMENT ?? "development",
    enableAutoPerformanceTracing: true,
    attachStacktrace: true,
    maxBreadcrumbs: 50,
    debug: __DEV__,
  });
}

export default Sentry;
