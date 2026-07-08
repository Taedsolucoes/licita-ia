/**
 * Centralized environment configuration for the mobile client.
 *
 * Set EXPO_PUBLIC_API_URL in your .env file (or export it before running expo)
 * to point the app at the deployed Railway backend.
 *
 * Example:
 *   EXPO_PUBLIC_API_URL=https://lively-inspiration-production-684b.up.railway.app/api
 *
 * NOTE: Must include the /api path prefix — the backend uses NestJS globalPrefix('api').
 *
 * EXPO_PUBLIC_* variables are injected at build-time by Expo SDK 49+.
 */
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  'https://lively-inspiration-production-684b.up.railway.app/api';
