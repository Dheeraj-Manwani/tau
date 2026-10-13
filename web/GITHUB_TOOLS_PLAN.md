# GitHub Tools tab implementation plan

## Phase 1 completed: integration discovery

Reviewed on 2026-10-12 against commit `f4d4785`. The approved design is the
**Tabbed workspace** variant: a repository header followed by Changes, Pull
requests, Issues, and Settings. This phase records the existing integration and
the implementation decisions for later phases. No runtime behavior is changed.

## Existing integration to reuse

### Account connection and permissions

- `src/features/auth/github.ts` provides account status, OAuth navigation,
  disconnect, and callback feedback. Connection is separate from signing into
  Tau. OAuth returns to the current project URL.
- `../server/src/api/services/github.service.ts` exchanges the authorization
  code, checks the GitHub user, and stores the token in `OAuthAccount` through
  `auth.repository.ts`. Tokens stay on the server. Invalid tokens are removed
  when GitHub returns 401. Disconnect deletes Tau's stored account link; it
  does not call GitHub's token-revocation API.
- `../server/src/lib/env.ts` defines optional `GITHUB_CLIENT_ID` and
  `GITHUB_CLIENT_SECRET`, a `GITHUB_REDIRECT_URI`, and `GITHUB_SCOPE`, defaulting
  to `repo`. These are configuration names, not a verification of live consent
  or deployed credentials.
- `githubProject.service.ts` checks project ownership before every existing
  project GitHub action. The project router is mounted behind authentication
  in `../server/src/api/index.ts`. The same checks must guard new endpoints.
- The integration does not expose granted OAuth scopes, repository write/admin
  permissions, or branch restrictions. Being connected currently means the
  token identifies a user, not that every action is available.

Reuse OAuth for the new tab. Do not introduce a second credential system.
Add server-derived capabilities before enabling write/admin actions in later
phases. Scope does not grant permissions the GitHub user lacks. The default
`repo` scope also does not cover all edits to GitHub Actions workflow files;
handle missing `workflow` scope when those files are included rather than
silently omitting them. See [GitHub OAuth scopes](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps).

### Existing API contracts

Account routes in `../server/src/api/routes/auth.routes.ts`:

- `GET /auth/github`: start consent using web navigation authentication.
- `GET /auth/github/callback`: complete consent and redirect to Tau.
- `GET /auth/github/status`: return `connected` and `username`.
- `DELETE /auth/github`: disconnect the account across projects.
- `POST /auth/github/prepare`: mobile handoff; reuse unchanged.

Project routes in `../server/src/api/routes/project.routes.ts`:

- `GET /project/:projectId/github`: connection, repository, last PR, up to ten
  open PR summaries, sequence-based change count, and saved push preference.
- `GET /project/:projectId/github/repos`: up to 100 owned repositories,
  sorted by update time. No pagination or collaborator/org discovery UI.
- `POST /project/:projectId/github/link`: accept `{ repo: "owner/name" }`;
  cache repository facts and reset previous push/PR bookkeeping. It verifies
  access to repository metadata, not write permission, and does not import files.
- `DELETE /project/:projectId/github/link`: clear the project's association
  and push/PR bookkeeping; leave the remote repository intact.
- `POST /project/:projectId/github/push`: accept optional `title`,
  `description`, and `mode` (`new_pr`, `update_pr`, `direct`). Return repository
  URL, optional PR URL, branch, mode, and summary.
- `PATCH /project/:projectId/github`: accept `private` and/or `pushMode`.
  Visibility is changed on GitHub; push preference is stored on the project.

`src/features/project/github.ts` already has React Query hooks for these
project routes. Reuse their cache keys and mutations. Its push hook currently
accepts title/mode only, although the server accepts description too.

### GitHub engine and agent reuse

`../server/src/api/lib/github.ts` is the shared engine for both API and worker
actions. It reads the stored `ProjectFile` manifest and blob contents, filters
secret paths and `.gitignore`, handles binary blobs as base64, and uses GitHub's
Git Data API. It works without a running sandbox.

- First push automatically creates a private, initialized repository named
  after the project, with suffix retries on name collisions.
- `new_pr` creates a `tau/*` branch and PR against the default branch.
- `update_pr` reuses `lastPushedBranch` and `lastPrNumber`; a missing branch
  causes a new one to be created. A closed PR can result in a fresh PR.
- `direct` commits to the repository's current default branch. It does not
  support arbitrary branch selection. Ref updates use `force: false`.
- `createGithubIssue` exists here and is used by the worker's
  `create_github_issue` tool. There is no project REST route or web hook for it.
- `src/features/project/useSendMessage.ts` is the existing route into an agent
  job. Reuse it for Fix with Tau, including busy/credit/error handling, and open
  chat only when the send is accepted. Fetch issue content before submitting the
  user's requested fix; do not imply an issue URL alone is automatically read.

Project storage already includes repository, default branch, visibility,
push preference, last pushed branch/sequence, and last PR URL/number. It has no
last-push timestamp or commit SHA. `ProjectFile` stores current content and
last sequence, not a complete historical manifest for the last push.

## Gaps that affect the approved design

1. **Accurate Changes and diffs (phase 3).** `unpushedChanges` is
   `headSequence - lastPushedSequence`, so repeated edits to one file inflate
   the count and reverted content can still appear changed. There are no
   per-file additions/deletions/patches. Add a server comparison against the
   intended remote target and return actual file counts. Lazy-load text diffs,
   show binary/large-file summaries, and apply the same exclusions as push.
   The server's existing `diff` dependency can generate patches.
2. **Preview/push agreement (phases 3–4).** The current tree creation omits
   `base_tree`; its commit contains exactly the filtered Tau files. Linking an
   existing repository can therefore remove remote files absent from Tau.
   Change the shared engine to preserve unmanaged remote files, track intended
   deletions explicitly, and make the diff preview describe the exact commit.
   Do not infer that every remote-only file was deleted by the user. Pin the
   remote target SHA and local sequence; reject/refresh when either changes.
   See [GitHub tree semantics](https://docs.github.com/en/rest/git/trees#create-a-tree).
3. **PR selection and compose (phase 4).** Updating a PR selected from the
   list needs an explicit PR target and validation of its repository, open
   state, head branch, and write access. The current engine only remembers the
   last pushed branch, and reusing an open PR does not update its title/body.
   Extend the schema/service/engine and web hook for description and draft
   creation. Keep direct mode labeled with the actual default branch; branch
   selection is additional backend work. GitHub supports a draft creation
   parameter: [PR API](https://docs.github.com/en/rest/pulls/pulls#create-a-pull-request).
4. **PR details (phases 3 and 5).** Current summaries have URL, number, title,
   state, and merged state only. Add author, updated time, head/base branches,
   draft status, body, and permission-aware update availability. Fetch review,
   check-run and commit-status data for details; show unavailable separately
   from pending. Paginate lists and avoid claiming the first ten are the total.
5. **Issues (phase 5).** Add authenticated owner-checked list/detail/create
   routes and hooks. Reuse `createGithubIssue` for creation. Filter items with
   `pull_request` out of issue lists and paginate after accounting for those
   entries: [GitHub issue API](https://docs.github.com/en/rest/issues/issues#list-repository-issues).
6. **Settings and metadata (phase 6).** Reuse visibility, push preference,
   linking, unlinking, and disconnect. Repository replacement resets push
   bookkeeping and does not synchronize project files; explain that in the
   chooser. Expand repository discovery with pagination and permitted
   organization/collaborator repositories. Add a real persisted successful
   push timestamp before displaying “last pushed” relative time.
7. **Errors and invalidation (phases 2–6).** `getGithubProjectInfo` catches
   repository/PR errors together and reports a null repository for non-401
   failures, including temporary/rate-limit failures. Separate unavailable,
   inaccessible, disconnected, and unlinked states. The existing popover shows
   loading indefinitely when the info request fails. Add retryable error UI.
   OAuth callback and account disconnect must invalidate all project GitHub
   caches, not just account status or the currently viewed project. Add new
   list/detail/diff cache invalidation after relevant mutations.
8. **OAuth redirect validation (before shipping the connection flow).**
   `github.controller.ts` currently validates `return_to` with a string prefix.
   Replace this with parsed URL origin comparison so a similarly prefixed
   foreign host cannot pass. Add a regression test; retain project query params
   for valid returns.

## Phase 2 integration decisions

- Add a `GithubPane` entry to Tools' Delivery group before Deploy, using
  `ToolPaneContent` (`max-w-4xl` with the existing shared padding).
- Extend `src/features/project/toolNavigation.ts` and its navigation tests for
  `tool=github` and a GitHub section parameter. Preserve Deploy and Storage
  parameters and legacy links according to their existing behavior.
- Keep the header GitHub shortcut, but make it navigate to the new Tools pane
  instead of maintaining a second full action UI in `GithubPanel.tsx`.
- Place OAuth return handling in a stable project-level component so it works
  for both the shortcut and direct links without duplicate feedback.
- Compose the repository header and four sections with existing Radix/Motion
  components, Tau theme tokens, and `GithubMark`. Retain keyboard navigation,
  focus restoration, responsive overflow handling, and reduced-motion support.
- Reuse real data where supported. Unsupported counts, diffs, review/check
  statuses, draft actions, and issues must have explicit unavailable states
  until their backend phase is complete; never display mock data as live.

## Verification and later acceptance checks

Phase 1 baseline command, run from `server/`:

`bun test test/api/github.test.ts test/api/githubHandoff.test.ts`

Result: **20 passed, 0 failed**. These tests cover push exclusions and OAuth
handoff/state behavior. They do not exercise live OAuth consent, repository
permissions, commits, PR creation, issue creation, or visibility changes.
No live GitHub mutation was performed during discovery. No dependencies or
database migrations were added.

Before completing later phases, add mocked regression coverage for owner
checks, insufficient permissions, upstream 401/403/404/rate limits, exact diff
counts, binary/large files, unmanaged-file preservation, deliberate deletion,
stale preview rejection, chosen-PR targeting, draft/description forwarding,
pagination, issue-versus-PR filtering, callback redirects, and cross-project
cache invalidation. Verify the four sections and dialogs in the browser at
desktop and mobile widths. Run web build/lint/tests and relevant server tests
and typecheck; run mobile parity when API contracts change.

## Phase 2 completed: GitHub workspace layout

- Added GitHub to Tools' Delivery navigation, with the same `ToolPaneContent`
  width and padding as the other tools. The header GitHub shortcut now opens
  this pane.
- Added URL-backed Changes, Pull requests, Issues, and Settings sections using
  Radix tabs. Section links, browser history, arrow-key navigation, and existing
  Deploy/Storage navigation are preserved.
- Repository and PR summaries use the existing project query. PR dialogs link
  to GitHub for details that Tau does not yet expose. Changes describe the
  sequence count as edits, without claiming it is a distinct file count.
- Added loading, disconnected, unlinked, empty, and retryable-error states.
  Connection changes are disabled when the current info query fails or is
  refreshing. Account connect/disconnect invalidates GitHub queries across
  projects. OAuth feedback now lives in the stable project panel and removes
  its result parameter through the router without losing section query params.
- Reused repository linking, unlinking, account disconnect, and push preference
  mutations. Repository selection and unlink/disconnect dialogs explain the
  effect and restore focus when cancelled. Visibility management links to
  GitHub until permission-aware controls are implemented.
- File diffs, pushes, repository creation, issue management, and detailed
  reviews/checks remain explicitly unavailable in the new workspace. It does
  not ship mock data or trigger the old whole-tree push engine. The agent's
  existing GitHub tools are unchanged.

Validation: web production build passed; all **254 web tests passed**; lint
passed for every changed/new TypeScript file. Full `pnpm lint` reports six
pre-existing errors and one warning in unchanged UI components and the preview
recovery fixture. Browser verification used the actual project shell with
mocked API responses, including linking, preference persistence, disconnect,
confirmation cancellation, keyboard focus, history, OAuth return, errors and
recovery, and loading/empty states. At 390px, all four labels fit and the page
has no horizontal overflow. No live OAuth consent or GitHub write was performed.

Phases 1–6 are complete.

## Phase 3 completed: file comparison and PR metadata

- Added authenticated, owner-checked `GET /project/:projectId/github/changes`
  and `GET /project/:projectId/github/diff` routes. Changes compare the current
  stored manifest with the intended target: the default branch for new PRs or
  direct commits, or the verified open, same-repository last Tau PR head for
  updates. A closed, missing, forked, or mismatched update target is rejected
  instead of silently choosing a different branch.
- Counts use Git blob hashes of actual file bytes, rather than edit sequences.
  Reverted content and unchanged executable files are omitted. Both endpoints
  apply the existing credential floor and root `.gitignore` exclusions.
- Repository-only regular files are preserved in this read-only overlay by
  default. Users can explicitly select up to 100 eligible paths for deletion
  **review**; these produce real deletion counts and patches. Nothing is removed
  locally or remotely, and selections are not saved as project deletion state.
- Lazy text diffs return unified patches and line counts. The Changes UI provides
  expandable file rows, added/modified/deleted counts, filtering, target
  selection, refresh/retry, empty states, and binary/large-file summaries.
  Diff columns scroll inside the panel at mobile widths. Deletion selection
  retains keyboard focus while comparison data refreshes.
- Comparisons issue an owner/project-bound, signed 15-minute preview containing
  the repository, target branch/commit/tree, local sequence, manifest fingerprint,
  and explicit deletion selection. Diff reads reject modified local content,
  changed associations, changed remote targets, expired/tampered previews, and
  excluded/unchanged paths. Local files changing during a request also cause a
  refresh error. No process-local preview cache is required across server instances.
- Comparison is limited to 5,000 local/repository files. Truncated GitHub trees
  and path collisions with directories, symlinks, or submodules fail explicitly
  instead of returning partial counts. Inline text diffs are bounded at 200 KB
  per input, 400 KB per patch, and a one-second diff calculation; larger changes
  show summaries without pretending to have zero line changes.
- Extended real PR summaries with author, update time, head/base branches,
  draft status, and description. PR dialogs show these fields; detailed review
  and check data remains phase 5 work.
- GitHub reads now distinguish missing access, revoked credentials, rate limits,
  and temporary failures. A failed repository or PR read no longer appears as
  a successful unlinked state, and temporary `/user` failures no longer delete
  the connection. Shared authenticated requests have a bounded timeout.
- Project edits, asset imports, connection changes, and workspace refresh
  invalidate file review queries. Agent file events also change the comparison
  key through the store's local sequence. A different repository, target, or
  local version never inherits the previous diff as placeholder data.

**Phase 4 prerequisite:** the existing API/agent push engine still builds a
whole replacement tree. The new workspace keeps Push disabled. Before enabling
it, make the shared engine consume the reviewed overlay, set `base_tree`, preserve
remote-only files and executable modes, apply only explicit deletions, and reject
stale previews at commit/ref update time. Also implement compose, draft creation,
explicit selected-PR targeting, and permission checks. Phase 3's preview is a
read-only review contract, not a claim that the legacy push endpoint now uses it.

GitHub API behavior was checked against the official
[tree API](https://docs.github.com/en/rest/git/trees#get-a-tree),
[blob API](https://docs.github.com/en/rest/git/blobs#get-a-blob), and
[pull request API](https://docs.github.com/en/rest/pulls/pulls#get-a-pull-request).
No dependencies or migrations were added, and no live GitHub write was performed.

Validation: server typecheck passed; all 16 isolated comparison/controller
regressions and the 20 existing GitHub filtering/OAuth tests passed. Web build
and all 255 tests passed, and lint passed for the changed TypeScript files.
Root drift checks passed. Mobile wire-type parity passed; its informational
route census reports these two new web-only routes among existing unaccounted
routes. Desktop/mobile browser verification covered lazy diffs, text/binary/large
summaries, filtering, explicit deletion review without writes, focus retention,
target changes, local-version refresh, stale/error recovery, loading/empty
states, and PR metadata/focus restoration. The page and four section labels
fit at 390px with no horizontal page overflow. The browser console had no errors.


## Phase 4 completed: reviewed pushes and PR compose

- Enabled Push changes with a compose dialog for a new PR, a selected open PR,
  or a direct commit to the actual default branch. New PRs support descriptions
  and draft creation; updates prefill and save the selected PR's title/body.
  PR list actions deep-link to Changes with the selected number. Permission-aware
  selectors hide updates for closed, merged, forked and default-head PRs.
- Comparison previews now pin the explicit PR number and base branch. Server
  validation binds the request's mode/PR to the signed review, validates its
  expiry and owner, and rechecks the manifest/sequence, repository association,
  PR state/head/base and GitHub write access before staging and publication.
- Replaced the shared API/worker whole-tree engine with one reviewed overlay.
  Trees use `base_tree`; unchanged and unmanaged files, symlinks/submodules, and
  executable file modes survive. Every changed file is uploaded from verified
  raw bytes as base64, including unknown binary extensions and UTF-8 BOMs.
  Only eligible explicit deletions from the signed preview remove remote files.
- Ref publication uses GitHub GraphQL `updateRefs` with `beforeOid` and
  `force: false`. This atomically rejects unexpected target SHAs, including a
  rollback to an ancestor. New branches also atomically guard the reviewed base.
  Local checks immediately precede publication; edits arriving after that
  dispatch remain local, and bookkeeping records only the reviewed sequence.
- New-PR reviews use a stable branch suffix so replaying a lost response does
  not create another commit/PR. A lost ref response is checked against the
  resulting head. PR or tracking failures after publication return the commit
  link and actionable partial-success guidance rather than total failure.
  Pending controls prevent duplicate submissions and dialog dismissal; rejected
  pushes keep the composed text visible and require refreshed review to retry.
- Worker/mobile calls without a preview generate a fresh comparison and use
  this same overlay engine. Existing agent repository creation remains supported.
  No dependencies or migrations were added and no live GitHub writes were made.

The ref guard follows the official [GraphQL Git reference](https://docs.github.com/en/graphql/reference/git#updaterefs).
Backend tests cover overlay preservation/deletion, raw bytes/modes, selected PR
and draft forwarding, owner/session checks, invalid/expired/stale reviews,
read-only access, local and remote races, branch rules, response-loss recovery,
partial results, replay and worker reuse. Web tests cover selected-PR navigation.
Browser verification covered compose/new/update/direct modes, explicit deletion
recap, cancellation focus, stale errors preserving text, partial-success links,
and pending dismissal protection. At 390px, the dialog fits without horizontal
page overflow. Web build, 256 tests, targeted lint, server typecheck/regressions,
root drift and mobile wire parity passed. The route census's existing informational
unaccounted routes remain unchanged. GitHub review/check details and issue
management are phase 5; broader repository/settings capabilities are phase 6.

## Phase 5 completed: pull request details and issue workflows

- Added owner-checked, repository-bound list/detail routes for pull requests and
  issues, plus issue creation. Lists are ordered by latest activity, with open,
  closed and all filters and Link-header pagination. Issue pages omit PR entries;
  a page containing only PRs still offers Next when GitHub has another page.
- PR details load on demand and show the description, branches, commit SHA,
  file/commit counts, additions/deletions, review history, check runs and commit
  statuses. Checks/statuses refer to the fetched head SHA; another PR read rejects
  a moving head. Earlier-commit reviews are labeled. Unavailable access or upstream
  failures are shown separately from pending checks, without claiming merge readiness.
  Detail sections show up to 100 results and link to GitHub when more are available.
- Issue details fetch the real description, state, labels, assignees and comment
  count. New issue supports title/description, pending protection, a success link
  and query invalidation. Failures preserve the draft, restore title focus and block
  resubmission until the user checks GitHub and reopens the composer. Archived or
  issue-disabled repositories cannot create issues. Read access can create an issue;
  GitHub can still reject a write for permissions or interaction limits.
- The worker's existing create_github_issue action and the new API share the same
  creation engine. Both recheck project ownership, repository association and
  connection, and distinguish revoked tokens, access failures, rate limits and
  uncertain write outcomes.
- Fix with Tau uses the existing message/job flow, including billing, busy-state
  checks and rollback on rejection. It sends the fetched issue title, URL and
  description; descriptions above 8,000 characters have an explicit truncation
  notice. Chat opens and the dialog closes only after the server accepts the job.
  Closed issues, unavailable details and busy projects cannot start a fix.
- Selected PRs outside the initial ten-summary response fetch their own metadata
  before compose, preserving title/body. A changed PR head requires refreshing
  both the metadata and file comparison before pushing.

API behavior follows the official [issue creation API](https://docs.github.com/en/rest/issues/issues#create-an-issue),
[PR review API](https://docs.github.com/en/rest/pulls/reviews#list-reviews-for-a-pull-request),
[check runs API](https://docs.github.com/en/rest/checks/runs#list-check-runs-for-a-git-reference)
and [combined status API](https://docs.github.com/en/rest/commits/statuses#get-the-combined-status-for-a-specific-reference).

Validation: 16 new isolated collaboration regressions and existing GitHub
comparison/push/filtering/OAuth tests passed. All 258 web tests passed; web build,
targeted lint, server typecheck and root drift checks passed. Mobile wire parity
passed; its informational route census lists the five new web-only routes among
unaccounted routes. Browser verification used mocked APIs in the actual project
shell and covered pagination, PR-only issue pages, lazy details, checks with missing
access, selected PRs beyond the initial summary list, issue creation success/failure,
closed issues, Fix with Tau acceptance/pending/rejection and focus restoration.
At 390px, all four labels and issue/PR dialogs fit without horizontal overflow.
No dependencies or migrations were added, and no live GitHub writes were made.

## Phase 6 completed: repository discovery, settings and saved push metadata

- The repository picker now uses paginated discovery with owned, collaborator,
  organization-member and all-access filters, ordered by latest activity. Each
  page has up to 30 repositories; text search is explicitly a filter of that page.
  Access labels distinguish read, write, admin and archived repositories. Linking
  read-access repositories is supported, with pushing still requiring write access.
  Missing organization repositories include approval/SSO guidance. No additional
  OAuth scope is requested by the picker.
- Settings expose admin-verified visibility changes with an explicit repository
  name confirmation, consequence guidance and the official GitHub effects link.
  Archived repositories, forks, internal repositories and accounts without admin
  access have disabled controls with reasons. GitHub organization policy can still
  reject an otherwise eligible change. Pending writes block dismissal and repeated
  submission; failures keep the confirmation and require refreshed GitHub state.
- Visibility writes recheck ownership, repository association and current admin
  capability before the GitHub call. Conditional database updates cannot overwrite
  a newer repository link. Repository fact refreshes are similarly bound; stale
  reads no longer restore an old association. Link/unlink operations reset tracking
  only when appropriate, while a same-repository link preserves it. Push preference
  remains independent of GitHub admin access; mixed preference/visibility writes
  are rejected to avoid partially applying two settings.
- Added nullable lastPushedAt and lastPushedCommitSha columns and regenerated the
  Prisma client. Confirmed ref publication records time, commit and reviewed branch,
  including committed partial success when the PR step fails. Unknown publication
  results and rejected pushes do not record success. Replaying a tracked new-PR
  review preserves its original timestamp. Settings show the saved timestamp and
  commit link; older pushes remain unknown, without fabricated backfilled dates.
  Changing/unlinking repositories clears the saved metadata.
- Archived repositories disable pushes in previews and are rejected again by the
  publication engine. Header/settings access and internal visibility labels use real
  repository metadata. Existing unlink/disconnect/preference workflows and query
  invalidation remain in place, with repository-change focus restoration verified.
- Closed the OAuth redirect prerequisite: URL parsing now compares exact origins,
  rejects credentials and unexpected schemes/ports, and preserves valid project
  paths/query parameters. Both consent start and callback use this validation.

Discovery and visibility behavior follow the official
[repository API](https://docs.github.com/en/rest/repos/repos?apiVersion=2022-11-28)
and [visibility effects](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility).

Validation: 12 isolated settings regressions passed alongside comparison,
collaboration and push regressions (including archived publication and saved
timestamp/replay assertions), and OAuth redirect tests. All 258 web tests, web
build, targeted lint, server typecheck, root drift and mobile wire parity passed.
Browser verification covered capability restrictions, visibility confirmation and
success/error/pending states, affiliation filters, repository pagination, read-access
linking, tracking reset and keyboard focus. The picker and visibility dialog fit at
390px with no horizontal page overflow. All GitHub mutations were mocked.

Migration 20261013040000_github_push_metadata was applied successfully to the local
Postgres database. Deployments must apply this migration before running the new
server. No dependency was added, no live GitHub writes were made, and no commits
were created by the agent. Repository creation continues through the existing agent
push tool; a standalone creation form and additional PR/issue mutations are outside
this six-phase scope.
