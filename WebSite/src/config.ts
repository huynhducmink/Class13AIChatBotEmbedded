// Centralized runtime config for the frontend
// Use Vite environment variable VITE_API_BASE to override in development/production
// access import.meta.env safely without TypeScript errors
const env = (import.meta as any).env;
export const API_ROOT: string = (env && env.VITE_API_BASE) || 'http://localhost:8000';

export default {
  API_ROOT,
};
