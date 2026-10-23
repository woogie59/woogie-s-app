# OT booking notification deployment

Use only `ot_booking_notify_live.sql` and `functions/ot-booking-notify/index.ts`.
`ot_booking_notify_webhook.legacy.sql` is archived, uninstalled and unsafe as a deployment recipe. Do not apply it or set app.ot_notify_* GUC values.

1. Deploy exact reviewed Edge source as ot-booking-notify with verify_jwt=false. The handler uses its own Vault shared-secret authentication. Never disable JWT without this exact handler.
2. Apply reviewed live SQL in one transaction. It creates a Vault secret without displaying it. No Edge secret copying is needed. The service-role-only RPC reads it internally.
3. Read back function source hash/settings, trigger and cron definition, RLS and grants. Test missing/wrong secret returns403 only. Do not call a live booking, create a notification-enabled booking, or ask OneSignal to accept a test request.
4. Existing bookings are not backfilled. Nothing sends until a future confirmed INSERT creates a job. Pending is not a booking status in the current schema; ot_book creates confirmed directly. ot_cancel changes status to cancelled, it does not create another confirmed booking. A future pending-status feature requires a new review before enabling UPDATE dispatch.

## Failed jobs

Read only state/attempts/error tags. Do not expose provider text, recipient ID or member fields.
After fixing the cause, request explicit approval for the exact booking before retrying. Keep the original booking UUID (OneSignal idempotency key). Never recreate a booking or reset its ID. No automatic failed-row reset or backfill is installed. Beyond OneSignal's30-day idempotency window, do not retry uncertain sends without a duplicate-delivery decision. Stop if the booking is cancelled or already marked notified.

## Payment/provider compatibility

No paid API or SMS introduced. Key authorization and include_subscription_ids match the existing live smooth-action request that received HTTP200 + a provider message UUID at2026-10-23 22:00 KST. This is evidence of project key/request compatibility, not device receipt. The original Basic/include_player_ids template was not deployed and is not retained as an active path.
