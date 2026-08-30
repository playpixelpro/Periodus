# Periodus OpenRouter callback Worker

This Worker gives OpenRouter a conventional HTTPS callback:

`https://periodus.app/auth/openrouter`

The native shells claim that URL with Universal Links / Android App Links. If
link verification is unavailable and the browser reaches the Worker, a static
fallback page offers an explicit **Open Periodus** button. The button forwards
only this allowlist to `periodus://openrouter/callback`:

- `code`
- `state`
- `error`
- `error_description`
- `error_uri`
- `iss`

It does **not** auto-redirect, call OpenRouter, exchange an authorization code,
receive or store an API key, set cookies, log callback values, or load external
scripts/assets. PKCE verification and the one-time code exchange stay in the
native app.

The callback also answers `HEAD` with
`X-Periodus-OpenRouter-Callback: v1`. The native app checks that marker before
opening OpenRouter, so a missing DNS record or undeployed Worker fails before
the user signs in instead of stranding the authorization response.

## Association endpoints

- `/.well-known/apple-app-site-association`
- `/apple-app-site-association` (Apple compatibility location)
- `/.well-known/assetlinks.json`

The Apple Team ID and bundle ID in `wrangler.toml` are taken from the checked-in
Xcode project (`R5R3ZS54LV.com.playpixelpro.myperiod`). A reviewable copy lives at
`associations/apple-app-site-association`.

Android verification intentionally fails with HTTP 503 until
`ANDROID_SHA256_CERT_FINGERPRINTS` contains the SHA-256 fingerprint of the
actual release/app-signing certificate. Do not use a guessed fingerprint.
Separate multiple valid fingerprints with commas. Obtain the correct value
from Play App Signing for Play-distributed builds, or from the release keystore
for directly distributed builds.

## Deploy

1. Ensure `periodus.app` is in the Cloudflare account used by Wrangler.
2. Set `ANDROID_SHA256_CERT_FINGERPRINTS` in `wrangler.toml` or as a Cloudflare
   Worker environment variable before relying on Android App Links.
3. From this directory, run `pnpm test`.
4. Run `pnpm deploy`.
5. Verify the three association/callback URLs over public HTTPS. Association
   files must return HTTP 200 with `Content-Type: application/json`.

The route patterns are intentionally limited to the callback and association
paths; deploying this Worker should not replace the main `periodus.app` site.
