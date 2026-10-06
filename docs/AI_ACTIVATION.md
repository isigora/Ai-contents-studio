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
