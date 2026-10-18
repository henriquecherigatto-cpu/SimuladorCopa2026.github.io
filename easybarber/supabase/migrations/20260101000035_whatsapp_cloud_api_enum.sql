-- Part 1/2 of the Twilio -> WhatsApp Cloud API (Meta) migration.
-- whatsapp_messages.status only ever had 'sent'/'failed' (Twilio had no
-- delivery-status webhook wired up at all). Meta's Cloud API webhook
-- reports a richer lifecycle (sent -> delivered -> read, or failed) —
-- these two values are added here, in their own migration, because
-- Postgres forbids using a newly-added enum value in the same
-- transaction that added it. See 20260101000036_whatsapp_cloud_api_schema.sql
-- (next migration) for everything that actually uses them.
alter type public.whatsapp_message_status add value if not exists 'delivered';
alter type public.whatsapp_message_status add value if not exists 'read';
