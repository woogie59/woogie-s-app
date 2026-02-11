-- Add onesignal_id column to profiles for storing OneSignal Player/Subscription ID
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onesignal_id TEXT;
