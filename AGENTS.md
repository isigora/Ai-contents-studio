# AI Content Studio agent instructions

Before work, read docs/Master_Development_Specification.md, PROJECT_STATUS.md, current branch/HEAD, git status, actual source and test results. If source is still archived, inspect content-studio-source.zip. Do not create a replacement project.
Preserve the specification unchanged. Current code is the implementation truth; status summarizes evidence, not aspirations.
Follow the resume queue in PROJECT_STATUS.md. Use completed / partial / not started accurately.
At each stable unit: implement, execute, test, fix, retest, update PROJECT_STATUS.md, commit with phase prefix, push and verify remote HEAD.
Keep changes in small durable checkpoints. If blocked, record exact commands, error, remaining work and recovery steps; distinguish WIP from stable.
Record test date, environment, source commit, scope and limitations. A historical report is not a new test run.
Never store secrets, user data, .env.local, .data or node_modules in Git. Never reset or overwrite unknown work.
Do not enable paid services, external publishing, billing or new sensitive credentials without user authorization. Keep Codespaces forwarded port Private.
P0/P1 are partial release status; P2/P3 are unimplemented until code and evidence prove otherwise. P4 is not defined.

Efficient resume: read PROJECT_STATUS.md and git diff first; inspect only files needed by the next gate. Run focused checks after small changes, the full suite at a release checkpoint. Update the status and push each verified checkpoint before moving on. Do not trade correctness for shorter logs; summarize output and retain reproducible test commands.
