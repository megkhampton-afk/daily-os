# Test-user checklist

Use your **own fresh clone and backend**, never the developer's deployment or
passcode. Start without integrations, then connect one provider at a time.
Use disposable messages and calendar events for tests that modify an account.

## Record the environment

```sh
node --version
npm --version
git rev-parse --short HEAD
```

Record your OS and browser. Do not include any tokens, passcodes, message contents,
or private assignment/note screenshots in a report.

## 1. Fresh install and checks

- Install Node **24 LTS**.
- Follow the README's clone, `npm ci`, and `npm run dev` steps.
- Confirm there is no required cloud sign-up before the local app opens.
- Create a passcode before sharing a URL.
- Run `npm run check` and record pass/fail.
- Stop and restart `npm run dev`; verify the app and saved data return.

Expected: no missing-file errors, no force-install flags, and no need to copy
someone else's `.env.local`.

## 2. Core app without accounts

- Create a to-do, complete it, and verify it appears correctly after refresh.
- Open Notes, add a title and sample text, then **Save note**.
- Edit that note and save again. Refresh and restart the app; verify persistence.
- Type an unsaved draft, switch tabs, and return. The draft should remain until
  saved or deliberately discarded.
- Check the header quote has an author/work and remains the same on refresh that day.
- Check Setup is unchecked after a full reload and can be enabled when needed.
- Try the tab bar at phone width; every tab should be reachable by horizontal scrolling.
- With no calendars connected, Schedule should explain how to connect rather than
  present a fully verified free-time estimate.

## 3. Google Calendar

Follow [CONNECTING.md](CONNECTING.md) using an OAuth project you own.

- Confirm Gmail, calendar-event, and calendar-list permissions are all granted.
- Check Schedule on a day with known events.
- Hide a reference/booking calendar under **Choose calendars**. Check its events
  disappear and free time is recalculated; show it again afterward.
- If you consent to creating a temporary event, capture one clearly named
  “Daily OS test” at a future time. Verify it in Google Calendar, including the
  chosen calendar. Remove it after testing.
- Try a writable calendar whose name includes a course code to check routing.
- Try a phrase without a matching calendar; verify primary-calendar fallback.
- Reconnect without first disconnecting and check Schedule still loads.

Do not create, move, or delete a real appointment just to test this app.

## 4. Gmail or Outlook triage

- Connect an account your provider/institution permits.
- Pick/create a clearly named **test label/folder** under Sorting folders.
- Put at least two disposable test messages into that inbox.
- Click Sync inbox. If the inbox has over 30 messages, confirm the larger queue
  loads, up to the documented 100 per account.
- Click a message card. Check it opens the correct account and original message.
  Opening a message in the provider may itself mark it read.
- Sort a disposable unread message into the test folder. Confirm:
  - it leaves the Daily OS queue;
  - the real provider shows it in that label/folder;
  - it is read.
- Click **Undo** promptly; it should return to the inbox, still read.
- Send another disposable message to **Trash**, then Undo. It should not be
  permanently deleted.
- For Outlook, verify another move/Undo still works after the message's ID changes.

This is a real-mailbox test. Do not use important mail. Do not permanently empty Trash.

## 5. Canvas and Gradescope

- Enter the school's real Canvas base URL and your own generated token.
- Sync and compare a known assignment's name, due date, completion status, and link.
- Open Gradescope from Assignments.
- Save one course URL using the displayed course name/code.
- Verify **Turn in on Gradescope** opens the intended course or assignment.
- Do not submit coursework as part of this test unless that was your actual intent.

## 6. Apple Calendar, if available

- Use an app-specific password, not your normal Apple password.
- Test connection and verify known calendar names/events.
- If testing capture, create only a clearly named disposable event and clean it up.

## 7. Hosted/phone tests, if requested

Use [HOSTING.md](HOSTING.md) with your own backend and host. Do not expect a phone
to connect to a laptop's default loopback backend.

Check HTTPS, fresh setup, hosted OAuth callbacks, saved notes across devices, and
calendar visibility choices. Do not expose local admin ports to make this work.

## Report format

```text
Commit:
OS / browser:
Node / npm:
Checklist section:
Expected:
Actual:
Exact error (redacted):
Can you reproduce it after restart?:
```

Automated checks use fake messages/accounts. Real Google, Microsoft, Apple, and
institutional authorization still need the separate manual checks above.
