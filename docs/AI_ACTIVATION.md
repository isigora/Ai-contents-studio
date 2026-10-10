# AI intake and text generation — checkpoint 008

Implemented: pasted-text interpretation → private unconfirmed suggestions → source quote
review → manual correction/confirmation → atomic factual registration → existing AI text
generation. Keywords alone may leave most fields unknown. No file/PDF/photo extraction,
generative image/video, X publishing or agent commerce is implemented by this checkpoint.

## Server configuration, after provider/data/cost approval

Configure privately in the existing Codespace's ignored .env.local. Never paste a key into
chat, a form, source code or Git. Keep port 4173 Private and preserve .data.

| Setting | Purpose |
|---|---|
| AI_ENABLED | Keep false until explicitly approved; true enables configured calls |
| AI_PROVIDER_ADAPTER | contract (existing trusted JSON adapter) or chat-completions |
| AI_PROVIDER_URL | Approved full HTTPS endpoint; no embedded credentials or redirects |
| AI_API_KEY | Private server credential |
| AI_MODEL | Approved model ID; no hardcoded provider/model |
| AI_RUN_RESERVATION_USD | Positive estimated reservation per attempt; default 0.10 |
| AI_DAILY_LIMIT_USD | Workspace UTC-day reservation ceiling; default 2 |
| AI_MONTHLY_LIMIT_USD | Workspace calendar-month reservation ceiling; default 10 |

Chat-completions uses system/user messages, JSON object mode, max_completion_tokens=2500
and store=false. Check the selected provider/model supports these options; this is not
universal compatibility. No SDK or new dependency was added. Contract adapter accepts
model/task/instructions plus task data and returns task JSON. Task knowledge-intake-v1
returns name/summary/audience/cta as null or {value,quote}, kind as product/service/null,
and questions as an array. Text task channels-v2 retains generatedSchema.

Official interface checked 2026-10-06:
https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create
JSON mode is not a factual/schema guarantee. All responses are server-validated. Models
may still misinterpret quotations: suggestions require human confirmation.

## Limits and records

Only explicitly consented pasted text (maximum 12,000 characters) is sent for intake.
No retrieval from other workspaces, assets, URLs, tools or account credentials is performed.
Outputs are limited to 100,000 bytes, calls time out after 30 seconds, redirects are refused,
and upstream response/error details are not returned or logged. Quotes must occur verbatim
in the source; numeric claims must occur in each candidate's supporting quote. These checks
do not prove semantic accuracy or eliminate prompt injection.

ai_interpretation stores source, result, user, model, request hash/key, status and estimated
reservation privately in the DB. Audit events store IDs, not raw source. No existing factual
records change during interpretation. On confirmation, knowledge_intake records the
interpretation ID alongside final edited facts. Prices/proofs stay blank. Results are scoped
to the requesting user and workspace; editor/owner permissions gate calls.

Workspace locking serialises reservations. Intake and text generation share a reservation
ceiling; failed/interrupted attempts retain reservations because billing may have occurred.
This is NOT metered billing or a guaranteed actual USD cap. Provider-side spending controls
and an appropriate reservation for input/output prices are required before activation.
Intake allows ten attempts per workspace per minute. Same-key replay does not call AI again.
Running jobs return 202; after two minutes without completion they are marked interrupted
on replay, without an automatic new call. UI preserves input and offers an explicit new
request with a cost notice. Private GET .../interpretations/:id retrieves a persisted result.

## Deployment and verification

Pull the checkpoint after inspecting local changes; restart the existing dev server. Local
PGlite startup applies additive schema; production PostgreSQL needs the existing migration
procedure. No live Codespace DB migration was executed from Work.

Overview quick entry: paste permitted material → consent → interpret → compare suggested
fields/quotes → apply to form → fill unknown fields/select kind → confirm facts → register →
generate X draft → edit/save/export. This creates a draft, not a post. Without approved
configuration, UI explicitly offers manual registration.

Tests: pnpm test:ai-intake; pnpm test:quick-start; pnpm test:auth-origins; pnpm test;
pnpm typecheck; pnpm build. AI tests use a mocked provider with no network/fees; they do
not establish live model quality, browser/mobile behavior or production readiness.

Next: approved live provider smoke test and browser fact/content flow, then generative
image/video jobs with usage rights and immutable approval; owner OAuth and approved X
publication; finally consent-scoped need detection/proposal exchange/owner reporting.
Purchases, payments and contract acceptance require separately configured delegation.

## Selected review profile — 2026-10-06

User delegated provider/model/budget selection and private configuration. Initial text
provider is OpenAI, model gpt-4.1-mini, endpoint https://api.openai.com/v1/chat/completions.
Review reservations: USD 0.10 per attempt, USD 0.50 per day, USD 10 per calendar month,
per workspace, jointly covering interpretation and text generation including failed attempts.
These are conservative reservation limits, not proof of actual billing or an account-wide cap.
No credits purchased and no key fabricated. Image/video provider/model budgets are not enabled.
Official model/pricing source: https://developers.openai.com/api/docs/models/gpt-4.1-mini
Standard text pricing checked today: USD 0.40 input and USD 1.60 output per million tokens.
Recheck before production; live quality/account access have not been established.

`pnpm setup:ai-review` safely applies this profile only inside a matching local Codespace,
using private OPENAI_API_KEY from Codespaces Secrets (or an existing matching AI_API_KEY).
Missing credential, production/external DB, wrong origin and symlink targets are refused
before mutation. Existing auth secret, data path, origins and unrelated settings are preserved;
configuration is replaced atomically with mode 0600. The script does not make API calls.

One-time owner action: create a project API key at https://platform.openai.com/api-keys;
save it as private OPENAI_API_KEY at https://github.com/settings/codespaces, granting access
only to isigora/Ai-contents-studio. Never share it in chat or commit it. Restart the existing
Codespace to load the secret, inspect worktree, pull with `git pull --ff-only`, then run
`pnpm setup:ai-review`. Restart the existing Codespace once more to reload Next configuration.
If no service starts, use `bash scripts/start-codespaces.sh`; verify `pnpm check:codespaces`.
Do not discard unknown changes to make a pull succeed. Keep forwarding Private.

Work has GitHub source tools but no Codespace terminal API. Earlier automatic review
rejected remote browser execution even after owner approval; no alternate tunnel/browser
was attempted. Therefore these live setup/restart steps have NOT been executed by Work.

## Failure diagnosis — checkpoint 010

User reports local readiness success, saved OpenAI profile and model lookup HTTP200 on
2026-10-10. These are user-provided live observations, not Work's direct remote execution.
Actual text generation still failed. Do not infer credit availability from a model GET.
Official error reference checked: https://developers.openai.com/api/docs/guides/error-codes

After deploying/restarting 010, a generation failure shows a safe actionable classification.
GET /api/ai-diagnostics in the same logged-in browser shows only the requesting user's latest
five tasks in workspaces where they currently have owner/editor membership. This read-only
route does not call AI or reveal source data, credentials, raw errors or other users' jobs.
Old generic provider errors cannot reconstruct information that was never stored.

| Reason | Action |
|---|---|
| AI_BILLING_QUOTA | Owner checks API credit/billing limits in their provider project |
| AI_PERMISSION_DENIED / AI_AUTH_FAILED | Check generation endpoint/key/project permissions |
| AI_REQUEST_INVALID | Inspect server request options before another call |
| AI_MODEL_UNAVAILABLE | Verify model availability for generation on the selected project |
| AI_RATE_LIMIT / AI_TIMEOUT / AI_PROVIDER_FAILED | Investigate service state; no blind retries |
| AI_OUTPUT_INVALID / AI_OUTPUT_TRUNCATED | Correct schema or output size handling |
| AI_SOURCE_INVALID / AI_UNSUPPORTED_NUMBER / AI_UNSUPPORTED_CLAIM | Review supplied facts/output; retain checks |

No billing purchase, budget increase, automatic retry or claims-validation bypass was made.
An explicitly initiated failed attempt may still consume a reservation and provider cost.
