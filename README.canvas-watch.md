# Canvas watcher

The optional `jnu-canvas-watch` Cloud Run Job complements the timetable sync without modifying Google Calendar.

It watches the user's Canvas calendar feed and Canvas API and sends Discord notifications for:

- newly added assignments
- assignment due-date/title changes
- future assignments that are removed
- newly posted course announcements, including a short plaintext preview and Canvas link
- one compact daily reminder for incomplete assignments due in D-0 through D-3

The daily reminder uses Canvas Planner's `incomplete_items` filter, so submitted assignments are excluded when Canvas reports them as complete.

The first execution establishes a baseline and does not flood Discord with existing assignments or announcements. It may still send the useful D-0..D-3 reminder summary. State is stored in a private Cloud Storage object.

Required runtime environment variables/secrets:

- `CANVAS_API_TOKEN`
- `CANVAS_ICS_URL`
- `CANVAS_STATE_BUCKET`
- `DISCORD_WEBHOOK_URL`

Deploy with `bash scripts/deploy-canvas-watch.sh` after the Canvas secrets exist.
