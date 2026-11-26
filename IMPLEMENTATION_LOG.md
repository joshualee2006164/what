# Implementation log

## Assessment build: what.

### Implemented

- Added what.-specific DeepSpace collections for stories, votes, comments, opinion proposals, and refresh locks.
- Added validated server actions for one-vote-per-story, comments/replies, opinion proposals, and admin-only news refresh.
- Connected the refresh action to the verified `newsapi/top-headlines`, `exa/search`, and `openai/chat-completion` catalog endpoints using server-side integration calls.
- Added bounded source fetching, JSON parsing and Zod validation, HTTPS source-link validation, URL-based story deduplication, persistent lock/cooldown, and failure messages.
- Replaced scaffold landing/home screens with a live rotating globe and the read → vote → opposing discussion → next-story flow.
- Reworked the landing into a centered vertical hero, enlarged the globe by about 25%, added a more recognizable equirectangular continent illustration, longitude rotation, and five staggered bubble positions bound only to persisted story summaries.
- Moved Explore/account navigation to the top-right opposite the wordmark, placed the explore invitation under the globe, and made the empty-state hint tell admins to sign in and refresh.
- Added sign-in protected `/team` role management using DeepSpace `useUsers().setRole()` and an admin-only Team navigation link; the DeepSpace Durable Object remains the authorization boundary.
- Added the responsive cream/pastel editorial theme, sign-in affordance, empty/loading states, source links, AI disclosure, and proposal form.
- Updated the smoke tests for the live-data landing and protected team page; added project documentation in `README.md`.

### Files changed

- `src/schemas.ts`, `src/schemas/what-schema.ts`
- `src/actions/index.ts`, `src/integrations.ts`, `src/lib/what-api.ts`
- `src/components/Globe.tsx`, `src/components/Navigation.tsx`
- `src/pages/index.tsx` (removed), `src/pages/(app)/index.tsx`, `src/pages/(app)/home.tsx`
- `src/prerender-entry.tsx`, `src/prerender-entry.test.tsx`, `src/seo.ts`
- `src/styles.css`, `src/themes.css`, `src/themes.ts`, `index.html`
- `tests/smoke.spec.ts`, `tests/api.spec.ts`, `tests/collab.spec.ts` (comments updated to match the live landing)
- `README.md`, `IMPLEMENTATION_LOG.md`

### Verification record

- Official docs, the DeepSpace skill repository, the installed v0.44.2 declarations, and the `taskspace` example were inspected before implementation.
- DeepSpace catalog schema lookups succeeded for all three required endpoints.
- Minimal live endpoint checks all succeeded: NewsAPI returned one headline ($0.0234 base), Exa returned one result with 300-character text ($0.007 reported), OpenAI returned valid JSON with an 8-token completion ($0.0000087 reported). Total reported cost: about $0.0304. These used the current CLI login and were not calls through the app’s admin refresh action, so the app-owner billing path still needs confirmation.
- `npm run validate` — passed (TypeScript plus 3 unit tests across 2 files).
- `npm run lint` — passed.
- `npm run build` — client and Worker bundles completed. Wrangler emitted a non-fatal log-file permission warning because this environment cannot write to the user Preferences directory. The original `.dev.vars` remains at the project root and is gitignored; `dist/what/.dev.vars` was absent after the build, and the client bundle did not contain credential-looking values.
- `npm run test:unit` — passed, 3 tests across 2 files.
- Playwright smoke and API checks on isolated port 5181 — passed, 10 tests. This covered the landing, metadata, stacked centered layout, live record socket, auth proxy, 404, sign-in affordance, and 390px viewport overflow.
- Local admin refresh and resulting story/vote/comment flows — pending because the browser test session was signed out; no stories or demo records were fabricated.
- Two-account authorization/realtime checks, physical-phone review, and deploy — pending.

## News generation validation fix

- The previous refresh response exposed only the combined Zod batch failure, so the exact failed field from that completed request was not recoverable. The code path confirms OpenAI returned non-empty chat-completion content that parsed as JSON; validation of the expected `{ stories: [...] }` envelope or one of its story items then failed.
- Tightened the prompt to state the exact output shape, supported category values, all field length limits, and candidate-local source ID rules.
- Split envelope validation from per-story validation. A malformed individual item is skipped with a sanitized log of its index and Zod paths/codes/messages; valid siblings can still be persisted. Unknown candidate IDs, duplicate candidate items, invented source IDs, and insufficient source text remain rejected.
- Confirmed the supported DeepSpace integration response is `result.data.choices[0].message.content`; added handling and safe metadata logging for missing content and `finish_reason: "length"` truncation.
- Changed refresh failures to red alert styling while leaving success notices green.
- Added synthetic parser, category mismatch, required/length field, malformed JSON, nested-envelope, truncation, and source-reference regression tests. No news fixture is seeded or displayed by the app.
- `npm run validate` — passed, 11 tests across 3 files. `npm run lint` — passed. No paid integration calls were made while debugging.

## Design, source quality, and discovery update

### Investigation findings

- The previous refresh pipeline selected only five NewsAPI candidates before source checks and AI validation. Any candidate rejected later reduced the number saved from that refresh. The landing showed at most five bubbles at once, which also made the pool look fixed. Existing route queries were already larger than the requested 20–30 story pool.
- The NewsAPI endpoint permits `pageSize` up to 100; the refresh now requests that supported maximum and scans until it has the selected batch of distinct candidates. This does not guarantee a 20-story save: source quality, event deduplication and model validation can still reject items. [Official Top Headlines parameters](https://newsapi.org/docs/endpoints/top-headlines)
- The old pipeline lacked publisher independence and event-title checks across Exa results. It now filters trusted domains, canonical URLs, repeated publishers and obvious syndicated near-copies; a save requires at least two sources with enough text. The prompt asks for three independent sources when available. The source-domain allowlist remains conservative and cannot prove editorial quality by itself.

### Implemented

- Reworked the shared theme to pale yellow, mint, leaf green and ocean blue with rounded, low-contrast surfaces, soft shadows and friendly typography. Replaced visible vote bars with two equal square opinion cards; vote records and server enforcement remain intact.
- Kept the illustrated globe as the centered landing focus and fixed its repeated landmass SVG so the longitude strip can loop without a recursive SVG reference. News bubbles cycle through up to five records at a time from the full saved collection and open their exact story. Reduced-motion users get stationary bubbles and continents.
- Opened stories in a focus-managed, Escape-dismissible modal over the globe. The modal supports internal scrolling, source disclosure, voting, discussion, threaded replies and next-story replacement. Direct `/home?story=` links remain supported.
- Replaced the ordinary comments list with tappable opposing-comment bubbles and a focused thread view. Comments still come from records; empty states are explicitly empty. No sample engagement was added.
- Added `src/lib/news-sources.ts` for canonical URL and publisher handling, event relevance, syndication similarity and independent-source checks. Source ID validation now ensures the AI selected sources from the candidate packet and at least two different publishers.
- Increased NewsAPI intake to 100 candidates, expanded refresh to a protected five-candidate default or a confirmation-gated 20-candidate batch, raised story collection queries to 5,000, and made the globe rotate through the entire returned story pool. Session selection resets only after all available alternatives are seen, and skips the current story when another exists.
- Added actual run statistics. Story counts no longer combine filtered source articles with rejected stories; source-level filtering and source deduplication are reported separately. Admins see fetch/process/accept/reject/deduplicate/save counts and rejection categories.
- Tightened summary word-count validation to keep stories short, made the prompt request conversational 40–70 word summaries and cross-checking of central claims, and request three independent sources where available. Minimum two-source validation remains required.
- Updated README with architecture, quality rules, selection, UI, security, tradeoffs and local verification steps.

### Files changed in this update

- `src/actions/index.ts`
- `src/lib/news-sources.ts`, `src/lib/news-sources.test.ts`
- `src/lib/news-generation.ts`, `src/lib/news-generation.test.ts`
- `src/lib/story-selection.ts`, `src/lib/story-selection.test.ts`
- `src/schemas/what-schema.ts`
- `src/components/Globe.tsx`, `src/components/StoryModal.tsx`, `src/components/NewsRefreshControl.tsx`
- `src/pages/(app)/index.tsx`, `src/pages/(app)/home.tsx`, `src/pages/(app)/_layout.tsx`
- `src/styles.css`, `src/themes.css`, `index.html`
- `README.md`, `IMPLEMENTATION_LOG.md`

### Verification for this update

- `npm run validate` — passed: TypeScript and 18 tests across 5 files (source quality, independent publisher, story parser/source references, summary length, and session selection).
- `npm run lint` — passed.
- `npm run build` — production Worker and client bundles completed. Wrangler printed a non-fatal inability to write its user Preferences log; Vite still completed both bundles.
- `npm run test:smoke -- --port 5182` — passed 10 Playwright smoke checks, including the landing JS, centered stacked globe, narrow mobile viewport, modal open/escape-close over the landing, auth proxy boundary, and route shell. An earlier attempt on the default port was refused because the user's existing dev server owns 5173; the suite ran on isolated ports and did not touch that server.
- No metered integration call or deployment was made during this update. The current CLI integration catalog lookup could not reach DeepSpace (`catalog_unavailable`); integration call behavior has therefore not been re-executed. The source-quality helper tests use clearly synthetic data and do not create application stories or engagement.
- End-to-end authenticated refresh, real story persistence/rendering, two-account voting/opposing-comments/replies, and physical mobile review remain unverified. They require administrator login, real saved stories, and (for refresh) approval to spend integration credits. Existing anonymous smoke tests do not verify those flows.

## Final UX refinement

### Findings and changes

- The globe was low because the landing used `min-height` with a top-aligned flex column. The headline and intrinsic globe scene were stacked, so the globe container began below the header instead of sharing the available viewport. The landing now has a definite `100svh - navigation` height; its globe scene is centered in that area, and the Earth circle itself is centered in its square SVG button. No positional nudges are used. A regression smoke check measures the actual SVG sphere against the viewport center and checks desktop page height.
- Landmasses and city markers now share one longitude translation. The previous map animation and marker projection each tracked their own rotation, which risked drift. Fourteen city labels use latitude/longitude coordinates; only front-facing, non-crowded labels are shown. This remains a lightweight equirectangular illustration, not a precision map.
- The first-view story popup is now a 430px maximum conversation card with the discussion question, two minimal square response cards, context disclosure, close, and Skip. It rises from the bottom and dismisses downward, with reduced-motion handling. Sources, source headline, summary, dates and AI disclosure appear after expanding context. Admin refresh controls live only at `/news-admin`.
- The generation prompt and Zod schema now target a 6–15 word question, 4–12 word responses, 40–70 word conversational summary, and 8–20 word bubble. The stored source headline stays as retrieved; the question is the primary popup title. Existing stories can be updated one at a time from the admin area using saved reporting context. That action updates only the question and presentation version; it leaves opinion options and votes unchanged.
- Globe bubbles now show six desktop / four narrow-mobile records and replace one slot every two seconds, rotating through the full returned story pool. A focused, hovered, or open-modal state pauses replacement. No story or engagement fixtures were introduced.
- NewsAPI candidate discovery now interleaves five regional markets (US, UK, India, Australia, South Africa), scanning each response up to the endpoint's 100-headline page size. The existing two-independent-source minimum, Exa retrieval, source packet validation, deduplication, admin checks, lock/cooldown, and metered-call boundary remain in force. This improves breadth, but does not demonstrate that 20–30 records exist until an approved refresh runs.
- The initial saved-story wait uses a small what. / Earth / sprout loader. It does not add a delay; it offers an honest retry only after eight seconds.

### Files changed

- `src/actions/index.ts`, `src/lib/news-generation.ts`, `src/lib/news-generation.test.ts`, `src/lib/news-sources.ts`
- `src/components/Globe.tsx`, `src/components/StoryModal.tsx`, `src/components/BrandedLoading.tsx`, `src/components/Navigation.tsx`, `src/components/NewsRefreshControl.tsx`
- `src/pages/(app)/index.tsx`, `src/pages/(app)/home.tsx`, `src/pages/(app)/_layout.tsx`, `src/pages/(app)/(protected)/news-admin.tsx`
- `src/styles.css`, `tests/smoke.spec.ts`, `README.md`, `IMPLEMENTATION_LOG.md`

### Verification and remaining checks

- `npm run validate` — TypeScript plus 19 unit tests passed.
- `npm run lint` — passed.
- `npm run build` — Worker and client builds completed. Wrangler emitted a non-fatal `EPERM` while trying to write its user Preferences log; Vite completed both bundles.
- `npm run test:smoke -- --port 5184` — 10 Playwright smoke tests passed. Added checks confirm the actual SVG sphere is centered below the nav, desktop has no vertical overflow, and the desktop popup is at most 460px wide. The suite checks mobile width, the globe route, modal opening/closing, auth boundaries and route shells.
- No refresh, integration invocation, deployment, or story/question fixture was run. The paid NewsAPI/Exa/OpenAI pipeline and persistence need an administrator-triggered refresh. Authenticated voting, comments, replies and next-story behavior still need personal testing with real saved stories (and two accounts for opposing-side confirmation). The smoke tests are anonymous and do not establish those backend flows.

## Critical bug fixes and living-world refinement

### Root causes and changes

- **Vote/discussion state leaked between story transitions.** The landing's `HomePage` instance survived query-string changes. Although vote lookup included story and user IDs, pending UI state (discussion, composers, context, errors, and async completion) belonged to that persistent component and could remain visible until effects ran after paint. The page now keeps shared record subscriptions in a parent and mounts the story interaction inside a component keyed by the current story ID. This remount resets temporary state immediately. Current-user vote lookup remains exact to the current story; unresolved or failed vote loading does not optimistically show an answer as chosen. AI fallback responses also ignore late completions after the component changes stories. Regression coverage alternates A/B across five successive stories and verifies both unvoted state and restoration of only that story's actual vote.
- **Landing bubbles stretched into grid cards.** `.speech-bubble` set `position: relative` after `.globe-bubble`'s absolute rule, so the bubble buttons became grid items and stretched to their grid tracks. The final globe-bubble rule now explicitly uses `position: absolute` in the globe scene. A reusable `SpeechBubble` component provides natural content height, restrained widths, tail direction, color variants, and entrance/float motion. Desktop/mobile Playwright checks assert stable compact heights and no pairwise overlap.
- Added lightweight SVG skyline groups at geographic coordinates inside the same rotating globe map layer. Shared longitude motion keeps city illustrations attached; silhouettes use reusable buildings/windows and fade toward the edge or disappear behind the globe. There are no flames at cities because current story data does not establish reliable geographic associations.
- Added an SVG flame indicator only when persisted comments/replies show recent real activity (14-day window; at least four comment records and three distinct participants). A tragedy/disaster headline suppresses the marker. It is labeled as discussion activity for assistive technology.
- Kept opposing voices around (outside) the compact question card and inside the modal's focus-managed dialog. Human comments remain actual comment records and open their persistent thread. When the opposite side has no comments, validated cached AI arguments are shown with an explicit AI label and no fictional author. New generated stories cache three arguments for each side; legacy stories can generate missing arguments once through a protected, authenticated action with a persistent lock/cooldown and only after a user has actually voted. Replies to an AI argument become a top-level story comment rather than an apparent reply to a person.
- Added conservative filtering for routine sports scores, coaching appointments, and generic announcements to the randomized discovery feed. Direct links remain usable. This is headline-based editorial filtering, so false positives and negatives remain possible.
- Expanded bubble and city illustration colors to include peach, coral, lavender, rose, honey, dusk blue, stone and muted building colors while retaining the nature palette.

### Files changed in this update

- `src/pages/(app)/home.tsx`, `src/pages/(app)/index.tsx`
- `src/components/Globe.tsx`, `src/components/StoryModal.tsx`, `src/components/SpeechBubble.tsx`, `src/components/HotFlame.tsx`
- `src/actions/index.ts`, `src/schemas/what-schema.ts`
- `src/lib/story-votes.ts`, `src/lib/story-votes.test.ts`, `src/lib/discussion-activity.ts`, `src/lib/discussion-activity.test.ts`, `src/lib/story-selection.ts`, `src/lib/story-selection.test.ts`, `src/lib/news-generation.ts`, `src/lib/news-generation.test.ts`
- `src/styles.css`, `tests/smoke.spec.ts`, `README.md`, `IMPLEMENTATION_LOG.md`

### Verification and limits

- `npm run validate` — TypeScript and 26 tests passed, including five consecutive story-vote state checks, discovery filtering, discussion activity thresholds, and AI argument validation.
- `npm run lint` — passed.
- `npm run build` — Worker and client bundles completed. Wrangler printed a non-fatal `EPERM` when writing a user Preferences log; command exited successfully and both Vite outputs completed.
- `npm run test:smoke -- --port 5185` — 12 browser smoke tests passed. This included bubble size/non-overlap at desktop/mobile, Earth centering, rotation, modal Escape close, and visual layout of discussion bubbles. The discussion visual test used clearly marked ephemeral DOM-only content; it is not an app record or real user comment.
- `git diff --check` — passed.
- No NewsAPI, Exa, or OpenAI integration was called; no metered refresh, persistent vote/comment/reply, authenticated multi-account flow, or deployment was performed. The five-story regression is a pure state helper test; final signed-in voting and live discussion still need manual verification using actual saved stories. Browser screenshots from the smoke run live in `/tmp/what-speech-bubbles-{desktop,mobile}.png` and `/tmp/what-discussion-{desktop,mobile}.png`.

## Globe, both-sides perspectives, and changeable votes

### Root causes

- The ocean circle was a sibling of the rotating SVG map group. Land, cities, and the surface glow rotated around `(180, 180)`, while the ocean stayed still, so the artwork visibly separated into overlapping planets. The ocean, clipped land, cities, and glow are now children of the same SVG parent with one explicit clockwise `rotate(angle 180 180)` transform. The land-only clip remains around the continent paths, leaving city buildings free to extend outside the rim. Scene speech bubbles remain outside the SVG.
- The vote action previously returned `already_voted` whenever a `(storyId, userId)` record existed, and the UI removed the answer cards after that first vote. It now updates the existing owner-scoped record and leaves both choices visible with the current one selected. Creation still uses the schema's unique constraint; a duplicate-create race re-queries the caller's own record and updates it. Vote `userId` and `storyId` remain immutable; viewer/member schema permissions allow only owner updates. Comments are never rewritten during a vote change and continue to carry their original opinion ID/version.

### Implemented

- Refined both-side discussion bubbles so they appear before voting and remain around the question after voting. Up to three real top-level comments per stored position are shown first, and cached AI arguments fill available slots for that position. Green is always opinion A and red is always opinion B, including the two choice cards; explicit position text handles non-yes/no questions.
- Cached AI arguments are available on open for signed-in readers when an older story has no saved pair. The server action returns a valid cache without another integration call and acquires the existing per-story lock before generating a missing pair. New stories keep their generation-time cache. Human names and the prominent `✦ AI Perspective` label stay distinct.
- Replaced the repeating short skyline pattern with seven deterministic reusable city layouts and varied houses, apartments, towers, rounded buildings, spires, parks, and trees using muted colors.
- Hide all unrelated news bubbles as soon as the question modal opens. The opinion cards remain square and fully readable; both are still actionable after voting.

### Verification and limitations

- Added a browser geometry test that locks the SVG to 0°, 90°, 180°, and 270°, checks the fixed circular ocean center and shared/unclipped artwork hierarchy, checks varied city layouts, and saves `/tmp/what-globe-angle-{0,90,180,270}.png`. These screenshots were visually inspected in the browser test workflow.
- Smoke tests also verify both choice cards appear unselected before voting, bubbles hide under the active modal, the modal remains compact, and choice text has no line clamp or overflow. Authenticated vote updates, refresh restoration, comment/reply persistence, and one-vote uniqueness still require a signed-in test account; no persistent local record or paid integration was altered for tests.
- Latest verification: `npm run validate` passed TypeScript and 31 unit tests; `npm run lint`, `npm run build`, and `npm run test:smoke -- --port 4177` passed (14 browser tests). The 0°/90°/180°/270° globe captures and refreshed desktop/mobile question captures were visually inspected. A browser geometry assertion now checks that choice text stays inside its card at both desktop and mobile widths.
- Authenticated vote updates, refresh restoration, comment/reply persistence, and multi-account authorization remain unverified without a signed-in test account. No paid integration calls were made and nothing was deployed.
- No dependencies were added and nothing was deployed.

## Conversation animation, question bubbles, and story-pool check

### Findings

- A read-only live collection query returned **6 saved stories**. The discovery filter accepts **5**; one routine game-result story is excluded. The landing query and News desk both request up to 5,000 records, and unseen-story selection considers the full eligible result set. The apparent five-story ceiling was the small saved collection, not a five-record frontend query.
- The globe can display at most six desktop or four mobile bubbles at once. Previously it populated every available bubble immediately and only rotated when more eligible stories existed than slots, so a pool smaller than the visible capacity stayed static.
- The News desk already supports append-only batches of five or 20 candidates. Existing URLs, hashes and covered events are skipped; validated new candidates are created without rewriting saved stories. Each run calls five NewsAPI markets, up to five or 20 Exa searches and one OpenAI request, and may save fewer than the candidate count after source-quality, independence, deduplication and structured-response checks.
- No historical run result was available to distinguish a past Exa failure from OpenAI/source-validation rejections. Those are reported by the next admin-run result. No refresh or paid integration was invoked; the admin's larger-batch confirmation remains in place.

### Implemented

- Landing bubbles now start empty, introduce one question every 1–2 seconds, use randomized collision-free scene anchors and colors, and fade individually after 7–12 seconds. Hover and focus pause that bubble's dismissal; opening a story pauses the remaining lifetimes. Questions use the stored standalone `discussionQuestion` verbatim, without a summary or line clamp.
- The News desk now reports both saved-story and discovery-eligible counts, clarifies the five/20 candidate batches and their credit confirmation, and explains that refresh appends new verified stories rather than regenerating existing records.
- Perspective bubbles now appear one at a time around the central card, balance the two positions, use varied safe anchors and retain individual bubbles while hovered or focused. Desktop can show five; mobile adapts to four or fewer where height is constrained. Position colors remain tied to stored opinion A/B, not the current user's vote.
- AI arguments now use deterministic friendly display names plus a small “AI-generated · not a reader” disclosure. Human comments keep their real usernames. Removed the repeated opinion label from each argument bubble; new AI prompts request one concise reason per argument and prohibit restating the full choice or question.

### Verification and limitations

- The read-only story count was checked through the live shared-record subscription; no saved records were changed.
- Added unit coverage for stable AI personas and unseen-story selection beyond five records. Browser smoke coverage checks gradual question bubbles, unique stories, non-overlapping positions, untruncated question text, balanced gradual perspectives, persona disclosure, and popup clearance.
- `npm run validate` — TypeScript and 34 unit tests passed.
- `npm run lint` — passed.
- `npm run build` — worker and client production bundles completed successfully.
- `npm run test:smoke -- --port 4187` — 15 browser tests passed, including desktop/mobile bubble geometry, the modal/perspective layout, the globe, and question-card readability.
- `git diff --check` — passed. Desktop and mobile bubble screenshots at `/tmp/what-speech-bubbles-{desktop,mobile}.png` were visually inspected.
- Building a 20–30 story pool still requires an administrator to approve and run one or more metered News desk batches. No such batch was run; quality thresholds and the two-independent-source minimum remain unchanged.

## News pipeline, reversible vote lock, and perspective polish

### Reported failure and diagnosis

- The News desk run reported by the owner fetched 33 articles, processed 17 candidates, accepted 0, rejected 33, and saved 0. Its reported skips included 16 publisher-allowlist rejections, 10 candidates without two independent sources, 4 OpenAI validation failures, and 3 omitted candidates. Source filtering reported 29 Exa untrusted/duplicate URLs, 3 quality rejections, and 4 unrelated-event results.
- The source checks were intentionally still enforcing trusted publishers and two independent reports, but the explicit domain set did not cover enough established outlets and country-specific publishers. Subdomains were already supported. HTTPS, mobile, AMP, and tracking-URL normalization have been preserved and extended; publisher identity now also groups known aliases such as AP/AP News, BBC, and Australia's ABC so alternate domains cannot count as separate independent publishers.
- Exa previously searched only the headline and asked for three results. Queries now include headline entities, up to eight distinctive description details, the publication date, and an independent-reporting cue; retrieval asks for up to eight bounded-text results. URL, trusted-domain, same-event, text-quality, syndication, and publisher-independence checks remain required.
- OpenAI previously received a large candidate set in one request. It now validates groups of four so a malformed batch does not prevent subsequent groups from being processed. Generation instructions now align with the word and character constraints, known category variants normalize to supported values, and exact field/code diagnostics are returned for future validation failures. Unknown categories, invalid source IDs, too-short source text, and stories with fewer than two independent publishers remain rejected. The prior run did not retain field-level validation paths, so the exact four historical OpenAI errors cannot be reconstructed.

### Implemented

- Added regression tests for mobile/subdomain normalization, known publisher aliases, source independence, detail/date-aware Exa queries, generated field limits, category aliases, and per-story validation.
- The News desk continues to append only newly accepted stories and never rewrites existing records during refresh. Its controls describe the possible API calls: five-candidate refreshes can use up to two OpenAI calls; 20-candidate refreshes up to five. Refresh and per-story presentation updates still require explicit administrator action and consume DeepSpace credits.
- Kept the authenticated, unique `(storyId, userId)` vote update path. After a successful save, both choice cards show a locked state; the chosen card is outlined and marked “Locked in,” and the other is muted. **Change my answer** unlocks both cards, and the next saved choice locks them again. Confirmation copy is in normal document flow below the cards.
- Slowed the perspective sequence to a 1–2 second first appearance followed by randomized 3–5 second intervals. Existing bubbles expire independently and pause while hovered or focused; story changes still reset the orbit.
- Added lightweight deterministic local SVG avatars to every perspective. AI persona illustrations map consistently to their display names and remain explicitly disclosed as simulated; human comments use a profile image only if one is available, otherwise a stable illustrated fallback based on author ID.
- Updated README pipeline, cost, migration, vote-lock, and avatar behavior documentation.

### Verification and limitations

- The last read-only shared-collection check recorded six saved stories, of which five were eligible for discovery. This is the latest known count; no live refresh or new collection query was run during this update.
- The News desk run reported above saved zero stories. The revised pipeline has not been exercised against live NewsAPI/Exa/OpenAI responses, so the number of additional stories it will accept is unknown. No metered refresh was run.
- The existing News desk **Simplify question & answers** control updates one legacy story per explicit confirmation and one OpenAI request. The six records previously reported as needing updates have not been migrated; source references, story IDs, vote records, and historical opinion wording remain untouched.
- Authenticated vote persistence and multi-account authorization still require a signed-in test account; no backend authorization or record-ownership rule was loosened.
- `npm run validate` — passed: TypeScript and 35 unit tests across 10 files.
- `npm run lint` — passed.
- `npm run build` — Worker and client production bundles completed.
- `npm run test:smoke -- --port 4188` — passed all 15 Playwright smoke tests. Desktop and mobile question/discussion screenshots were inspected for readable cards, compact avatar headers, and unobstructed perspectives. The lock-confirmation layout uses normal document flow, but its saved state still needs a signed-in visual test.
- Build output was scanned for local `.dev.vars` values. No dev-vars file remains under `dist`; only the expected `AUTH_JWT_PUBLIC_KEY` value appeared in the Worker bundle and source map, not the client assets.
- No live NewsAPI, Exa, or OpenAI refresh was run; no legacy-story updates, authenticated persistent vote test, or deployment was performed.

## News validation false-rejection fix

### Latest reported run

- The owner reported a second unsuccessful refresh: 34 fetched, 13 processed, 0 accepted, 34 rejected, and 0 saved. Rejections included 21 publisher allowlist misses, 2 insufficient-source candidates, 9 OpenAI story-validation failures, and 2 candidates omitted by the model.
- The exact `custom` validators were stylistic: generated questions were required to end in `?` and contain 5–16 words, with an additional vague-reference check; bubble summaries were restricted to 8–20 words; each of three arguments per side was restricted to 8–20 words. The argument checks were applied as hard requirements for every story, so a presentation-only failure rejected its entire story. The summary also had a hard 35–80 word refinement.
- The allowlist is URL-host based; publisher-name text variations are not used in the trust decision. It lacked roots for several established sources named in the report. Subdomain matching and URL normalization are retained; the allowlist now includes the reported CNN, CNBC, ABC News, El País, and Christian Science Monitor domains plus additional established publishers.

### Changes

- Kept essential checks: valid source URLs, trusted publisher roots, at least two independent publishers, relevant-event matching, duplicate/syndication checks, enough source text, candidate-local source IDs, supported categories, story structure, and direct opinion-choice validation.
- Removed word-count-only publication gates from summaries, questions, bubble summaries, and perspective arguments. Question text is retained if it is a bounded question without vague story references; otherwise it is converted to a question quoting the verified source headline. Bubble copy is normalized to the schema's 180-character maximum and falls back to the source headline if absent.
- Perspectives are now optional. Complete arrays of three non-empty strings up to the stored field limit are retained regardless of word count. If either side is structurally invalid, both arrays are omitted and the existing per-story perspective-generation flow remains available; this never rejects the source-validated story.
- Updated the generation prompt to label word counts as preferences and clarify that optional perspectives must not determine story eligibility. Existing tests now cover the reported style failures without any metered API calls.

### Verification and limitations

- `npm run validate` — passed: TypeScript and 38 unit tests across 10 files.
- `npm run lint` — passed.
- `npm run build` — Worker and client production builds completed.
- `npm run test:smoke -- --port 4191` — passed: 15 browser smoke tests.
- Build-output check — no `.dev.vars` files remain in `dist`; the only configured value detected in generated JS/source maps was `AUTH_JWT_PUBLIC_KEY`.
- No live refresh was run after this fix, so the accepted/saved count and remaining live rejection reasons are unknown. The reported run remains 0 saved; the updated pipeline is prepared for one authorized rerun.
- No UI changes or deployment were made.

## Final vote-card spacing and perspective upvotes

### Changes

- Removed the “Locked in” label from the opinion cards, retained only the selected-card lock icon, and moved confirmation to normal flow below both cards: “Your opinion is locked in” followed by “Change my answer.” Modal cards stretch to equal row height, drop the fixed square ratio, and allow long legacy text to wrap and expand without clipping.
- Added native `perspective_upvotes` records with an owner-bound user ID and a unique `(perspectiveId, userId)` constraint. Read/write permissions are disabled for direct client access; authenticated server actions validate human comment roots or cached AI argument IDs before adding/removing records.
- Upvotes use explicit desired state, so repeated requests are idempotent. The collection uniqueness constraint and duplicate-create recovery prevent duplicate rows. Counts and each signed-in reader’s state are derived from stored records; a narrowly scoped public action returns aggregate counts only, never voter identities.
- Added stable, content-bound IDs for cached AI arguments and record IDs for human comments. Both the orbit bubbles and the full-page comment bubbles have a small upvote control. Counts load in one bounded per-story action, bubble animations remain mounted, and orbit bubbles pause while an upvote request is in flight. No downvotes, ranking, or generated engagement were added.

### Verification and limitations

- `npm run validate` — passed: TypeScript and 44 unit tests across 12 files. Action tests cover add/remove, restored counts/state, repeated requests, concurrent duplicate creates, invalid perspective IDs, and the native uniqueness schema.
- `npm run lint` — passed.
- `npm run test:smoke -- --port 4191` — passed: 15 browser tests, including long opinion text, equal card dimensions and confirmation/context spacing on desktop and mobile, plus perspective upvote controls and loaded counts.
- `npm run test:api -- --port 4192` — passed: 3 API tests, including anonymous aggregate-count access and rejection of unauthenticated upvote writes.
- `npm run build` — Worker and client production builds completed. Removed the generated `dist/what/.dev.vars`; no `.dev.vars` files remain under `dist`.
- No authenticated live account write or deployed-storage refresh test was performed. Persistence behavior was exercised against the action-level record-store test double; the collection’s native uniqueness constraint and the HTTP authentication boundary were separately verified. The new collection will be applied by the normal DeepSpace deployment.
- No dependencies were added and no deployment was performed.

## Plain-language question and opposing-choice content fix

### Changes

- Replaced the news-generation and controlled simplification instructions with explicit plain-language requirements: assume no prior knowledge, include the concrete factual premise in the question, identify unfamiliar people by role, avoid abstract/jargon questions, and make the two choices direct, fair opposites grounded in the saved reporting.
- Removed word-count, question-form, and formal-phrase checks from the content schema. Required questions and choices still must be strings within their storage limits; style preferences no longer reject an otherwise source-valid candidate. Generated questions are normalized for spacing and punctuation, not replaced with a generic headline question.
- Set new and simplified stories to presentation version 4, so version-3 stories that were still vague become eligible for the existing one-story News desk control.
- The controlled action still preserves source fields and record IDs. If a story has votes, it retains the previous opinion pair in version history rather than changing the meaning of recorded votes. It clears cached AI arguments on update so the existing perspective-generation path recreates them against the new question and choices. AI fallback arguments now explicitly refer to the corresponding A or B choice.
- Documented that saved story records contain verified summaries and source metadata, not article bodies; simplification uses those saved materials and does not re-fetch reporting.

### Verification and limitations

- `npm run validate` — passed: TypeScript and 45 unit tests across 12 files.
- `npm run lint` — passed.
- `npm run build` — Worker and client production builds completed. Removed the generated `dist/what/.dev.vars`; no `.dev.vars` files remain under `dist`.
- No paid news refresh or simplification request was made. The local News desk loaded signed out and did not expose an authenticated admin session, so saved records were not updated in this run. They are eligible for the existing one-story-at-a-time control after deployment/sign-in.
- No UI redesign, dependencies, or deployment.
