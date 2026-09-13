# Why the live site is broken (and why republishing didn't help)

## What I confirmed

I downloaded the live site's own code from nightcitytales.lovable.app and read it.

The file `client-2jAaOjOX.js` still contains this, literally:

```text
{BASE_URL:"/",DEV:!1,MODE:"production",PROD:!0,...}.VITE_SUPABASE_URL
```

That object is the complete list of settings the build had available. The
backend address and public key are simply not in it — so the lookup returns
nothing and the app throws "Missing Supabase environment variable(s)" the
moment any page touches the database. The site's project reference
(`vkgunavjsgmwnfiikavd`) appears **zero** times anywhere in the published code.

## The cause

The backend settings live in a file called `.env` at the project root. That
file is deliberately excluded from the project's saved history (line 20 of
`.gitignore`, added with the note "Real secrets. `.env.example` carries the key
names instead."). `git ls-files` confirms only `.env.example` — an empty
template — is saved.

The preview works because the preview machine has the real `.env` sitting on
disk. The publish build runs from the *saved* project only, so it sees no
backend settings at all and bakes "nothing" into the browser code.

## Why republishing changed nothing

Publishing again re-ran the same build from the same saved files with the same
missing settings, so it produced a byte-identical broken bundle — the filename
hash `client-2jAaOjOX.js` is unchanged from before. It was never a stale-cache
problem; every republish will keep reproducing this exact failure until the
settings are part of what gets built.

## The fix

1. Add a saved settings file containing **only** the three public values the
   browser needs: the backend URL, the publishable key, and the project id.
   These are public by design — they ship in the browser either way, and
   row-level security is what protects the data.
2. Adjust `.gitignore` so that one file is saved while `.env` stays excluded,
   keeping the service-role key and the AI key out of the saved project
   exactly as they are today.
3. Update `.env.example` and the README note so the next person knows which
   half is public and which half is secret.
4. Republish, then re-download the live bundle and confirm the backend address
   now appears in it and that the code file hash has changed.

## Also worth checking in the same pass

Server-side code (`auth-middleware.ts`, `client.server.ts`,
`requestAuth.server.ts`) reads the non-public `SUPABASE_URL` /
`SUPABASE_SERVICE_ROLE_KEY` / `LOVABLE_API_KEY` at request time rather than at
build time, so they are supplied by the hosting environment, not by this file.
The landing page renders fine on the live site, which is consistent with that
— but after the fix I'll sign in on the live site and exercise one AI action to
confirm the server half is genuinely configured and not just untested.
