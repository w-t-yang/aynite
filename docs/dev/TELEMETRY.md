# Telemetry — GA4 Measurement Protocol

Tracks anonymous app usage events (opt-in only). No PII is sent.

Events are batched in memory and flushed to GA4 every 60 seconds and on app quit.

## Architecture

```
telemetry/
  index.ts         — Session lifecycle, buffer management, public API
  ga4-client.ts    — GA4 protocol layer (URL, fetch, event serialization)
  periodic-runner.ts — Shared setInterval wrapper for flush + heartbeat
```

## All Events

### Session Lifecycle (on app start/stop)

| Event | When | Key Parameters |
|---|---|---|
| `app_first_open` | First launch ever (once per client) | `app_version` |
| `app_session_started` | Each session start | — |
| `app_start` | Each session start | `is_packaged`, `app_version` |
| `app_end` | App quit | `session_duration_sec` |
| `app_heartbeat` | Every 30s while running | — |

### Version Tracking

| Event | When | Key Parameters |
|---|---|---|
| `app_version_updated` | When app version changes | `from_version`, `to_version` |

### User Activity

| Event | When | Key Parameters |
|---|---|---|
| `screen_view` | View/page opened | `screen_name` |
| `notification` | Notification shown | `notification_type`, `notification_title` |

### Workspace

| Event | When | Key Parameters |
|---|---|---|
| `workspace_switched` | User switches workspace | — |
| `workspace_folder_added` | User adds folder | — |

### Files

| Event | When | Key Parameters |
|---|---|---|
| `file_opened` | File read | `extension` |
| `file_created` | File created | `is_directory` |
| `file_renamed` | File renamed | — |
| `file_copied` | File copied | — |
| `file_deleted` | File deleted | — |
| `file_saved` | File saved | `extension` |

### AI

| Event | When | Key Parameters |
|---|---|---|
| `ai_chat` | Chat message sent | — |
| `ai_provider_configured` | AI provider settings changed | `provider_count` |

### Config

| Event | When | Key Parameters |
|---|---|---|
| `theme_changed` | Theme changed | — |
| `telemetry_toggled` | Telemetry enabled/disabled | `enabled` |
| `git_commit` | Git commit made | — |

## Auto-attached Parameters

These are added to **every** event automatically by `pushEvent()`:

| Parameter | Description |
|---|---|
| `engagement_time_msec` | Required by GA4 for Active Users metric. Set to 100ms constant. |
| `session_id` | UUID generated per session. Required for session counting. |
| `app_version` | From `app.getVersion()` |
| `platform` | `darwin`, `win32`, or `linux` |

## User Properties

Sent with every flush batch (not per-event):

| Property | Description |
|---|---|
| `app_version` | App version string |
| `platform` | OS platform |
| `is_packaged` | `"true"` or `"false"` |

## GA4 Measurement Protocol Requirements Met

- ✅ `engagement_time_msec` on every event → **Active Users**
- ✅ `app_first_open` event (once per client_id) → **New Users**
- ✅ `app_session_started` event with `session_id` → **Session tracking**
- ✅ `app_heartbeat` every 30s → **Engagement tracking**
- ✅ `user_properties` on every flush → **User dimensions**
- ✅ `screen_view` event → **Page/screen tracking**

## Reserved Event Names

GA4 Measurement Protocol silently drops these reserved event names from its mobile app SDK:

- `session_start`
- `first_open`
- `user_engagement`

The telemetry module uses custom event names instead (`app_session_started`, `app_first_open`, `app_heartbeat`) while keeping the required `session_id` and `engagement_time_msec` parameters on every event, which is sufficient for GA4 to compute sessions, active users, and engagement metrics.

## Viewing in GA4

Navigate to **Explore > Free Form** in the GA4 dashboard to build custom reports. Available dimensions include all event names, parameters, and user properties listed above.
