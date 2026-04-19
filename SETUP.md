# SunnySide Summer Camp Setup

This site is a static HTML/CSS/JS project, so you can open `index.html` directly or upload the folder to simple hosting.

## What is already built

- Homepage for SunnySide Summer Camp
- Camp detail page for each camp through `camp.html?camp=...`
- Registration page with:
  - parent contact info
  - emergency contact info
  - one or more children
  - one or more camp selections
  - typed waiver signature
  - live pricing summary
- Local browser backup of submitted registrations

## Camps currently configured

The site currently includes the 7 camp names and dates you provided:

- Science & STEM Camp - June 17, 2026
- Arts and Crafts Camp - June 24, 2026
- Cooking Camp - July 1, 2026
- Sports and Movement Camp - July 8, 2026
- Water Day Camp - July 15, 2026
- Hogwarts / Wizarding Camp - July 22, 2026
- Carnival Camp - July 29, 2026

If you send the 8th camp name and date, add one more object in `scripts/camp-data.js`.

## Stripe payment setup

Open `scripts/site-config.js` and set:

```js
stripePaymentLink: "https://buy.stripe.com/your-link"
```

Recommended simple setup:

1. In Stripe, create one product called `SunnySide Camp Seat`.
2. Price it at `$30`.
3. Create a Payment Link with adjustable quantity enabled.
4. Paste that link into `scripts/site-config.js`.

Parents can then use one payment link for one kid, multiple kids, or multiple camps. The checkout page tells them how many camp seats to pay for.

## Registration tracking setup

The registration page can also send the submitted payload to a webhook.

Open `scripts/site-config.js` and set:

```js
registrationWebhook: "YOUR_WEBHOOK_URL"
```

The easiest lightweight path is Google Apps Script plus Google Sheets.

1. Create a Google Sheet for registrations.
2. In Apps Script, paste the code from `apps-script/Code.gs`.
3. Add your Google Sheet ID to that script.
4. Deploy the script as a web app.
5. Paste the web app URL into `registrationWebhook`.

That gives you a simple spreadsheet-based registration log with each child, family notes, and camp selection recorded.

## Notes

- Payment is not truly live until you add a Stripe link.
- Central registration tracking is not truly live until you add a webhook URL.
- The built-in local backup uses browser storage and is only a fallback, not your main production database.
- The site shows the 20-seat limit, but true capacity enforcement still depends on your live registration backend or spreadsheet process.
