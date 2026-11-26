# what.

**A little news. A little perspective.** what. turns current reporting into a short, interactive pause: meet a story, choose a response, hear from people who chose another side, and move on.

## How it works

The landing page centers a gently rotating illustrated Earth in a yellow-to-mint landscape. It starts with no news bubbles; short story questions emerge one at a time at randomized safe positions, stay for roughly 7–12 seconds, then fade independently. Up to six desktop or four mobile bubbles remain visible, and hovering or focusing a bubble pauses its dismissal. Tap the Earth for a random unseen story or a bubble for that exact question. A compact question card slides up over the still-visible globe with two square opinion choices, context and sources, Skip/Next, and close. Supporting and opposing perspectives arrive around it gradually, in balanced green and coral voices, before voting and remain available afterward. Readers may change their saved choice at any time.

Saved stories are shared across readers. Votes, comments, replies, and proposed opinion pairs use persistent DeepSpace records. No story, vote, comment, username, or engagement fixture is seeded for the interface.

## Architecture

- **Frontend:** React 19, React Router, Vite, Tailwind CSS 4 and the existing UI primitives. `src/styles.css` and `src/themes.css` define the nature-inspired cream, mint, leaf-green and ocean palette.
- **Worker:** `worker.ts` assembles the existing DeepSpace Worker routes, including authenticated actions and the integration proxy.
- **Storage and live records:** `RecordProvider`/`RecordScope` and DeepSpace `RecordRoom` share `stories`, `votes`, `comments`, `opinion_proposals` and `news_refresh_locks`. Existing schemas keep story reads public, votes private to their owner, and comments readable as actual conversation.
- **Authentication and roles:** DeepSpace auth supplies the caller identity. Server actions derive identity from the verified action context. News refresh additionally resolves the caller's app role and only proceeds for an administrator. `/team` uses DeepSpace's existing role-management UI.
- **Direct story links:** `/home?story=<record-id>` remains available. The primary globe experience uses `/?story=<record-id>` so stories open in the modal without leaving the landing page.

## News pipeline and quality checks

Admins use the dedicated `/news-admin` page. A default five-candidate refresh is available there, and the optional 20-candidate batch asks for confirmation. Each run checks top headlines in the US, UK, India, Australia, and South Africa (five NewsAPI requests), then makes up to five or 20 Exa searches and up to two or five OpenAI validation calls in four-candidate groups. Both use a persistent refresh lock and the existing eight-minute cooldown.

1. `newsapi/top-headlines` fetches up to 100 headlines for each of five regional markets. Candidates are interleaved across markets so the US feed does not consume the whole batch. Saved hashes, canonical source URLs and similar event headlines are checked before research.
2. Trusted publisher domains are screened before requesting `exa/search` for additional reporting. Queries combine headline entities, distinct details from the NewsAPI description, and the publication date; Exa returns up to eight bounded-text results per candidate. HTTPS/mobile/AMP variants are normalized, and canonical URLs, publisher identities and near-identical reporting are deduplicated.
3. A candidate is eligible only when it has at least two sufficiently long articles from independent trusted publisher domains. Three sources are preferred where Exa returns them. If reporting is too thin or unrelated, the candidate is skipped.
4. `openai/chat-completion` receives groups of up to four source-ready candidates as untrusted evidence. A five-candidate refresh uses at most two OpenAI calls; a 20-candidate refresh at most five. Its content instructions require a concrete, self-contained question in everyday language and two directly opposing answers that fairly address that question. Unfamiliar people must be identified by role or omitted; abstract wording and unexplained technical terms are discouraged. These are generation instructions, not stylistic rejection rules. Perspective arrays are optional presentation data.
5. Core validation keeps required story fields and data types, bounded stored text, supported categories, and source references. Questions and opinion choices must be present and fit their storage fields, but word counts, question openings, and stylistic patterns are not validation gates. Question spacing and punctuation are normalized without replacing a generated question with a generic headline prompt. Bubble summaries are safely bounded to the collection's 180-character limit with the headline as fallback. Perspective arrays are saved only as a complete pair of three non-empty bounded strings; missing or structurally invalid arrays do not reject the story and can use the existing optional perspective-generation action later. Invalid candidate/source IDs, malformed JSON, unsupported categories, and core required-field/type errors remain rejected; malformed batches do not stop later batches.
6. Saved source titles, publisher names, URLs, and original publication dates appear under **What’s the context?**. The short-card presentation carries an AI-generation disclosure.

The admin result reports fetched, processed, accepted, rejected, deduplicated and saved counts with rejection reasons. These counters describe that refresh run; they are not a promise that every requested candidate can be saved. Existing source URLs, hashes and covered events are skipped rather than regenerated, so runs append newly verified stories. The explicit publisher allowlist includes established national, regional, international, and specialist outlets (including CNN, CNBC, ABC News, El País, and The Christian Science Monitor) and recognizes their subdomains; it does not trust arbitrary domains or country TLDs. Regional top-headlines do not guarantee an even topic mix. The pipeline does not weaken its two-source rule to fill a larger batch.

### Why the pool looked like about five stories

The live read-only check on 2026-11-25 found **6 saved stories**, of which **5 pass the current discovery filter**. One routine game-result story is intentionally excluded from the landing feed. The front end queries up to 5,000 records and unseen-story selection considers the full eligible result set; there is no five-story query cap. The landing shows only a few bubbles concurrently, which is not the collection size. The refresh supports five- or 20-candidate batches, but source checks, event deduplication and AI validation can save fewer. To add stories, sign in as an admin, open `/news-admin`, and use **Build a larger batch · 20**; confirm the credit-use prompt. It appends new validated records and skips existing events. Wait for the eight-minute cooldown before another run. A 20–30 story pool still depends on enough credible independent reporting; this check did not run any paid refresh.

The previous landing used a top-aligned flex column with only a `min-height`. The globe scene's intrinsic height was added after the headline, so the visible Earth sat below the viewport center. The landing now uses a definite viewport-height area below navigation and centers the globe scene across that area. The SVG has one 360×360 coordinate system and one parent rotation around `(180, 180)` containing the ocean, land, cities, and surface glow. Only continents use the ocean-circle clip; skyline buildings can extend beyond the rim. Speech bubbles are separate upright scene elements. City variants use fixed layouts and deterministic coordinates/colors.

The popup opens upward from the bottom edge of the viewport and closes downward. Its initial view shows only the question, two short response cards, context disclosure, close, and Skip. The context panel reveals the source headline, conversational summary, dates, source links and AI disclosure. Legacy and previously generated stories can be updated individually from the admin News desk using their saved summary and verified source titles, publishers, and URLs. The current presentation version is `4`; the controlled action rewrites the question and answers, retains source references and story IDs, preserves the prior opinion wording/version for existing voters and comments, and invalidates cached AI arguments so they are regenerated against the updated choices. Saved records contain the verified summary and source metadata, not full article bodies, so the simplifier does not re-fetch source articles.

## Voting and discussion

- A and B are equal-size, square cards containing one short response. **Skip** moves to the next story without recording a vote. There are no percentage bars, counts, winners or popularity signals in the main UI.
- Votes remain private per user and unique on `(storyId, userId)`. The authenticated server action updates that reader's existing record or creates the first one; a uniqueness race re-reads the owner-scoped record and updates it instead of creating a second vote. After a successful write, both cards lock, the chosen card is outlined and marked “Locked in,” and the other is muted. **Change my answer** unlocks both without a confirmation step; the updated choice is persisted and locks again. Refresh restores the latest stored choice. Comments retain the position and opinion version recorded when posted.
- Comments are limited to 500 characters. Server actions derive the author and identity from authentication, enforce that a commenter chose that opinion, apply a posting limit, and permit one reply level. Comment text is rendered as text; there are no edit/delete controls.
- Discussion bubbles show both stored positions before voting and after a choice changes. Real comments are prioritized and preserve the opinion ID/version recorded at posting; cached AI arguments fill available slots for each position. The green/red mapping consistently follows stored opinion A/B. Bubbles appear gradually (the first after 1–2 seconds, later bubbles every 3–5 seconds), remain visible long enough to read, and pause while interacted with. Every bubble has a circular deterministic local illustration; genuine users use an available profile image only when present, otherwise a consistent illustrated fallback. AI personas use distinct matching illustrations and a small **AI-generated · not a reader** disclosure, never fake user accounts or comments. Clicking a human comment opens its thread and replies; AI arguments are not people and do not accept replies.
- Opinion suggestions are persisted separately as pending proposals, so opinion labels attached to existing votes are not changed. An admin review and approval screen is not implemented.

The `vote-stats` server action remains for compatibility but the primary interface no longer calls it or presents distributions. Individual vote records remain protected by the existing schema.

## Integrations and DeepSpace primitives

The server-side Worker action uses these DeepSpace catalog integrations, all configured for developer billing in `src/integrations.ts`:

- **NewsAPI (`newsapi/top-headlines`)** discovers current headlines.
- **Exa (`exa/search`)** finds more reporting and returns source text and links.
- **OpenAI (`openai/chat-completion`)** synthesizes the verified source packet into the structured story object.

The app uses DeepSpace auth and roles, collection permissions, unique constraints, app actions, `RecordProvider`/`RecordScope`, and native record synchronization. Provider credentials are never in frontend code. Browsing stories does not invoke paid integrations.

## Run locally

Use the project's existing DeepSpace setup and local secrets; do not add `.dev.vars`, tokens or provider credentials to source control.

```sh
npm install
npm run dev
```

Sign in through the app's DeepSpace auth UI. The app owner is an admin. Admins can open `/team` to manage roles and `/news-admin` for news refresh and one-story question updates. A five-candidate refresh uses five NewsAPI requests, up to five Exa searches and up to two OpenAI requests; the larger batch asks for confirmation and may use up to five NewsAPI requests, 20 Exa searches and five OpenAI requests. These consume DeepSpace credits. There is an eight-minute cooldown. Older stories have an admin-only **Simplify question & answers** action using saved reporting; each update makes one OpenAI request. It retains source references and previous opinion versions for voters.

## Verification

```sh
npm run validate
npm run lint
npm run build
npm run test:smoke -- --port 5181
```

The smoke suite uses an isolated local port and does not run the paid news pipeline. Integration execution, admin refresh, persistence across refresh, and opposing discussions require an authenticated local account and real saved stories. Two-account checks need separate accounts. Do not treat an implementation or an anonymous smoke test as proof those flows work.

## Tradeoffs and known limitations

- The publisher allowlist includes a broader set of established regional and specialist outlets, but remains explicit rather than trusting entire country TLDs. Exa results vary, and a requested 20-story refresh may save fewer stories. Publisher allowlisting and title similarity are practical filters, not a guarantee of editorial reputation or event equivalence; source packets should be spot-checked.
- The five headline markets broaden geography but remain English-language feeds; topic balance is not guaranteed.
- News refresh is manual; there is no scheduled cron. Its lock and cooldown reduce duplicate requests, and the admin action is the only place that calls metered integrations.
- The globe uses hand-drawn simplified continent paths, not a precision geographic projection. The entire sphere artwork rotates as one SVG group; its clockwise angle is explicit and centered on the ocean at `(180, 180)`.
- Miniature SVG city variants use deterministic building layouts, muted palettes, houses, towers, parks, and trees attached around the circumference. Hot-discussion flames are computed from real comments/replies in a 14-day window (at least four records from three distinct participants); disaster-related stories are suppressed. Cities stay decorative because story-level geographic metadata is not reliable enough to link activity to a city.
- A conservative discovery heuristic hides routine sports results, coach appointments, and generic announcements on the randomized feed. It preserves explicit disputes and policy stories, but headline heuristics can have false positives/negatives. Direct story links and admin records remain available.
- Story UI is keyed by story ID while shared record subscriptions live above it. The current authenticated user's latest vote is restored only for that story; an unresolved vote query blocks selection, and asynchronous AI fallback results are ignored after leaving a story.
- The reusable speech bubble sets absolute positioning at the globe-scene level. This avoids grid stretching and gives each bubble a content-sized body and directional tail.
- Opinion proposals are stored as pending but there is no admin review/approval UI. Comment reporting and moderation are not implemented. Replies are limited to one level.
- The globe and bubbles respect reduced-motion settings. On small screens the bubble count is reduced to preserve space.
- Authenticated refresh, story display, vote, opposing-comment/reply flows, multi-account security checks, and physical-device mobile review still need human testing with real data. This implementation has not been deployed.

## Main files

- `src/actions/index.ts` — secure voting/comment actions and admin refresh pipeline.
- `src/lib/news-sources.ts`, `src/lib/news-generation.ts` — source deduplication, independent-publisher checks, JSON/schema validation.
- `src/schemas/what-schema.ts` — collection shapes and access rules.
- `src/pages/(app)/index.tsx`, `src/components/Globe.tsx`, `src/components/StoryModal.tsx` — landing, globe and modal experience.
- `src/components/SpeechBubble.tsx`, `src/components/HotFlame.tsx`, `src/lib/discussion-activity.ts`, `src/lib/story-votes.ts`, `src/lib/story-selection.ts` — shared bubble/indicator presentation and tested feed/vote helpers.
- `src/pages/(app)/home.tsx` — story reading, opinions, discussion and replies.
- `src/components/NewsRefreshControl.tsx` — admin batch controls and run statistics.
- `src/styles.css`, `src/themes.css`, `src/themes.ts`, `index.html` — visual system, responsive rules and first paint.

## Latest bug-fix verification

Recent smoke checks exercise the planet at 0°, 90°, 180°, and 270° and save `/tmp/what-globe-angle-<angle>.png`; they also check that the ocean, land, and un-clipped cities share one rotating parent, and that both choice cards remain available before voting. Screenshot checks are visual geometry/layout checks, not authenticated persistence tests. The smoke run does not authenticate, cast persistent votes, post comments, invoke integrations, or deploy. Those flows still need a personal signed-in test with saved stories; two accounts are needed to confirm opposing human comments and reply permissions.
