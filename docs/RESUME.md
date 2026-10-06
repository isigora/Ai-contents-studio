# Next session: minimal handoff

- Source of truth: current main + PROJECT_STATUS.md + original Master Development Specification.
- Checkpoint 009 selects OpenAI gpt-4.1-mini; review reservations $0.50/day, $10/month per
  workspace. `pnpm setup:ai-review` needs private OPENAI_API_KEY inside the Codespace.
  Work has no Codespace terminal tool; remote pull/restart/key setup NOT RUN. Do not imply
  the inaccessible live env lacks a key. Known local Work env has no AI credential.
- Last work: checkpoint 008: source-linked AI pasted-text interpretation → manual fact
  review → registration → AI text adapter. Additive ai_interpretation/provenance link.
  See docs/AI_ACTIVATION.md; provider/model/cost approval required before live calls.
- User reports live preview opens and login works after manual startup. First SNS is X.
  Final product direction and agent requirements: docs/PRODUCT_DIRECTION.md.
- Next user action: pull 008 and restart dev server for schema/cache refresh. Then verify
  overview → quick entry → X text generation → editing/version/export in the browser.
- Fresh tests: 15 mocked AI intake + 10 quick-start server/SSR scenarios, auth origins, full existing
  acceptance/persistence/locales, readiness/diagnostics, typecheck and build PASS.
- Tested locally: 26 acceptance, 4 persistence, 3 locales, typecheck, build, 4 readiness cases,
  actual Next cold start and repeat startup. Remote Codespace and physical iPhone NOT tested.
- BLOCKER: authenticated browser journey still unverified. Local Chromium absent; official
  Playwright browser download returned corrupt/empty ZIP. Do not repeat this install loop.
- Remote Codespace UI access was rejected by automatic approval review on 2026-10-05:
  retrying a previously blocked remote browser path may bypass a restriction. Do not
  retry via another browser, CLI tunnel or indirect execution to evade that rejection.
  User approval was obtained; retry was still rejected. Do not repeat this approval loop.
- `pnpm check:codespaces` is a read-only diagnostic for the existing Codespace terminal;
  local success cannot certify forwarding, browser login, or the phone.
- Next: inspect live Codespace before pulling; verify real forwarded /studio and login,
  company/product editing, generation, save/version/copy, approval, media/reuse at mobile width.
- Tests: pnpm test; pnpm test:ai-intake; pnpm test:quick-start; pnpm test:readiness; pnpm test:auth-origins;
  pnpm typecheck; pnpm build.
- Relevant files: app/studio/page.tsx, scripts/{start-codespaces.sh,check-ready.mjs},
  components/ui-language.tsx, lib/server/auth.ts. Avoid dumping whole large JSX files.
- Keep credentials and .data private. Existing review account password is only in the
  Codespace's ignored .data/dev-test-login.json; never retrieve or print it into chat.
- Do not report P0/P1 complete until browser gates pass. P2/P3 require channel/access/cost decisions.
- X channel choice is resolved. X account/OAuth/budget are NOT connected/approved; see
  docs/X_INTEGRATION.md. Never request tokens or passwords in chat or publish implicitly.
- Save each verified change: test → status/handoff → commit → push → verify remote SHA.
- Token efficiency: read this file first, use targeted rg/ranges and short output; rerun only
  affected checks until a release gate. Never replace evidence with summaries of assumed success.
