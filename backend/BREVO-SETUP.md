# NOVEX + Brevo email setup

Keep Brevo credentials on the server. Never put a Brevo API key or SMTP key in frontend code, Vite variables, GitHub Pages, or the Android APK.

## Supabase Auth email via Brevo SMTP

1. In Brevo, verify a sender/domain you control and publish the SPF/DKIM records.
2. In Supabase Dashboard → Authentication → Emails → SMTP Settings, enable custom SMTP.
3. Configure sender email to the verified Brevo sender, sender name NOVEX, host smtp-relay.brevo.com, port 587, username your Brevo login email, password the Brevo SMTP key (not the API key).
4. Review Supabase Authentication → Email Templates and test sign-up confirmation and magic-link delivery.

Official guide: https://developers.brevo.com/docs/supabase-smtp-integration

## Transactional support messages

The Supabase Edge Function `novex-email` sends signed-in users' support messages to a fixed support inbox. It must validate the Supabase user session, restrict subject/body lengths, escape HTML and never accept an arbitrary recipient from the browser.

Set these secrets in the Supabase project, not GitHub or frontend variables:
- `BREVO_API_KEY` — Brevo API key for `POST https://api.brevo.com/v3/smtp/email`
- `BREVO_SENDER_EMAIL` — verified sender address
- `BREVO_SENDER_NAME` — NOVEX
- `NOVEX_SUPPORT_EMAIL` — support inbox

Deploy with the Supabase CLI after linking your project:
```sh
supabase secrets set BREVO_API_KEY=YOUR_BREVO_API_KEY
supabase secrets set BREVO_SENDER_EMAIL=YOUR_VERIFIED_SENDER
supabase secrets set BREVO_SENDER_NAME=NOVEX
supabase secrets set NOVEX_SUPPORT_EMAIL=YOUR_SUPPORT_INBOX
supabase functions deploy novex-email
```

Supabase supplies the function URL and anon key. Never use the service-role key for this endpoint. Add `https://derector.github.io/NOVEX/**` to Supabase Auth allowed redirect URLs so email links return to the app.

## Testing and limits

Test with an existing account, click the email sign-in link, then send a support message and confirm it arrives in the configured inbox. Check Supabase function logs and Brevo transactional logs if delivery fails.

Brevo API key and SMTP key are different credentials. Sender verification and a working transactional-email account are required. Account setup, DNS verification, secrets, and a real inbox test must be completed by an account owner; a successful app build does not prove delivery.
