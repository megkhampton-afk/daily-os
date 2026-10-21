# Hosting your own copy and using a phone

The default development setup is **for the computer running it**. A frontend
served on your Wi-Fi network still points at a loopback backend by default.
Opening it from a phone will not fix that. Do not expose the local backend's
API/admin ports to the internet.

For phone access from anywhere, use your own hosted backend plus an HTTPS frontend.
This guide describes the configuration; it does not automatically deploy anything.

## 1. Keep local data safe

Stop and back up your `.convex` data and `.env.local` before changing configurations.
Creating a cloud backend does **not** automatically migrate local records or secrets.
For a first test deployment, start fresh and re-enter your own settings.

If you need to migrate existing data, use Convex's documented export/import process
for your exact deployment types rather than deleting your local database.

## 2. Create your own hosted Convex project

```sh
npx convex login
npx convex dev --configure
```

Choose/create your own project and choose a **cloud** development deployment when
prompted. Wait for functions to be ready, then stop the command with Ctrl+C.
Do not choose another person's deployment or copy their deploy key.

The generated `.env.local` points local development at that selected backend.
Verify the selected project in your Convex dashboard before any deployment.

## 3. Deploy the backend to production

```sh
npx convex deploy
```

This deploys to the project's **production** backend, not its development backend.
Read the target printed by the CLI before confirming.
Copy your production deployment's `https://…convex.cloud` **client URL** from the
Convex dashboard.

Do not copy a `convex.site` HTTP callback URL into `VITE_CONVEX_URL`; those URLs
serve different purposes.

## 4. Build the frontend against that same production backend

Create a gitignored file named **`.env.production.local`** in the repo root:

```dotenv
VITE_CONVEX_URL=https://YOUR_PRODUCTION_DEPLOYMENT.convex.cloud
VITE_OWNER_NAME=Your name
```

These values are public frontend configuration, not credentials. Never add Google,
Microsoft, Canvas, or Apple secrets here.

Make sure you have not exported a conflicting `VITE_CONVEX_URL` in your shell:
explicit shell environment values take precedence over Vite env files.

```sh
npm run build
```

The URL is baked into `dist` at build time. Changing an env file later does not
change an already-built frontend.

## 5. Host `dist` over HTTPS

Upload `dist` to a static host such as Cloudflare Pages, Netlify, or Vercel.
For a connected Git-based host, set the build command to `npm run build`, output
directory to `dist`, Node version to **24**, and the production `VITE_CONVEX_URL`
in that host's build environment. Configure only your own account/project.

Before sharing the frontend, open it yourself and create its long, unique passcode.
The first visitor to an unconfigured backend can set it.

Configure the OAuth fallback origin on the same production backend:

```sh
npx convex env set SITE_URL https://YOUR_FRONTEND_HOST --prod
```

This is the **frontend origin**, without a tab fragment or callback path.

## 6. Connect accounts from the hosted frontend

1. Open your hosted HTTPS frontend, unlock it, and turn Setup on.
2. Copy the **production** Google/Microsoft callback URIs displayed there into your
   OAuth clients' authorized redirect URI lists.
3. Save credentials in that hosted app's Setup cards and connect accounts there.
4. Re-enter Canvas and Apple settings for this backend if desired.
5. Test Schedule, Sync Canvas, and Sync inbox before using important data.

A localhost connection is not automatically a production connection. The hosted
frontend must use the backend where the tokens/settings were saved.

## 7. Add to your phone

Open the hosted HTTPS URL in Safari on iPhone, then **Share → Add to Home Screen**.
On Android, use the browser's install/add-to-home-screen action.
Your hosted backend must stay available; it is not an offline-only app.

## Sharing safely

Share the **source repo** with other people, not your personal frontend passcode,
backend, tokens, or `.env.local`. This app is single-user and does not isolate
multiple people's records within one deployment.

The shared passcode model is suitable for a personal prototype, not a hardened
public SaaS. Do not host it for unrelated users under one database.
