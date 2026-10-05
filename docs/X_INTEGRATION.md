# First channel: X — preparation only

User selected x.com on 2026-10-05. Current code adds X draft templates for social text,
ad copy and video scripts. There is no account connection, media upload, publishing or
scheduling endpoint. The 280-character editorial target is NOT weighted X length validation.

Official sources checked 2026-10-05:
- https://docs.x.com/x-api/posts/create-post
- https://docs.x.com/x-api/getting-started/pricing

The create-post endpoint is POST https://api.x.com/2/tweets. Its documentation specifies
user-context OAuth 2.0 Authorization Code and scopes tweet.write, tweet.read, users.read.
Media must be uploaded first and referenced by media IDs. The pricing documentation says
credit-based pay-per-usage, with spending limits; verify current endpoint pricing in the
developer console before asking the owner to fund a budget. No credits were purchased.

## Next implementation gate

1. Finish P0/P1 preview/browser gates before activating P2 publishing.
2. Present the proposed operating callback domain, account permission scope and maximum
   budget. The owner's X selection does not authorise fees or actual publication.
3. Once approved, register/configure the existing owner's developer app and use PKCE/state,
   owner-only connection controls and encrypted server-side token storage. Never use an
   application-only bearer token as though it permits posting on behalf of a user.
4. Bind approval to an immutable content version and posting account. Preview the exact
   text/media, validate weighted length, and reject changes after approval.
5. Persist each publish job before calling X. Handle timeouts as uncertain outcomes to
   prevent duplicate posts; record the returned post ID/link on success and safe errors
   on failure. A failed attempt is not a successful or retry-safe post.
6. Add media-upload processing/status, revocation, budget controls and scheduling after the
   first verified approved text post. No external calls occur in current template tests.

Do not request passwords or tokens in chat. User authorisation belongs in the account's
normal OAuth flow; server secrets belong in private deployment configuration.
