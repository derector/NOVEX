# NOVEX cloud backend (free-tier setup)

NOVEX currently builds as a static web app and Android wrapper. Static hosting alone cannot provide accounts, cloud project storage, or cross-device sync. This folder prepares a secure Supabase/Postgres schema; it does **not** claim cloud sync is active until a Supabase project is created and the client integration is configured.

## Free components
- GitHub Actions + GitHub Pages: build and static hosting.
- Supabase Free: Auth + Postgres + Storage (quota and inactivity limits apply).
- FFmpeg.wasm: browser-side MP4 processing under the MIT-licensed project; media can remain on the user's device.

Official links:
- Supabase pricing: https://supabase.com/pricing
- Supabase docs: https://supabase.com/docs
- FFmpeg.wasm: https://github.com/ffmpegwasm/ffmpeg.wasm

## Configure the cloud database
1. Create a Supabase project at https://supabase.com/.
2. Open SQL Editor and run `supabase-schema.sql`.
3. Enable email authentication (and optionally OAuth) in Supabase Auth.
4. Obtain the Project URL and publishable/anon client key from Project Settings → API.
5. Configure the NOVEX client to use those public client values. Never put a service-role key in browser code or the APK.
6. For media files, create a private Storage bucket and add owner-only policies before enabling uploads. Avoid public write policies.
7. Test account creation, login/logout, project CRUD, cross-device sync, access isolation between two test accounts, and Android WebView behaviour before calling cloud support production-ready.

## Security model
The table policy limits reads and writes to the authenticated owner via `auth.uid() = user_id`. Do not disable RLS. Cloud media uploads require separate Storage policies and quotas. Render jobs still run locally in the browser; cloud sync of metadata does not mean server-side rendering.

## Current status
Schema prepared; hosted backend provisioning and frontend auth/sync integration remain pending because these require a Supabase project owned by the operator. No credentials are included in this repository.
