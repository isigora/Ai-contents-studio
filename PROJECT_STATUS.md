# AI Content Studio — Project Status

Last updated: 2026-10-06 UTC.
Repository: isigora/Ai-contents-studio. Branch: main.
Current phase: P0/P1 AI intake preparation and preview verification; external activation pending.
Runnable package version: 0.2.0 (P0 + P1), extracted into the repository; original ZIP retained.
Latest verified source archive commit: c08243657fc5324df542c518ee7eb4d99b1fceff.
Last saved configuration commit at recovery: 03c5498decc5a6128f1fa9398038c09f47391df7.
No commit is yet certified as a fully tested production release.
This document's checkpoint SHA is obtained with git log -1 -- PROJECT_STATUS.md; do not insert a self-referential SHA.

## Authority and recovery
1. Read docs/Master_Development_Specification.md (currently also inside the source ZIP).
2. Fetch GitHub; inspect branch, HEAD, git status and uncommitted changes before editing.
3. Read this file, recent commits, actual code and test evidence.
4. Classify complete / partial / not started; resume the first unfinished item below.
5. Preserve user data, .env.local and the original specification.
Specification SHA-256: 3bb74b3a00c8c41bc137adc29c91105234a194f92eb449db5d287f45b3c933d9.
Source ZIP SHA-256: 3148d9b70527be668409c8a931edd9685adad9d5c88f4b2922dde094f599d568.

## Status by phase
| Phase | Goal | Status |
|---|---|---|
| P0 | Multi-workspace business knowledge and text content MVP | Partial: user reports Codespace login success; quick factual entry implemented; full authenticated creation/mobile journey remains |
| P1 | Approval, templates, image/video/subtitle production, reuse, three UI languages | Partial: implemented and server tested; full browser and release gates remain |
| P2 | Official API publishing, scheduling, metrics, billing | Not started; X selected; account access, cost and release gates remain |
| P3 | Consented buyer/supplier matching | Not started |
| P4 | Not defined in the existing specification | Not scheduled; do not invent scope |

### P0
Implemented: Better Auth signup/login/session; workspace roles and isolation; company/product/audience CRUD; facts, prices, snapshots; basic text generation; editing/versioning/TXT/JSON export; private assets and PDF quarantine.
Main files: app/studio/page.tsx, lib/server/{auth,db,service,generator,storage}.ts, lib/server/schema.sql, lib/models.ts.
Evidence: 18 P0 acceptance scenarios within tests/acceptance.ts; prior test run 2026-10-01 03:08 UTC.
Remaining: authenticated browser signup → edit → generate → copy flow including mobile; operational email verification/reset, PDF scanning and deployment decisions.
Known limitations: AI_ENABLED=false uses factual templates, not a live AI model; AI intake/adapters are mock-tested but not activated; external PostgreSQL/S3 not verified; PDF extraction/scanning not connected.
Next: finish Codespaces HTTP/UI verification and authenticated E2E.

### P1
Implemented: approval/revision/reuse; channel templates; photo-based PNG, 9-second H.264 MP4 and SRT; KR/ZH/EN UI; migration and backup/restore.
Main files: lib/server/{p1,media}.ts, components/studio-production.tsx, components/ui-language.tsx, scripts/{backup-local,restore-local}.mjs.
Evidence: 8 P1 server acceptance scenarios, 4 persistence checks, 3 language render checks. TypeScript and production build passed in the prior Work environment.
Remaining: browser approval/media journey; native language review; operational load and storage validation.
Known limitations: synchronous media rendering, no distributed queue; some server errors Korean-only; foreign content uses approved translations, not automatic AI translation.
Next: verify P1 media in Codespaces after P0 browser path.

### P2 / P3
No implementation found. X was selected by the user on 2026-10-05. Preparation is in
docs/X_INTEGRATION.md; final product clarifications are in docs/PRODUCT_DIRECTION.md.
No external posting, billing, paid AI or matching has been enabled.
Main reference: docs/Master_Development_Specification.md, sections 1 and 7.
Tests: none. Do not label planned features completed.

## Checkpoint 001 — repository recovery (documentation checkpoint)
Verified directly: main contains only source ZIP and .devcontainer/devcontainer.json; PROJECT_STATUS.md did not exist.
Source ZIP inspected: actual P0/P1 implementation, specification, tests and prior results present.
Prior evidence: 26 acceptance, 4 persistence, 3 language checks passed; typecheck/build passed. This is historical evidence, not a fresh Codespaces run.
Existing Codespace: fuzzy-space-spork-r49wq4qv49q62q49.
Online execution is unverified. Earlier postStart returned success but the port view showed no running process.
Work scratch was pruned; recovered code from GitHub, not from conversation claims.

## Resume queue
1. Read docs/RESUME.md for the last verified checkpoint and current blocker.
2. Inspect existing Codespace branch/HEAD/worktree before pulling; preserve its data and secrets.
3. Verify forwarded /studio response and actual browser signup/login → edit → generate → copy (mobile included).
4. Verify P1 browser approval, media and reuse; retain PARTIAL status until these pass.
5. Select operating domain, mail provider, production DB/storage and AI access before activation.
6. P2/P3 only after existing release gates and explicit channel/cost decisions.

## Operating rules
Implementation → run → test → fix → retest → update status → commit → push → verify remote SHA.
Use phase prefixes such as P0-fix, P1, OPS or MEMORY; do not renumber specification phases.
For untested interruption checkpoints, explicitly mark WIP and never update the stable pointer.
Never commit .env.local, credentials, .data, node_modules, logs containing secrets or customer uploads.
Do not force-push, discard unknown changes, delete data, incur new cost, change scope/specification or introduce destructive architecture changes without required user authorization.
Codespaces is a development preview, not a 24-hour production server.

## Checkpoint 002 — source recovery and Codespaces validation
Original archived files matched byte-for-byte before testing and the startup fix.
Fresh Codespaces validation: 26 acceptance + 4 persistence + 3 UI language checks PASS; pnpm typecheck PASS; pnpm build PASS. Machine-readable evidence is in docs/*-results.json.
Source is now tracked as individual files. Original master specification remains unchanged.
Startup script now verifies HTTP readiness and reports failure instead of unconditional success. Cold start and already-running paths verified.
Browser: private forwarded homepage opened successfully; /studio verification in progress.
P0/P1 remain PARTIAL. P2/P3 remain NOT STARTED. No production certification.
Next: finish authenticated browser/mobile/media flow, then resolve remaining release gates.

## Checkpoint 003 — development login preparation (2026-10-01 UTC)
Source baseline: 2581b37963c4008768d1cba30a8a72e085ca95de, main; clean worktree before changes.
Actual environment: existing fuzzy-space-spork Codespace, Node 24.21.0, APP_MODE local,
no external DATABASE_URL; PGlite .data/postgres. No server process was present initially.
Read-only query before server startup found zero auth_user rows. Existing data was preserved.
Started scripts/start-codespaces.sh; HTTP readiness passed and /studio login UI loaded.
Added scripts/dev-test-account.mjs and docs/DEV_LOGIN.md. Generated one private local
review account with its own Development Review workspace and owner membership.
Credentials stay in ignored .data/dev-test-login.json with mode 0600 and are never printed.
Fresh checks: signup API succeeded; password signin with emailVerified=false succeeded;
/api/me and workspace GET succeeded with owner role; repeated helper runs reused the
account/workspace; APP_MODE=production guard rejected execution before mutation.
Verified Git ignores .env.local and the credential file. No operational mail was enabled.
Installed Better Auth source confirms verification is conditional and password reset
requires the absent sendResetPassword callback. Signup is not disabled in UI/config.
Browser /studio logged-out rendering PASS; authenticated browser/workspace journey
PENDING secure user credential entry. No claim of full P0/P1 completion or mobile testing.
Original reported signup failure is not conclusively reproduced; current API signup works.
Next: secure browser login, verify workspace UI, update this checkpoint with actual results.

## Checkpoint 004 — connection recovery and repeatable startup (2026-10-04 UTC)
Baseline source: 3d7a5449c564ca2d01b99a1d1733083866ade80a; clean main clone.
Environment: isolated Work checkout, Node 24.19.0, pnpm 11.25.0; NOT the running Codespace.
Implemented: session 401 is distinguished from service/network failure; failed connection
shows a retry screen, not a misleading login form. Non-JSON authentication responses have
a readable error. Editing defaults to denied until owner/editor membership is loaded.
New recovery labels are translated into Korean/Chinese/English.
Startup now checks /studio HTML (rejecting empty/download responses) AND anonymous
Better Auth JSON. flock serializes starts; an occupied unhealthy port is reported instead
of spawning a second process against PGlite. Next agentRules auto-generation is disabled
so the project's own agent instructions stay stable. Resume guidance uses focused reads.
Fresh checks: 26 acceptance + 4 persistence + 3 language renders PASS; typecheck PASS;
production build PASS; 4 readiness positive/negative cases PASS; actual cold start and
already-running startup PASS. See docs/startup-results.json and docs/*-results.json.
No remote Codespace changes, live-user data operations, email sending or paid AI calls.
Browser gate BLOCKED: no installed Chromium; `pnpm exec playwright install chromium`
returned a corrupt/empty ZIP (End of central directory record signature not found).
An experimental browser runner was not retained because it could not be validated.
Actual iPhone, authenticated browser flow, and the user's 0KB forwarded response remain
unverified. This is not evidence that the original remote 0KB issue is fixed.
P0/P1 remain PARTIAL; P2/P3 NOT STARTED. No production-complete claim.

## Checkpoint 005 — delivery completion and focused connection diagnosis (2026-10-05 UTC)
Found checkpoint 004 had not moved remote main; completed the non-force update and
verified GitHub main at be397e4ec10e82a93a6f2ea6b523d6e92d9cb0ef, tree
dabb8cd741c275fe7d850b643c36c88494dafaf6 (identical to the tested local source).
Added `pnpm check:codespaces`, a read-only loopback/configuration diagnostic. Reports
empty/download responses, redirects, HTTP errors, incorrect content, invalid auth JSON,
connection failures and configuration mismatches without response bodies or secrets.
Does not open the DB, alter data, restart services or access the forwarded public URL.
Fresh local verification (Node 24.19.0): 11 diagnostic cases and 4 readiness cases PASS.
Actual diagnostic run correctly reported no local running service and a non-Codespaces
environment. This is NOT a diagnosis of the user's current Codespace.
Remote execution BLOCKED: automatic approval review rejected opening the Codespace
through the browser because it would retry an already blocked remote path and could
constitute a bypass. Do not route around that rejection. User approval is needed before
attempting that access again. No live Codespace or user DB changes in this checkpoint.
Next gate remains actual private Codespace browser login/workspace and mobile verification.
P0/P1 remain PARTIAL, P2/P3 NOT STARTED. Prior build/acceptance results are historical;
this checkpoint changes diagnostic tooling/documentation, not the application runtime.

## Checkpoint 006 — guarded Codespace authentication origin (2026-10-05 UTC)
Baseline remote main: 5107e09bdd6b74f6827f3543a5a2f0026817d331.
User-provided live evidence: initially no service listening on 4173; after pull/install/start,
the user reported /studio opened. Public APP_URL and TRUSTED_ORIGINS matched the browser
URL, but Better Auth logs rejected https://localhost:4173 on three login attempts.
Installed Better Auth validates Origin, or infers request origin for Origin=null with
Sec-Fetch-Site=same-origin. Exact proxy/header transformation in Codespace is unverified.
Added only https://localhost:4173 to effective trusted origins under strict local Codespace
guards: nonproduction NODE_ENV, no external DB, matching named forwarded APP_URL.
No wildcard, disabled origin/CSRF validation, production allowlist expansion, or secret changes.
Fresh Work verification, Node 24.19.0: isolated PGlite auth test checks HTTPS-loopback login,
public-origin login and null/same-origin inference; foreign origin, wrong port and null/cross-site
rejected. Guard tests exclude production/external-DB/non-Codespace/mismatched origins.
Typecheck and production build PASS. This is local evidence, not the user's browser result.
Credentials in tests are random and confined to a new temporary DB; user DB untouched.
Next: user pulls update, restarts the existing Codespace's dev server to clear cached auth,
and retries review-owner login and Development Review workspace access. P0/P1 remain PARTIAL.

## Checkpoint 007 — user login evidence, quick factual entry and X draft templates
Date: 2026-10-05 UTC. Baseline remote main: 6584e3ffdf096251218da55e6f7f225c39aa47c9.
User supplied HTTP=000 after restart; manual start reported readiness and HTTP=200.
User then explicitly reported the preview opens and login succeeds. This resolves the
reported login blocker; it is user-observed evidence, not an independently operated browser
test. Workspace/edit/generate/copy, mobile and P1 browser/media gates are still pending.
User selected X as the first SNS and authorised continued development. Automatic browser
review still blocked direct Codespace access after the user's approval; do not route around it.

Implemented an owner/editor quick entry form: keyword/name, actual offering description,
audience and CTA with fact confirmation. It atomically creates linked audience/offering
records and revision/audit history, then selects X social/short settings. Price/evidence
remain blank. This is minimal factual input, NOT automatic AI interpretation of keywords,
files or photos. Existing detailed editing and media functionality remains available.
Added additive knowledge_intake table, repeatable request keys, request conflict checks,
workspace locking and rate limits. A retry cannot create duplicate linked facts. Failed
insertion rolls back the audience, offering and revisions together. Existing data untouched.

Also fixed the business API's separate origin check, which otherwise still rejected the
HTTPS-loopback origin despite successful auth. Uses the same exact Codespace guards;
null/same-origin inference applies only to that guarded local request URL. Foreign origins,
wrong ports and null/cross-site requests remain blocked, including production inference.
X is a draft channel template only; no account token, publishing API or scheduler exists.
Template version becomes channels-v2; historical saved versions/snapshots are not modified.

Fresh isolated Work tests, Node 24.19.0/pnpm 11.25.0: 10 quick-start integration scenarios
PASS (including concurrent replay, transaction rollback, roles/isolation, generation,
editing/export and actual component SSR in three languages); auth origin checks PASS;
26 existing acceptance + 4 persistence + 3 locale renders PASS; 4 readiness + 11 diagnostic
cases PASS; typecheck and production build PASS. See docs/quick-start-results.json and
updated docs/*-results.json. These are server/SSR results, not browser click certification.
Original master specification SHA-256 remains unchanged. No live-user DB, credentials,
paid AI, X posting or developer-account mutations were performed.

Deployment: pull this checkpoint, restart the same Codespace's Next dev server so additive
schema runs and cached server modules refresh; use start-codespaces.sh if not auto-started.
Next browser path: overview → quick entry → X text generation → edit/save → export;
then approval, photo card, MP4/SRT and reuse. Next external gate: provider/budget selection
and X OAuth scope/callback/cost approval, after P0/P1 release evidence. P0/P1 remain PARTIAL.

## Checkpoint 008 — source-linked AI intake and shared text adapter
Date: 2026-10-06 UTC. Baseline remote main: 660c710dd51d7f476e0fdc28fb6ba0986969abf9.
User supplied an authenticated quick-entry screenshot and requests progression to actual
AI interpretation, generative media, X publishing and consented agent negotiation. The
screenshot confirms the form is deployed; it does not prove generation/media/browser gates.
This checkpoint implements the first concrete unit, not all four capabilities.

Implemented POST/GET interpretations, additive private ai_interpretation table and optional
provenance link on confirmed knowledge_intake. Pasted text is sent only with consent and
editor/owner access; model results remain unconfirmed, separate from factual records.
Candidates carry verbatim source quotes; invalid schema, absent quotes and invented numbers
are rejected. Missing facts remain null. UI shows suggestions/quotes/questions, permits
correction and requires confirmation before atomic registration. Kind must be selected when
unknown. No auto-approval/publication. Quotation checks do not establish semantic accuracy.

Added bounded server-only contract/chat-completions adapter reused by text generation,
30-second timeout, 100KB output limit, no redirects/upstream secret or error leakage.
Intake is durable/idempotent with running/failed/interrupted handling; retries do not repeat
billed calls automatically. Shared workspace-locked intake/text reservations and intake
rate limits apply. Reservations are not metered or guaranteed USD ceilings. Preserved
channel advice/length warnings in AI text output, formerly only present in template output.

Fresh isolated Work verification, Node 24.19.0/pnpm 11.25.0: 15 AI intake scenarios PASS;
10 quick-start scenarios, auth origin checks, 26 acceptance, 4 persistence, 3 language renders
PASS; typecheck and final production build PASS. See docs/ai-intake-results.json. Provider
responses are MOCKED; no paid/live AI call, customer data transmission, live Codespace DB
mutation, X posting or agent negotiation. Original specification hash, existing data/secrets
and unknown ZIP modification preserved. Test-generated video fixture restored to baseline.

Activation: docs/AI_ACTIVATION.md gives server settings/limitations. Provider, model, data
scope and cost approval remain unresolved; do not enable paid services implicitly. Existing
remote-browser review restriction remains; no alternate access path attempted.
Next: pull/restart preview for additive schema/UI; approve/configure provider privately;
verify live interpretation→confirmation→AI text; then generative media, X, agent protocol.
P0/P1 remain PARTIAL, P2/P3 NOT STARTED. No production release certification.

## Checkpoint 009 — selected AI review profile and monthly reservation guard
Date: 2026-10-06 UTC. Baseline remote: e9d3701605bc80f411d733b32549487ab11787c5.
User delegates update/restart, provider/model/budget selection and private credential setup.
Selected OpenAI gpt-4.1-mini for initial interpretation/text; reservation limits USD 0.50/day,
USD 10/month/workspace, USD 0.10/attempt. Provider price verified from official model docs;
no credits purchased or paid calls made. Limits are estimates, not actual metered/account caps.

Implemented guarded `pnpm setup:ai-review`: existing local Codespace/origin required; private
OPENAI_API_KEY required; production/external DB/symlink refused; atomic mode-0600 config
preserves auth/DB/storage/origins. Centralised AI reservation checks add a shared calendar
month limit to intake/text without modifying existing DB rows or releasing failed costs.
Configuration failure with no key does not change the env file or falsely enable AI.

Fresh Work tests: 6 isolated configuration checks, 16 mocked AI intake scenarios, 26 acceptance,
4 persistence and 3 locale checks PASS; typecheck/final build PASS. Tests use random temporary
credentials and DBs. User DB/secrets untouched; unknown source ZIP modification preserved.
Original specification unchanged. Provider selection does not certify live model quality.

BLOCKED live deployment: available GitHub connector has source tools but no Codespace
terminal/secret-management capability. Prior automatic review rejected remote browser access
even after user approval; no bypass attempted. This local Work env has no AI credential;
the current Codespace secret state is inaccessible, not assumed empty. We cannot issue a
provider key on the user's account. Actual Codespace pull/restart/profile application and
live model test remain NOT RUN. Recovery is documented in docs/AI_ACTIVATION.md.
Next unavoidable owner action: issue/store a private OPENAI_API_KEY; execute setup/restart
in the existing Codespace. Then validate live intake/text before media→X→agent activation.
P0/P1 PARTIAL, P2/P3 NOT STARTED. No publishing or commerce claim.
