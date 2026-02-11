# GitHub Actions: Daily PT Reminder Setup

This guide explains how to configure the `daily_cron.yml` workflow so it can invoke your `daily-pt-reminder` Edge Function.

---

## Prerequisites

- Your Supabase project is deployed
- The `daily-pt-reminder` Edge Function is deployed
- You have admin access to the GitHub repository

---

## Step 1: Find Your Supabase Project ID

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Open **Project Settings** (gear icon)
4. Under **General**, find **Reference ID** – this is your Project ID
   - Or: From your `.env` file, your `VITE_SUPABASE_URL` is like `https://XXXXXXXX.supabase.co` – the `XXXXXXXX` part is your Project ID

---

## Step 2: Find Your Service Role Key

1. In the Supabase Dashboard, go to **Project Settings** → **API**
2. Under **Project API keys**, locate **service_role** (labelled “secret”)
3. Click **Reveal** and copy the key
4. ⚠️ **Keep this key secret** – never commit it or expose it publicly

---

## Step 3: Add GitHub Repository Secrets

1. Open your GitHub repository
2. Go to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add these two secrets:

| Secret Name                 | Value                                        |
|----------------------------|----------------------------------------------|
| `SUPABASE_PROJECT_ID`      | Your project reference ID (e.g. `xyzabc123`) |
| `SUPABASE_SERVICE_ROLE_KEY`| Your `service_role` API key                  |

**Steps per secret:**
- Name: `SUPABASE_PROJECT_ID` → Value: your project ID (no `https://` or `.supabase.co`)
- Name: `SUPABASE_SERVICE_ROLE_KEY` → Value: the full service role key

---

## Step 4: Verify the Workflow

1. After pushing the workflow file, go to **Actions** in your repo
2. Select the **Daily PT Reminder** workflow
3. Click **Run workflow** → **Run workflow**
4. When the run finishes, open it and confirm the step succeeded
5. Check your Supabase function logs or OneSignal to confirm notifications were sent

---

## Schedule

- **Cron:** `0 0 * * *` (00:00 UTC every day)
- **KST:** 09:00 AM Korea Standard Time

---

## Troubleshooting

| Issue                              | Check                                              |
|-----------------------------------|----------------------------------------------------|
| `HTTP 401` or `403`               | Confirm `SUPABASE_SERVICE_ROLE_KEY` is correct      |
| `HTTP 404`                        | Confirm `SUPABASE_PROJECT_ID` and function name    |
| Empty URL / invalid request       | Both secrets must be set in the repo               |
| No notifications received         | Check Edge Function logs in Supabase dashboard     |
