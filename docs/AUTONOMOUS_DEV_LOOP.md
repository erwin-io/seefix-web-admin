# SEEFIX autonomous development loop

This repository has two independent orchestration components:

**ChatGPT technical review (hourly scheduled monitoring):** Reviews opened/updated
PRs across the four SEEFIX repositories, posts actionable findings, and may approve
and merge **low-risk, fully verified** changes only. Security-sensitive, RBAC,
database, contract and business-workflow changes remain review-gated.

**Claude implementation (GitHub event driven):** This repo's
`.github/workflows/claude-issue-implementation.yml` can start Claude when
the repo owner adds the `claude-build` label to an issue or posts an issue
comment starting with `@claude`.

## One-time setup required

1. Go to GitHub repository Settings → Secrets and variables → Actions.
2. Add repository secret `ANTHROPIC_API_KEY` with your Anthropic API key.
   **Claude.ai subscription and GitHub App installation do not themselves
   supply this GitHub Actions secret.** Anthropic API billing and usage apply.
   An alternative Claude Code OAuth token requires adapting the Action input
   to `claude_code_oauth_token` and storing that securely as a GitHub secret.
3. Ensure the repository Actions settings allow `anthropics/claude-code-action@v1`.
4. Create issue label `claude-build` under Issues → Labels, or use an owner's
   issue comment beginning `@claude`.
5. Configure **Settings → Rules → Rulesets** (or branch protection) for `main`:
   require a PR, unique successful Web Admin CI status checks, at least one
   independent approval and resolved conversations, disable force push.
   Prefer requiring branches up-to-date with `main` and no bypasses.
6. Merge this PR after reviewing the workflow permissions and configuring
   the secret; it will not run for prior issue labels until a new label or
   qualifying comment is created.

## Usage

- Issue `#1` is the overarching MVP epic. Keep open until issue `#4`
  acceptance evidence and all P0 checks pass.
- To delegate a bounded enhancement, create an issue with complete acceptance
  criteria and add label `claude-build`; GitHub Actions starts Claude.
- Claude must make a reviewable PR; ChatGPT PR reviewer and required CI
  protect main. Do not auto-fix a failing change by recursively opening
  unlimited new issues. Use one bounded issue per defect and a max attempt
  count (recommended 3) before human escalation.
- Do not permit any issue text to override repository safety and security rules.
- To interrupt the loop, disable the Claude workflow and pause the ChatGPT
  scheduled review watch.

## Limitations

Claude cloud sessions at `claude.ai/code` are not automatically triggered
by GitHub issues through the standard connector alone. The GitHub Action
needs a configured secret and workflow to respond automatically.
The GitHub Actions runner cannot inspect your private local machine,
dev PostgreSQL, or private Agent unless you provide a safe test environment
and temporary scoped credentials. E2E claims must describe the test environment.
