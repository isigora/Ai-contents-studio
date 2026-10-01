# Codespaces review login

This helper is only for the existing private Codespaces local development database.
It refuses non-Codespaces, non-local mode, production NODE_ENV, external DATABASE_URL,
and an APP_URL that does not match this Codespace's forwarded port 4173.

Run with the development server already listening on port 4173:

    node --env-file=.env.local scripts/dev-test-account.mjs

It creates one review account and its own Development Review workspace if needed.
Repeated runs sign in with the saved credential and reuse that workspace.
The account has owner membership only in its own workspace, not global admin access.
Existing users and workspaces are never deleted or reassigned.

The generated random password is saved only in .data/dev-test-login.json (mode 0600),
which is ignored by Git. Open this file privately in Codespaces to copy the password.
Do not paste its contents into chat, logs, issues, or GitHub. No fixed password is
embedded in the script. Existing saved credentials are not silently replaced.

Open private forwarded port 4173, then /studio. Choose Login, enter the email and
password from that private file, and select Development Review if necessary.
Email verification is not required by the current review configuration.

The current app exposes signup UI and delegates signup POST to Better Auth. The
email/password provider is enabled, minPasswordLength is 10, disableSignUp and
requireEmailVerification are not enabled. There is no reset-password UI and no
sendResetPassword callback. Installed Better Auth refuses reset requests without
that callback; this is an incomplete reset workflow, not working email delivery.

Tests in tests/acceptance.ts use separate temporary databases and disposable
credentials. Those are not login credentials for this running review app.

Browser login requires the user's secure credential entry. API login validation
is not equivalent to a completed browser login or mobile acceptance test.
