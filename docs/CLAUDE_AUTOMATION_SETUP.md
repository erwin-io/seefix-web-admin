# SEEFIX Claude Code — Secure Issue Automation

This GitHub Action is **not activated** until its workflow PR is reviewed, merged, and the required secret and repository protections are configured.

## One-time owner actions
1. Confirm the **Claude GitHub App** has access to this exact repo in Claude Connectors or GitHub's Installed GitHub Apps.
2. In GitHub: Settings → Secrets and variables → Actions → New repository secret; name it `ANTHROPIC_API_KEY` and paste your key from Anthropic Console (never paste it into issues, PRs or code). This is separately billed from the Claude web subscription.
3. Settings → Rules → Rulesets (or Branch protection): require PRs for main; disallow direct pushes and force pushes; require appropriate CI checks and non-author review for security/RBAC/database changes.
4. Review and merge this workflow PR. **Do not merge before these checks.**
5. Create the `claude-build` issue label if you want label-driven execution.

## Triggering Claude
**From ChatGPT's SEEFIX PR reviewer:** only after deciding a tightly scoped issue is approved for automatic development, create/search a normal GitHub issue and post a *single* authenticated issue comment starting `@claude` from the trusted `erwin-io` account. Alternatively, as repo owner apply `claude-build` to an open issue authored by `erwin-io`. The `github.actor` and issue-author checks exclude arbitrary public contributors.

Use a comment like:

    @claude Implement this specific issue. Open a draft PR; do not merge or close issues.

Confirm runs at **Actions → SEEFIX Claude implementation**. Verify a **draft PR** is created and that the existing CI actually runs on its head commit. Creating an issue *without* the comment/label does **not** automatically start Claude.

## Review and loop
GitHub issue → trusted trigger → Claude bounded implementation → draft PR → CI + ChatGPT hourly review → human/branch-rule merge gate or review issue with concise acceptance fixes. Keep roles, SQL and AI human-decision boundaries under mandatory review. Set an Anthropic spend limit; runs are capped by 65-minute timeout and 35 turns, not by spend.

## Security/limitations
- The workflow uses official Claude Code Action pinned to the v1.0.248 commit and pinned checkout action. Update pins only after review.
- GitHub workflows need a GitHub/Anthropic credential and sufficient App permissions. A **connected Claude Code browser session alone is not enough**.
- The `id-token: write` permission is required for default Claude GitHub App authentication. Branch protection is essential because workflow permissions allow writes.
- GitHub-generated `GITHUB_TOKEN` events generally don't trigger follow-on workflows. This configuration uses Claude's GitHub App authentication rather than overriding `github_token`.
- No guarantee of automatic PR creation if Claude encounters build errors, tool denial or budget limits; inspect its run.
- No unattended merges for JWT, RBAC, privacy, SQL schema, business decisions, procurement, Agent safety, or infrastructure/secrets.
