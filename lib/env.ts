/**
 * Typed environment variables configuration
 *
 * This module provides type-safe access to environment variables
 * and validates that required variables are present at runtime.
 */

function getEnvVar(key: string, required: boolean = true): string {
  const value = process.env[key]
  if (required && !value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value || ''
}

/**
 * Supabase configuration
 */
export const supabaseConfig = {
  url: getEnvVar('NEXT_PUBLIC_SUPABASE_URL'),
  anonKey: getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  serviceRoleKey: getEnvVar('SUPABASE_SERVICE_ROLE_KEY'),
}

/**
 * Webhook configuration
 */
export const webhookConfig = {
  apiKey: getEnvVar('WEBHOOK_API_KEY'),
}

/**
 * Google Calendar OAuth configuration (optional — not used by LP3)
 */
export const googleCalendarConfig = {
  clientId: getEnvVar('GOOGLE_CLIENT_ID', false),
  clientSecret: getEnvVar('GOOGLE_CLIENT_SECRET', false),
  redirectUri: getEnvVar('GOOGLE_REDIRECT_URI', false),
}

/**
 * n8n webhook configuration (optional)
 */
export const n8nConfig = {
  meetingBookedWebhook: getEnvVar('N8N_MEETING_BOOKED_WEBHOOK', false),
  meetingCancelledWebhook: getEnvVar('N8N_MEETING_CANCELLED_WEBHOOK', false),
  meetingReminderWebhook: getEnvVar('N8N_MEETING_REMINDER_WEBHOOK', false),
}

/**
 * Check if all required environment variables are set
 * Call this at app startup to fail fast if config is missing
 */
export function validateEnv(): void {
  // These will throw if missing
  supabaseConfig
  webhookConfig
  googleCalendarConfig
}
