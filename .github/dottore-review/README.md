# Dottore

Dottore reviews pull requests from GitHub Actions. On request he builds a bundle of the change, has a small model read
the code around it, a large model claim defects and check each claim against the code, and posts a walkthrough, a
review thread per confirmed defect and the **Dottore Review** commit status. When asked, he repairs his own findings,
and he approves a head he found viable once its checks pass. Everything a maintainer sets lives in repository
settings (**Settings → Secrets and variables → Actions**) and in `rules.json`; the code names no model and no provider.

## Files

| File | What it is |
| --- | --- |
| `dottore_review.py` | The reviewer: bundle building, the three roles, rendering, posting, thread resolution, the repair request, approval and the commit status. One file, no package. |
| `reviewer-prompt.md` | The prompts: one `## ` section per role, plus the voice, output and verdict shapes they share. It names no model. |
| `rules.json` | This repository's review policy, read from the pull request's **base** branch, never its head (see Rules). |
| `requirements.txt` | The two SDKs the reviewer imports, `openai` and `anthropic`. |
| `chibi/` | Dottore's chibis, a few poses per verdict and three for the command status window, served raw from the tooling checkout the workflow pinned. |
| `../workflows/dottore-review.yml` | The trusted review workflow: `workflow_dispatch` here, `workflow_call` for another repository. Jobs: examination, repair check (resolves repaired threads), discharge (approval), repair and repair push. |
| `../workflows/dottore-review-command.yml` | Dispatcher for `/dottore` comments and the autofix tick box (`issue_comment`). |
| `../workflows/dottore-review-auto.yml` | Dispatcher for pull request events (`pull_request_target`): Dottore's own repair pushes, and every event when `DOTTORE_AUTO_REVIEW` is `true`. |
| `../workflows/dottore-review-approve.yml` | Dispatcher that re-tries the approval when a listed check workflow finishes on a discharged head. |

The dispatchers read the event and call `gh workflow run` on the trusted workflow at the pull request's base ref; they
check out and run no pull request code. The review job checks out the reviewer from the commit of the workflow file
itself (`job.workflow_sha`), reads `rules.json` from the base branch, and fetches the head without executing it.

## Asking for a review

Reviews start on request. A repository owner, organisation member or collaborator comments on the pull request:

| Comment | What happens |
| --- | --- |
| `/dottore` | Reviews what changed since Dottore's last review of the pull request, or everything when there was none. |
| `/dottore full` | Reviews the whole pull request again. |
| `/dottore autofix` | Repairs the open findings once (see Autofix). |
| `/dottore approve` | Checks whether the head can be approved and replies with what is still missing (see Approval). |

The command gets a progress window on the pull request, which the review turns into "Concluded" when it posts. A
review can also be started from **Actions → Dottore Review → Run workflow** with the pull request number and a mode.
With `DOTTORE_AUTO_REVIEW` set to `true`, a pull request is also reviewed when it opens, is marked ready for review or
gets a push; a draft waits until it is ready. Only pull requests into the branches `DOTTORE_BASE_REFS` names are
reviewed; a request on another gets a reply saying so. To keep Dottore strictly on request, disable the
**Dottore Review Auto Dispatch** workflow under Actions: a repair Dottore pushes then also waits for the next `/dottore`.

A review posts:

- **The walkthrough**, one comment per pull request, updated in place: the verdict in its title, Dottore beside it, the
  counts, the change summary, the defects table, the notes, the autofix box, his observations and lab notes, and, folded
  at the end, a repair prompt for an agent of your own. The last reviewed head and the open repair contracts ride in
  HTML comments inside it, so the next review knows where it left off.
- **A review thread per confirmed defect**, at its line, with a suggested fix and a footer naming the two ways it gets
  resolved: a push Dottore re-examines, or the autofix box.
- **The `Dottore Review` commit status**: success once the review is posted, whatever it found, with the verdict and
  the counts in its text; failure only when the review did not run or did not finish.

The verdicts: **Viable** (nothing found) and **Viable, With Notes** (nitpicks only) discharge the head; **Repair
Required** (defects open) and **Specimen Unstable** (a high or blocking defect, or a failed control) hold it; **Specimen
Unexamined** means the review did not finish, so nothing is reported as found. A head with no new diff since the last
examination (a base merge, a repeated `/dottore`) keeps that examination's walkthrough and verdict, recorded for the
new head; `/dottore full` examines it afresh.

## How a review runs

Code first builds a bundle for each packet of the pull request: the PR description, the changed code at the head with
its changes marked and the code around it, the definitions it reads, the same-file functions it calls two hops deep,
where changed names are used elsewhere, the path rules and a guidance index. Then three roles run on two models (see
Models): the small model reads, the large one judges.

- **`scout`** reads outward from the bundle with the read-only tools and keeps places as it reads: the callers in other
  files, imported definitions and what the changed values flow into. Each packet's changed functions are split into
  shares, one scout per share, and the scouts run at once, so the reading takes one scout's time. Code quotes the places
  into the bundle. A scout names no defect. A failed scout is noted and its share keeps the code-built bundle.
- **`finder`** makes one call with no tools on the bundle and claims defects at changed lines.
- **`verify`** (the checker) judges the finder's claims, one call per file, with the bundle and the code around each
  candidate in view and a few reads for what is still out of reach. Only confirmed findings are published; a confirmed
  claim whose defect differs from its wording carries the finding text the checker wrote.

What gets published depends on kind, not severity. Every finding is a defect, low included: each gets a review thread,
as a CodeRabbit finding does, and any of them makes the verdict Repair Required (Specimen Unstable from high up), so a
low finding is carried across reviews, repaired by autofix and resolved before merge like any other. Severity grades the
size of the repair. Nitpicks are notes: they are listed under Minor Imperfections, at most two, get no thread, and leave
the verdict Viable, With Notes. The walkthrough states the verdict once in its title, with a remark in his voice and
one of his chibis beside the verdict box and the counts (`chibi/`, a few poses per verdict, both chosen by the head SHA
and served raw from the pinned tooling checkout; the command status window has poses of its own, so the two comments
never show the same one); the commit status carries the same verdict with the counts. The repair
contracts of the defects are repeated at the end of the walkthrough as a prompt for an agent of your own, for a pull
request Dottore cannot push to.

On a later review, the checker also re-judges Dottore's open threads on the files that review changed, in parallel
with the finder: one call per packet, with each thread's finding and repair contract. A thread it finds repaired, with
evidence quoted from the head, gets a reply in voice and is resolved; one a person has replied to, or one whose finding
that review raised again, stays open. Threads on files the review left alone are not checked.
GitHub refuses to resolve a thread without `contents: write`, so a separate `resolve` job does it with that
permission; it checks out no code and holds no model key, and runs only when a review found a repair. A repository that
calls the shared workflow, such as Marinara-Agents, must grant `contents: write` in its caller too.

The finder and checker send the bundle about once each, so a review's cost is the bundle's size times the models'
prices. A role given reads resends its whole conversation on every turn, so reads belong to the cheapest role that can
use them: the scout. Each `Dottore telemetry:` line reports per role the dollars spent and `prompt_x_bundle`, the prompt
tokens sent per bundle token; a one-call role sits near 1, and a number far above it means a role is reading.

Each role has one prompt section in `reviewer-prompt.md`, which names no model, so either model can come from any
provider. A new setting applies from the next review. In Marinara-Agents, set them in the Agents repository: its
wrapper workflow passes its own secrets and variables to the shared review.

## Autofix

Dottore repairs its open findings only on a pull request where someone asked: by ticking **Let Dottore fix the open
findings on this PR** in the walkthrough, or by commenting `/dottore autofix` once. Both count only from someone with
write access; a read or triage collaborator's request is ignored. While the box is ticked, each review that leaves findings open is followed by a repair; after
three Dottore repairs in a row with no push from a person, it stops and says so (`MAX_AUTOFIX_ROUNDS` in
`dottore_review.py`). The repair is reviewed again by the auto dispatcher; with that workflow disabled, the next
review waits for a `/dottore` comment, so each repair is one `/dottore` away. Repairs go to the pull request's own
branch, so a pull request from a fork gets the repair prompt at the end of the walkthrough instead. The pushed commit
names the findings it repairs, carries the runner's own account of the change, and ends with a `Dottore-Autofix`
trailer that counts the rounds.

A repair runs in two jobs after the review job:

- **`fix`** checks out the head, gives the open threads to Claude Code (`claude -p`) with only file tools (read, edit,
  write, search; no shell) on the small model (see Models), and no GitHub write token. A patch containing the small
  model's key is discarded. Then, without the key, it runs `autofix.validate` from the base branch's `rules.json`, such as
  `pnpm install --frozen-lockfile && pnpm check`.
- **`push`** commits a patch that passed, with a `Dottore-Autofix:` trailer, and pushes it with the Dottore GitHub
  App's token, because a push made with `GITHUB_TOKEN` starts no CI and no review. That push starts the next review,
  whose repair check resolves the threads the code confirms. A patch that changed nothing, failed the checks, met a
  branch that moved meanwhile, or was rejected by the push (one editing a workflow file, which the App's token cannot
  push, so the repair is told not to) is reported in a comment instead.

The App needs **Contents: Read and write** on the repository, installed there, with its ID and private key in the
`DOTTORE_APP_ID` and `DOTTORE_APP_PRIVATE_KEY` secrets. A calling workflow passes both.

## Approval

Dottore approves a pull request's head, as a signal only, when all of these hold:

- its examination of that head ended **Viable** or **Viable, With Notes**;
- none of its threads are unresolved, including ones a person answered;
- every check the base branch's rulesets require has passed, or, where they require none, every check on the head.

The approval is tried when a review ends, when a workflow named in `dottore-review-approve.yml` finishes (by default
Pull Request Checks, CodeQL and the Owner Approval Review Evaluator), and when someone comments `/dottore approve`; that
comment gets a reply naming what is still missing. When a new head arrives, the next review or approval check dismisses
Dottore's approval of the earlier one. No ruleset counts the approval: they require none, and the owner-approval check
counts only the owner's.

GitHub accepts it only when the repository allows it, under **Settings → Actions → General → Workflow permissions →
Allow GitHub Actions to create and approve pull requests**. Without that, the approval step logs a warning and the review
is unaffected. A repository that calls the shared workflow keeps its own copy of `dottore-review-approve.yml`, listing
the workflows that report its required checks.

## Models

Dottore runs on two models. The **small** model runs the scouts, which read, and the repairs. The **large** model runs
the finder and the checker, which judge: each makes about one call per bundle, so its price is paid about once, while
the scouts read turn after turn, which suits a small, fast model at a high effort.

Each model has the same five settings. The key is a secret; the rest are variables, and the run log shows them.

| Setting | Kind | What it sets | Default |
| --- | --- | --- | --- |
| `DOTTORE_SMALL_MODEL`, `DOTTORE_LARGE_MODEL` | Variable | The model's name at its provider | Required |
| `DOTTORE_SMALL_API_KEY`, `DOTTORE_LARGE_API_KEY` | Secret | The provider's API key | Required |
| `DOTTORE_SMALL_BASE_URL`, `DOTTORE_LARGE_BASE_URL` | Variable | The provider's endpoint | OpenAI's or Anthropic's own |
| `DOTTORE_SMALL_API`, `DOTTORE_LARGE_API` | Variable | `openai` for an OpenAI-compatible Chat Completions endpoint, `anthropic` for Claude's Messages format, `responses` for OpenAI's Responses format | `openai` |
| `DOTTORE_SMALL_EFFORT`, `DOTTORE_LARGE_EFFORT` | Variable | Reasoning effort, such as `medium`, `high` or `xhigh` | The model's default |

The values the fork trial ran, Claude Haiku 5.5 reading and GPT Astra judging, both through LinkAPI:

| Setting | `DOTTORE_SMALL_*` | `DOTTORE_LARGE_*` |
| --- | --- | --- |
| `MODEL` | `claude-haiku-5-5` | `gpt-6-astra` |
| `API` | `anthropic` | `openai` |
| `BASE_URL` | `https://linkapi.ai` | `https://linkapi.ai/v1` |
| `API_KEY` | a LinkAPI key whose group serves Claude | a LinkAPI key whose group serves GPT |
| `EFFORT` | `high` | `xhigh` |

Two models from one provider in the same API format share a key and a base URL; through a gateway, as above, the
Claude model takes the bare host and each key serves its own model group. A review missing a model's name or key is
posted as Review Skipped, naming the missing setting. The `Dottore roles:` line at the start of each run
log shows the model, API and effort each role resolved to.

### Switching a model

Most providers and gateways offer an OpenAI-compatible endpoint, so switching a model takes its name, its base URL (the
one the provider's docs give for the OpenAI SDK) and its key, with `API` left at `openai`. For example, DeepSeek as the
small model and GLM as the large one, both through LinkAPI:

| Setting | `DOTTORE_SMALL_*` | `DOTTORE_LARGE_*` |
| --- | --- | --- |
| `MODEL` | `deepseek-v4-flash` | `glm-5.3` |
| `API` | `openai` | `openai` |
| `BASE_URL` | `https://linkapi.ai/v1` | `https://linkapi.ai/v1` |
| `API_KEY` | a key whose group serves DeepSeek | a key whose group serves GLM |
| `EFFORT` | empty | empty |

Use `anthropic` for Claude models, even through a gateway that also offers Chat Completions: Claude's tool calls only
work reliably in its own format, and prompt caching and effort work only there. For `anthropic`, give a gateway's base
URL without `/v1`, such as `https://linkapi.ai`.

Use `responses` when the provider serves the model only on `/v1/responses`, or takes tool calls with reasoning only
there. It takes the same base URL as `openai`, ending in `/v1`, and the same key. Calls stay stateless: nothing is stored
at the provider, and each turn's encrypted reasoning goes back with the next.

Effort passes through unchanged, as `reasoning_effort` in the OpenAI format, `reasoning.effort` in the Responses format
and Claude's `effort`, so use a value the model accepts, or leave it empty for a model that takes none. Starting
values, to be measured on a few known pull requests before relying on them:

| Model | As the large model | As the small model |
| --- | --- | --- |
| GPT (Astra, Sol) | `xhigh` | `medium` |
| Claude Opus or Sonnet | `high` | `medium` |
| Claude Haiku or GPT Luna | not recommended: small models browse without forming claims | `high` |

The cost limit counts tokens at the price table in `dottore_review.py` (`MODEL_PRICES_USD`). A model it does not list
counts at the dearest listed rates, so a review on it reports more than it spent and reaches `DOTTORE_COST_LIMIT_USD`
early: add the model's prices to the table, or raise the limit. Before relying on a different model, run a few reviews
on pull requests whose problems you already know and compare what Dottore finds.

Repairs run Claude Code on the small model's settings, its effort included, so they need `DOTTORE_SMALL_API` set to
`anthropic`: Claude itself, or a provider's Anthropic-compatible endpoint. With any other value, ticking the autofix box
gets a reply saying so.

## Variables

These are all of Dottore's repository variables, beside the model settings above. Unset, each takes its default.

| Variable | What it sets | Default | Read by |
| --- | --- | --- | --- |
| `DOTTORE_AUTO_REVIEW` | `true` reviews a pull request when it opens, is marked ready for review or gets a push (drafts wait until ready). Otherwise a review starts only on request; a repair Dottore pushes is still reviewed | off | the auto dispatcher |
| `DOTTORE_BASE_REFS` | Comma-separated base branches whose pull requests get reviewed | `refactor,main,staging` | every dispatcher and the review job |
| `DOTTORE_COST_LIMIT_USD` | Stop a review's model calls once it has spent this many dollars at the price table in `dottore_review.py`; `0` removes the limit | `1.00` | the review job |
| `DOTTORE_CONCURRENCY` | Model calls run at once, up to 16 | `4` | the review job |
| `DOTTORE_FINDERS` | Finder copies per packet, `1` or `2`; a second one starts a few seconds later and reuses the cache | `1` | the review job |

Everything else the reviewer reads from its environment, the workflow sets itself: the pull request number, head and
base, the mode, the paths of the prompt and rules it copied out of the pinned checkout, and that checkout's repository
and commit, from which the chibis are served.

## Secrets

| Secret | Used for |
| --- | --- |
| `DOTTORE_SMALL_API_KEY`, `DOTTORE_LARGE_API_KEY` | The two models' keys (see Models) |
| `DOTTORE_APP_ID`, `DOTTORE_APP_PRIVATE_KEY` | The Dottore GitHub App that pushes repairs (see Autofix) |

## Rules

`rules.json` is the repository's own review policy. The review job reads it from the pull request's base branch, so a
pull request cannot change the rules that examine it, and a repository that calls the shared workflow keeps its own.

| Key | What it does |
| --- | --- |
| `exclude_paths` | Glob patterns (`fnmatch`) of changed paths the review leaves out: they are listed as excluded in the bundle, and the tools neither read nor search them. |
| `review_focus` | The areas the finder and checker are told to weigh, sent with the path rules. |
| `severity_policy` | What each grade means, `blocking` to `nitpick`, sent to the models with the path rules. The prompt sets the same scale; keep the two in step. |
| `repo_concerns` | Repository-wide rules that count as defects wherever a change touches them. |
| `path_instructions` | A list of rules, each with a `name`, the path `prefixes` it applies to, the `guidance` documents whose headings go into the bundle's guidance index when a changed file matches, and the `checks` the models judge matching files against. `AGENTS.md` is always in the index. |
| `autofix.validate` | The shell command the repair job runs on a patch before it is pushed, with a 25-minute limit; empty runs none. |

## Role limits

Each role's limits are kept in code, in `ROLE_DEFAULTS` in `dottore_review.py`:

| Limit | Meaning | `scout` | `finder` | `verify` |
| --- | --- | --- | --- | --- |
| `reads` | Read-tool calls; `0` offers none | `10` per scout | `0` | `5`, plus 1 per extra candidate |
| `chars` | Characters of tool output | `40000` per scout | `0` | `40000`, plus 4000 per extra candidate |
| `minutes` | Time box, from the role's first call | `5` | `10` | the review's last 8 minutes |
| `max_tokens` | Output cap per call, Claude models only | `16000` | `32000` | `32000` |
| `places` | Places each scout keeps; `0` turns the scouts off | `6` | – | – |
| `scouts` | Scouts per packet, each with a share of its changes; a PR split into packets runs more scouts than `DOTTORE_CONCURRENCY` in turn | `4` | – | – |

A role's `minutes` also bounds each of its model calls: a role offered no tools thinks before its first byte, so its
call may stay silent for the whole box, and a reply still streaming when the box ends is cut there. A role offered no
tools whose reply runs into `max_tokens` is sent once more at the next lower effort (`max` → `xhigh` → `high` →
`medium` → `low`) with a box of its own; at `low`, or with no effort set, the review fails instead. On Claude, thinking
counts inside `max_tokens`, so a larger or slower Claude model may need a larger cap.

Other limits in `dottore_review.py`: a 30-minute review (`REVIEW_DEADLINE_SECONDS`), the last 8 minutes of it
reserved for the checker, at most 20 candidates checked per review (`MAX_VERIFIED_CANDIDATES`), 3 submit attempts,
a role aborting after 3 failed calls in a row (`MAX_ROLE_FAILURES`), 180 s for a call's first byte and 360 s between
bytes (`FIRST_CALL_TIMEOUT`, `MODEL_REQUEST_TIMEOUT`), 900 s per streaming reply of a role with tools
(`MODEL_STREAM_LIMIT`; a role without tools gets its box instead), at most 2 notes and 2 open questions per review
(`MAX_NITPICKS`, `MAX_OPEN_QUESTIONS`), and the packet split for large PRs (`MAX_CHUNK_PATCH_CHARS`,
`MAX_REVIEW_CHUNKS`).

## Reading the run log

Each review logs a `Dottore roles:` line with the model, API and effort each role resolved to; a `Dottore review base:`
line when an incremental review merged the base branch into its diff base; a `Dottore call:` line per model call with
its tokens, cache use, time and the dollars spent so far; a `Dottore scout:` line per scout and per packet with the
places they added; and a `Dottore telemetry:` line with totals by role. The repair job logs an `Autofix:` line with
Claude Code's turns, time and list price. Use them to compare cost, caching and time between setups.

## Using Dottore from another repository

Marinara-Agents runs the same reviewer through a wrapper workflow that calls this repository's
`dottore-review.yml` pinned by commit SHA (`uses: Pasta-Devs/Marinara-Engine/.github/workflows/dottore-review.yml@<sha>`),
passes the same inputs, and passes its own four secrets. Moving to a newer reviewer is a one-line bump of that SHA.
The calling repository also keeps:

- byte copies of the three dispatcher workflows, with its own workflow list in `dottore-review-approve.yml`;
- its own `.github/dottore-review/rules.json`, read from its base branch;
- its own model variables and secrets, the Dottore App installed there, and `contents: write` granted in the wrapper
  for the repair check.
