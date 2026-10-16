# Daily OS

A personal dashboard for students that runs on your own computer. Nothing is hosted, and no accounts are needed to start.

- **Quick capture.** Type "dinner with Sam thursday 7pm, finish pset by friday". Events go onto your Google Calendar (onto the matching calendar if you have one named after the course), and everything else goes on your to-do list.
- **Schedule.** See today, tomorrow, and the day after across all your Google calendars, with your free blocks highlighted.
- **Assignments.** Upcoming, unsubmitted Canvas assignments, plus a syllabus catcher for deadlines Canvas doesn't list.
- **Email triage.** Sort Gmail or Outlook mail into *your own* labels and folders with the number keys.

Built with React, [shadcn/ui](https://ui.shadcn.com), and [Convex](https://convex.dev) running locally.

## Quick start

You need [Node.js 20+](https://nodejs.org).

```bash
git clone https://github.com/megkhampton-afk/daily-os.git daily-os
cd daily-os
npm install
npm run dev
```

That starts a private database on your computer and opens the app at http://localhost:5173. Your data is stored in the `.convex` folder in this project and never leaves your machine, except for the requests the app makes to Google, Microsoft, and Canvas on your behalf.

Keep `npm run dev` running while you use the app.

## Connect your accounts

The first time you open the app it asks you to create a passcode. Then open the **Setup** tab. Every card has step-by-step links and a copy button for the exact redirect URL your copy needs.

| Plug-in | Time | What you paste |
|---|---|---|
| Canvas | 1 min | Your school's Canvas address and a personal access token |
| Google (Calendar, Gmail, Drive) | ~5 min, once | Client ID and secret from your own Google Cloud project |
| Outlook / school email | ~5 min, once | Application ID and secret from your own Microsoft app registration |

Everything is optional; use only the plug-ins you want. Keys are saved in your local database and never sent back to the browser.

After connecting Gmail or Outlook, pick which of your folders show up in Email triage under **Setup → Sorting folders**.

### Why do I have to create my own Google app?

Your copy talks to Google directly, so it needs its own credentials. In "Testing" mode a personal Google app works for you (and up to 100 people you add) without Google's review. Google will show an "unverified app" warning the first time you connect; that's expected for a personal app.

Some schools block personal apps from reading school email. If you see "Need admin approval", forward your school mail to Gmail instead.

## Use it from your phone

Run the web app on your network and open the "Network" address it prints on your phone (same Wi-Fi):

```bash
npx convex dev            # terminal 1
npx vite --host           # terminal 2
```

To use it from anywhere, you need a hosted backend: run `npx convex login` to move your project to a free Convex cloud deployment, then deploy the `dist` folder from `npm run build` to any static host.

## Project layout

```
convex/          backend (runs locally): schema, sync jobs, OAuth
src/             React frontend
scripts/dev.mjs  starts the local backend and the app together
```

## License

MIT
