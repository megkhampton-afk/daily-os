# Connect your own accounts

Start the app with `npm run dev`, unlock it, and turn **Setup** on. Every person
needs their own copy and credentials. Never send a token, client secret, password,
or passcode to another user or paste one into a GitHub issue.

Integration credentials go into the app's **Setup** cards. `.env.example` is not
where you put Google, Microsoft, Canvas, or Apple secrets.

## Canvas

1. Find the base address you use for Canvas, for example
   `https://your-school.instructure.com` or your school's custom Canvas domain.
   Do not paste a course URL or the school's SSO sign-in page.
2. In Canvas, open **Account → Settings → Approved Integrations → New Access Token**.
   Give it a name such as Daily OS and an expiry you can remember.
3. In **Setup → Canvas**:
   - **Canvas address:** your base URL.
   - **Access token:** the generated token.
4. Click **Save**, open **Assignments**, then click **Sync Canvas**.
5. Verify a known assignment, its due date, and its **Open assignment** link.

If token creation is disabled or the API returns 401/403, your school may restrict
API access. Check the URL/token/expiry, then ask IT. Daily OS cannot bypass SSO or
institutional restrictions. Tokens can be revoked from Canvas settings.

Submitted/graded Canvas work appears completed. Unsubmitted overdue work stays
visible. The local nightly sync only runs while the backend is running.

## Google: Calendar and Gmail

### 1. Create your own Google Cloud app

1. Open [Google Cloud Console](https://console.cloud.google.com/) and create/select
   a project you control.
2. Under **APIs & Services → Library**, enable **Gmail API** and **Google Calendar API**.
3. Open **Google Auth Platform** (or the OAuth consent screen):
   - **Branding:** enter an app name, support email, and contact email.
   - **Audience:** choose **External** for a personal Google account.
   - Keep it in **Testing** for your own development copy.
   - Add the exact Google account you will connect under **Test users**.
4. Under **Data Access / Scopes**, make these available:

   ```text
   https://www.googleapis.com/auth/gmail.modify
   https://www.googleapis.com/auth/calendar.events
   https://www.googleapis.com/auth/calendar.calendarlist.readonly
   ```

   Daily OS also requests `openid` and `email` to identify the connected account.
   Gmail modify access is needed because sorting changes real labels, read status,
   and Trash. Calendar-list access is needed to read/pick your calendars.

### 2. Create a Web OAuth client

1. Open **Clients → Create client → Web application**.
2. In Daily OS, copy the redirect URI displayed in **Setup → Google**.
3. Paste it under the client's **Authorized redirect URIs**. Save.

   It ends in `/google/callback`. **Use the full value from your own copy.**
   It is a backend HTTP URL, not the frontend's address and not another person's URL.
   Local copies normally show a loopback HTTP URL; hosted copies show your
   deployment's `https://…convex.site/google/callback`.

4. Copy the **Client ID** and **Client secret**.
5. Enter them into **Setup → Google → Client ID / Client secret**, then **Save**.
   You do not need a Google API key or a service-account JSON file.

### 3. Connect and verify

1. Open **Email triage → Connected accounts → Google → Connect**.
2. Sign in to the Google account you added as a test user.
3. Review the app/project name. Only authorize an app you own and recognize.
4. Grant the requested Gmail and calendar permissions. If Google's consent screen
   lets you select scopes individually, do not leave calendar-list access unchecked.
5. Return to the app:
   - **Schedule → Refresh:** verify events on a known day.
   - **Schedule → Choose calendars:** uncheck booking/reference calendars you do not attend.
   - **Setup → Sorting folders:** select/create the labels you want.
   - **Email triage → Sync inbox:** fetch up to 100 inbox messages.

Clicking a message opens the connected Gmail account and the original thread.
Sorting marks it read, applies the label, and removes it from the inbox. **Trash**
moves it to Gmail Trash. **Undo** restores the inbox, without making it unread again.

### Google troubleshooting

- **`redirect_uri_mismatch`:** compare the full URI character-for-character,
  including protocol, port, path, and trailing slash. The callback ends in
  `/google/callback`, without an extra slash.
- **“Access blocked” / user not allowed:** add your actual sign-in address as an
  OAuth test user. Check the intended project, API enablement, and audience.
- **Unverified app warning:** personal testing apps may show this. Do not authorize
  an unfamiliar app just to get past the warning. Public distribution of one shared
  OAuth app can require Google's verification; each person's own copy uses their own client.
- **Can create events but Schedule/automatic picking fails:** click **Reconnect**
  and grant calendar-list access. Automatic routing only uses writable calendars;
  otherwise new events fall back to the primary calendar.
- **Works, then fails after about a week:** Google's External/Testing refresh tokens
  for these scopes commonly expire after seven days. Reconnect. Publishing the
  source repo is different from putting an OAuth app into Google's Production mode.
- **Moved your backend:** copy the *new* redirect URI into the Google client and
  enter credentials/connect again on the new backend.

## Apple Calendar / iCloud

1. Make sure iCloud Calendar and two-factor authentication are enabled on your Apple account.
2. Open [account.apple.com](https://account.apple.com/).
3. Under **Sign-In and Security → App-Specific Passwords**, generate a password
   named Daily OS.
4. In **Setup → Apple Calendar**, enter:
   - **Apple ID email:** the account that owns your iCloud calendars.
   - **App-specific password:** the generated password, **not your normal Apple password**.
5. Click **Save → Test connection**. Check the returned calendar names.
6. Open **Schedule → Refresh** to check events.

If both Google and Apple are connected, **Capture new events to** in the Apple card
selects which provider receives new captured events. Calendar-name routing happens
within that provider.

If the test fails, check iCloud Calendar is enabled, the Apple ID is correct, and
the app-specific password has not been revoked. Your Apple account settings can
revoke that password at any time.

## Outlook / Microsoft 365

1. Open [Microsoft Entra app registrations](https://entra.microsoft.com/).
2. Create a **New registration**:
   - Name: Daily OS.
   - Supported accounts: **Accounts in any organizational directory and personal
     Microsoft accounts** (matches the app's `/common` sign-in endpoint).
   - Redirect platform: **Web**.
   - Redirect URI: copy the full value from **Setup → School email**. It ends in
     `/ms/callback`. Use your own backend's URL.
3. Under **API permissions → Microsoft Graph → Delegated permissions**, add:
   `User.Read`, `Mail.ReadWrite`, `offline_access`, `openid`, and `email`.
   Do not choose Application permissions.
4. Under **Certificates & secrets**, create a client secret. Copy its **Value**
   immediately; the **Secret ID** is not the password.
5. In **Setup → School email**:
   - **Application (client) ID:** from the app registration's Overview.
   - **Client secret value:** the secret's Value, not its ID.
6. Save, then open **Email triage → Connect** for Microsoft.
7. Review and authorize only the app you registered. Then select folders in
   **Setup → Sorting folders** and use **Sync inbox**.

If an organization blocks registration, delegated mail access, or user consent,
ask its IT team. Follow its data-handling policies; do not work around restrictions.
Personal Outlook accounts can be used where permitted. An expired secret must be
replaced in the registration and saved again in Setup.

Outlook sorting marks the message read before moving it. **Trash** uses Deleted
Items. Undo moves it back to the inbox. Microsoft can assign a new message ID on
each move; Daily OS updates its stored ID.

## Gradescope shortcuts

1. Sign in to Gradescope in your normal browser.
2. Open a course and copy its full URL, for example
   `https://www.gradescope.com/courses/123456`.
3. Open **Assignments → Set up or edit Gradescope course links**.
4. Choose/type the course name or code shown on the assignments, paste the URL
   into **Gradescope course URL**, then click **Save course link**.
5. Use **Turn in on Gradescope** next to an assignment.

An assignment-specific URL takes precedence when present; a course link opens
the course, where you choose the assignment and submit normally. A general
**Open Gradescope** button remains available if no course link is configured.
Daily OS does not sign in to Gradescope, upload work, or infer submission status there.

## Secret handling

- Save credentials in the app's Setup cards; do not edit `.ts` files.
- Never put a secret in a `VITE_` variable. Those variables are bundled into the browser.
- Do not commit `.env.local`, `.convex`, or provider credentials.
- Each tester uses their own backend, passcode, and accounts. Do not share yours.
- Disconnect removes stored connection tokens from this backend. Revoke the app at
  the provider as well if you want to revoke the grant itself.
