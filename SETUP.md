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

- Science & STEM Camp - July 1, 2026
- Arts and Crafts Camp - June 24, 2026
- Cooking Camp - July 8, 2026
- Sports and Movement Camp - July 15, 2026
- Water Day Camp - July 22, 2026
- Hogwarts / Wizarding Camp - July 29, 2026
- Carnival Camp - August 5, 2026

If you send the 8th camp name and date, add one more object in `scripts/camp-data.js`.

## Stripe payment setup

Open `scripts/site-config.js` and set:

```js
stripePaymentLink: "https://buy.stripe.com/your-link"
```

The project is currently wired to this Stripe **test-mode** Payment Link:

```text
https://buy.stripe.com/test_4gMcN4bfG05UfLz1I5co001
```

Created in the Stripe sandbox account as:

- Product: `SunnySide Camp Seat`
- Product ID: `prod_UMU84L3fN48GBf`
- Price: `$30.00`
- Price ID: `price_1TNlDgANrtSgrYf0qgMIeTZy`
- Payment Link ID: `plink_1TNlEbANrtSgrYf0w14tOmYM`

Recommended simple setup:

1. In Stripe, create one product called `SunnySide Camp Seat`.
2. Price it at `$30`.
3. Create a Payment Link for the camp seat price.
4. Paste that link into `scripts/site-config.js`.

Parents can then use one payment link for one kid, multiple kids, or multiple camps. The checkout page tells them how many camp seats to pay for.

### Important note about the current Stripe link

- The current link is in Stripe **sandbox/test mode**, not live mode.
- Before taking real payments, recreate this product, price, and payment link in your **live** Stripe account and replace the test link in `scripts/site-config.js`.
- Do **not** enable adjustable quantity unless you also want parents changing seat counts inside Stripe. The site is currently designed so the registration form is the source of truth for child names and selected camps.
- Stripe stores `$30.00` as `unit_amount: 3000` because USD uses cents.

## Registration tracking setup

The registration page can also send submitted registrations and payment confirmations to one webhook.

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

That gives you a spreadsheet-based registration log with each child, family notes, camp selection, and Stripe reconciliation fields.

### Registration email notifications

The Apps Script backend now sends two emails whenever a registration is saved:

- a confirmation email to the parent or guardian listed on the registration
- an admin notification email to `sunnysidesummercamper@gmail.com`

These emails include the confirmation ID, contact details, selected camp days, registered children, seat count, and total due.

Important note:

- When you deploy or redeploy Apps Script after this update, Google may ask you to approve permission for the script to send email on your behalf.

### Google Sheet admin tabs

Once the Apps Script code is updated and redeployed, it will automatically maintain three organizer-friendly tabs in the same spreadsheet:

- `Registrations`
  - your raw record of one row per child per camp day
- `Camp Summary`
  - registered seats by camp
  - paid seats by camp
  - pending or follow-up seats
  - paid revenue and expected revenue
  - remaining spots based on the internal 20-seat planning cap
- `Payment Follow Up`
  - one row per registration that still needs attention
  - includes parent contact info, selected camp days, children, amount due, payment status, and reconciliation notes

These report tabs rebuild automatically whenever a registration is submitted or a payment is reconciled.

### Capacity tracking

The site now reads live camp capacity from the Google Apps Script endpoint and marks camp days as sold out once they reach the internal 20-seat cap.

- Sold-out camps show `Sold Out` on the homepage and camp detail page.
- Sold-out camps are disabled on the checkout form.
- The Apps Script registration endpoint also rejects new registrations that would exceed the 20-seat cap for a camp day.

Important note:

- Because this is still a lightweight static-site setup, availability checks are strongest when the Google Apps Script webhook is online and current.
- For a fully transactional production setup with strict race-condition protection, you would eventually want a dedicated backend or booking system.

### Payment reconciliation setup

The checkout flow now sends a `client_reference_id` into Stripe using the registration ID, and the site includes a `confirmation.html` page that can send the completed Stripe checkout session back to your Apps Script endpoint.

To finish that setup:

1. In Apps Script, open **Project Settings** and add a script property named `STRIPE_SECRET_KEY`.
2. Set `STRIPE_SECRET_KEY` to your Stripe **test secret key** while you are in sandbox mode.
3. Deploy or redeploy the Apps Script web app after updating `apps-script/Code.gs`.
4. Paste the deployed web app URL into `registrationWebhook` in `scripts/site-config.js`.
5. In Stripe, open your Payment Link and set **After payment** to redirect to your site.
6. Use this redirect URL pattern:

```text
https://sunnysidesummercamp.com/confirmation.html?session_id={CHECKOUT_SESSION_ID}
```

When Stripe redirects to that page after payment, the site sends the checkout session ID to Apps Script. Apps Script then looks up the Stripe Checkout Session with your secret key, matches the `client_reference_id` back to the registration ID, and marks matching rows as paid.

### Optional Stripe webhook support

`apps-script/Code.gs` also includes optional support for `checkout.session.completed` events posted directly from Stripe.

- This version uses a lightweight query-string token, not Stripe signature verification.
- Add a script property named `SUNNYSIDE_INTEGRATION_TOKEN` before using this webhook path.
- Configure the webhook URL in Stripe as:

```text
YOUR_APPS_SCRIPT_WEB_APP_URL?token=YOUR_TOKEN_HERE
```

- If `SUNNYSIDE_INTEGRATION_TOKEN` is missing, the webhook request will now be rejected.
- For a full production launch, move this webhook handling to a server that can verify Stripe webhook signatures.

## Notes

- Payment is not truly live until you switch from the Stripe test link to a live Payment Link.
- Central registration tracking is not truly live until you add a webhook URL.
- Automatic payment reconciliation is not truly live until you add the Apps Script `STRIPE_SECRET_KEY` property and configure the Stripe redirect to `confirmation.html`.
- The built-in local backup uses browser storage and is only a fallback, not your main production database.
- The spreadsheet summary uses the internal 20-seat planning cap, but true capacity enforcement still depends on your live registration backend or spreadsheet process.
