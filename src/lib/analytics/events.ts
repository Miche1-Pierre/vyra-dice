/**
 * Analytics taxonomy (docs/analytics.md): event name → properties, snake_case.
 * Never put personal data (name, phone, email) in an event.
 */
export type AnalyticsEvents = {
  experience_viewed: { source?: string; webgl_supported: boolean }
  scene_ready: { load_ms: number; fallback_2d: boolean; gpu_tier?: number }
  intro_skipped: { at_ms: number }
  zone_viewed: { zone_id: string; tier: string }
  table_viewed: {
    table_id: string
    zone_id: string
    tier: string
    minimum_spend: number | null
    status: string
  }
  table_view_from_seat: { table_id: string }
  tables_compared: { table_ids: string[] }
  level_filter_changed: { level: "all" | "0" | "1" }
  list_view_opened: Record<string, never>
  request_started: { table_id: string }
  request_submitted: { request_id: string; table_id: string; party_size: number; demo: boolean }
  request_failed: { table_id: string; reason: string }
  fallback_contact_clicked: { channel: string; context: string }
  ticket_viewed: { ticket_id: string }
  ticket_link_clicked: { url: string }
}

export type AnalyticsEventName = keyof AnalyticsEvents
