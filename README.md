# Daily OS

![License: MIT](https://img.shields.io/badge/license-MIT-blue) ![Node](https://img.shields.io/badge/node-%E2%89%A520-green)

**A personal dashboard for students that connects to your email, Canvas, and calendar, and runs entirely on your own computer. No accounts, no hosting, no data leaving your machine.**

Students juggle capture, to-dos, Canvas deadlines, email, and calendars across five different apps. Daily OS is one page that does all five, and it runs locally off a single `npm run dev`.

![Daily OS dashboard](docs/screenshot.png)

- **Due soon.** The top of the dashboard tells you what to work on next ("Work on Problem Set 3 now. It's due tomorrow."), with the rest of the week's deadlines underneath.
- **Quick capture.** Type like you talk: "dinner with Sam thursday 7pm, finish pset by friday". Events go to your Google or Apple Calendar (onto the calendar named after the course when there is one), and everything else becomes a to-do.
- **Today and Schedule.** Today's events and to-dos at a glance, plus a today/tomorrow/day-after timeline across all your calendars with free blocks highlighted.
- **To-dos.** The simple list everything feeds into.
- **Assignments.** Upcoming, unsubmitted Canvas work synced daily, plus a syllabus catcher for deadlines Canvas doesn't list.
- **Email triage.** Sort Gmail or Outlook into *your own* labels and folders with the number keys.
- **Setup switch.** Flip **Setup** on in the header to see the setup tools (the Setup tab, syllabus catcher, examples). Flip it off for a clean everyday dashboard.

## Quick start

You need [Node.js 20+](https://nodejs.org) and nothing else. No cloud accounts and no API keys to start.

```bash
git clone https://github.com/megkhampton-afk/daily-os.git daily-os
cd daily-os
npm install
npm run dev
```

The first run starts a private database on your machine and opens the app at http://localhost:5173. Create a passcode when prompted, and you're in. Keep `npm run dev` running while you use the app; your data lives in the `.convex` folder and never leaves your computer except for the requests the app makes to Google, Microsoft, and Canvas on your behalf.

### Forgot your passcode?

In the project folder (with `npm run dev` running), run:

```bash
npx convex run settings:resetPasscode
```

Then reload the app and create a new one. Your data is kept.

## Connect your accounts

Everything is optional. Start with nothing and add integrations when you want them from the **Setup** tab. Every card has step-by-step instructions and a copy button for the exact redirect URL your copy needs.

| Plug-in | Time | What you paste |
|---|---|---|
| Canvas | 1 min | Your school's Canvas address and a personal access token |
| Google (Calendar, Gmail) | ~5 min, once | Client ID and secret from your own Google Cloud project |
| Apple Calendar (iCloud) | 2 min | Your Apple ID email and an app-specific password from account.apple.com |
| Outlook / school email | ~5 min, once | Application ID and secret from your own Microsoft app registration |

Keys are saved in your local database and never sent back to the browser. After connecting Gmail or Outlook, pick which folders show up in Email triage under **Setup → Sorting folders**.

### Why do I have to create my own Google app?

Your copy talks to Google directly, so it uses your credentials. In "Testing" mode a personal Google app works for you (and up to 100 people you add) without Google's review. Google shows an "unverified app" warning the first time you connect; that's expected for a personal app.

Some schools block personal apps from reading school email. If you see "Need admin approval", forward your school mail to Gmail instead.

## Use it from your phone

Run the web app on your network and open the "Network" address it prints on your phone (same Wi-Fi):

```bash
npx convex dev        # terminal 1
npx vite --host       # terminal 2
```

To use it from anywhere, move to a free hosted backend (`npx convex login`, then `npx convex dev`) and deploy the `dist` folder from `npm run build` to any static host.

## Project layout

```
convex/          backend (runs locally): schema, sync jobs, OAuth
src/             React frontend
scripts/dev.mjs  starts the local backend and the app together
```

## Built with

[React](https://react.dev) · [Convex](https://convex.dev) · [shadcn/ui](https://ui.shadcn.com) · [Vite](https://vite.dev) · [Tailwind CSS](https://tailwindcss.com) · [chrono-node](https://github.com/wanasit/chrono-node) for natural-language dates

## License

MIT

---

Built end-to-end with [Factory Droid](https://factory.ai).
