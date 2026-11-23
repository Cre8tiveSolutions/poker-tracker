# Poker Tracker — setup guide

About 20–30 minutes, once. Do the parts in order.

---

## Part A — Supabase (the database)

1. **Run the setup file** (skip if you already did this)
   Supabase → your **poker-tracker** project → **SQL Editor** → **New query** → paste everything from `setup/setup.sql` → **Run**.
   You should see "Success. No rows returned."

2. **Photo fix (only if you ran setup.sql before 23 Nov 2026, 6 pm)**
   Same place: New query → paste `setup/update-1-photos.sql` → **Run**. (Safe to run even if not needed.)

3. **Turn off sign-ups** so strangers can't create logins
   **Authentication → Sign In / Providers** → turn **off** "Allow new users to sign up" → **Save**.

4. **Create your own login**
   **Authentication → Users → Add user → Create new user** → your email + a password → tick **Auto Confirm User** → **Create user**.

---

## Part B — GitHub (put the app online)

1. Sign in to GitHub with your **Cre8tive Solutions** account.
2. Top right **+** → **New repository**.
   - Name: `poker-tracker`
   - **Public**
   - Leave "Add a README" unticked → **Create repository**.
3. On the new empty repo page, click **uploading an existing file**.
4. Unzip `poker-tracker.zip` on your computer. Open the `poker-tracker` folder.
   Select **everything inside it** and drag it into the GitHub page:
   - the folders **`assets`** and **`setup`** (drag the whole folders, not the files inside)
   - the files **`index.html`**, **`manifest.webmanifest`**, **`README.md`**, **`SETUP-GUIDE.md`**
5. Wait until every file shows in the list (the `assets` folder includes a `vendor` folder inside — it uploads with it).
6. Scroll down → **Commit changes**.
7. Check: the repo's main page should show `assets`, `setup`, `index.html` … at the top level.
   If you see a single `poker-tracker` folder instead, you dragged the outer folder — delete and redo step 4 with its *contents*.

### Turn on GitHub Pages

1. In the repo: **Settings** → left menu **Pages**.
2. Under **Build and deployment** → Source: **Deploy from a branch**.
3. Branch: **main**, folder: **/ (root)** → **Save**.
4. Wait 1–2 minutes, refresh the page. A link appears at the top:
   `https://<your-github-name>.github.io/poker-tracker/`
   That's your app. 🎉

---

## Part C — Keep the database awake (optional but recommended)

Free Supabase projects fall asleep after about a week with no use. This small job visits the database every 3 days so it never sleeps.

1. In the repo: **Add file → Create new file**.
2. In the file name box, type exactly: `.github/workflows/keep-awake.yml`
   (typing the `/` makes the folders for you)
3. Open `setup/keep-awake.yml` from the zip, copy everything, paste it into the big box.
4. **Commit changes**.
5. Test it: **Actions** tab → **Keep database awake** → **Run workflow**. After a minute it should show a green tick.

Note: GitHub pauses scheduled jobs on repos with no changes for 60 days and emails you. If that happens, open the Actions tab and click **Enable workflow**.

If the database ever does fall asleep: Supabase dashboard → open the project → **Resume project**. Your data is kept.

---

## Part D — First use

1. Open your app link on your phone.
2. Tap **Sign in** (bottom right) → your email + password.
3. Tap **Become owner** and type your name. (Only works once — the first person becomes owner.)
4. **Players** tab → **Add** your regulars (name, optional nickname and photo).
5. **Add to Home Screen** for a one-tap app icon:
   - iPhone (Safari): Share button → **Add to Home Screen**
   - Android (Chrome): ⋮ menu → **Add to Home screen**

### Adding a banker

1. Supabase → **Authentication → Users → Add user → Create new user** → their email + a starter password → tick **Auto Confirm User**.
2. In the app: **Me** tab → **Bankers** → enter the same email and their name → **Add banker**.
3. Send them the app link, email and password. They can change the password in **Me → Change password**.

To remove a banker: **Me → Bankers** → bin icon. (Their login stays but they can't edit any more.)

### Everyone else

Just send them the app link. They can watch live, see results, leaderboard and stats — no login.

---

## Good to know

- **Backups:** Me → **Export all results** / **Export all buy-ins** saves CSV files to your phone. Do it now and then — the free plan has no automatic backups.
- **Safe to share:** the Project URL and publishable key in `assets/config.js` are meant to be public. Never put the Supabase **secret / service_role key** or your **database password** in any file.
- **Forgot password?** Supabase → Authentication → Users → click the person → **Send password recovery**, or delete and re-create the login (then re-add them as banker).
- **Changing the quick amounts** ($10 / $20 / $50 / $100): edit `assets/config.js` on GitHub (pencil icon) → change `quickAmounts` → Commit.
