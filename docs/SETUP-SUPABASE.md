# Setup: connect Travel Foodie to Supabase (multi-user)

This is the one-time setup **you** do. It takes ~15 minutes. After this, send
Claude the two values from Step 3 and it builds + tests the app integration.

We start with **email login (free)**. Google and phone come after.

---

## Step 1 — Create a free Supabase account & project
1. Go to **https://supabase.com** → **Start your project** → sign in (GitHub or email).
2. Click **New project**.
   - **Name:** `travel-foodie`
   - **Database password:** click *Generate*, then **copy & save it somewhere safe**
     (you won't need it day-to-day, but don't lose it).
   - **Region:** pick one near India (e.g. *Mumbai / South Asia*).
3. Click **Create new project** and wait ~2 minutes for it to finish setting up.

## Step 2 — Create the database tables
1. In your project, open **SQL Editor** (left sidebar) → **New query**.
2. Open the file [`supabase/schema.sql`](../supabase/schema.sql) from this repo,
   copy **all** of it, paste into the editor, and click **Run**.
3. You should see *Success*. (This creates the `places` table and the security
   rules — including "only the author can delete".)

## Step 3 — Get your 2 connection values  ← send these to Claude
1. Go to **Project Settings** (gear icon) → **API**.
2. Copy these two:
   - **Project URL** — looks like `https://abcdefgh.supabase.co`
   - **anon public** key — a long string under *Project API keys* (the one
     labelled **`anon` `public`**).
3. **Paste both to Claude in the chat.**

> 🔒 The **anon public** key is safe to share and to put in the website — it's
> public by design. **Do NOT** share the **`service_role`** key (that one is secret).

---

## Later (after email login works)

### Google login (free)
You'll create a Google OAuth client and paste 2 values into Supabase
(**Authentication → Providers → Google**). Claude will guide each click.

### Mobile / SMS OTP (costs money 💸)
Supabase needs an **SMS provider** (e.g. Twilio) to send text codes — this
charges a few pennies per SMS and needs its own account. We'll add this last,
only when you're ready.
