# Change case-admin rubric validation for focused panel rubrics

Repo: /home/linuxmint/nboe-app.

The product owner explicitly changed the rubric rule: there is NO minimum of 15 rubric items. Panel questions may have 3-4 focused items if they directly assess the answer. Remove generic boilerplate rubric items; keep only substantive answer-specific facts. Existing case-admin PATCH currently rejects active checklist_rubric with fewer than 15 items. Change the Edge Function validation and any schema docs/comments to allow focused rubrics with minimum 3 items, maximum 100, each text 10-500 chars, points 1-5, and maintain sensible quality gates (at least one critical item when rubric is active, total points >= 6; do not require >=8 critical or >=40 points). Empty items still disables rubric. Preserve answer key sync and all other auth/update behavior.

Add/update tests if present for 3-item focused rubric accepted and 2-item rejected; no generic minimum 15. Do not alter unrelated code. Run relevant tests/type checks. Commit on branch feat/focused-panel-rubric-validation and report changed files/commit.
Do not deploy or mass-edit database; parent agent will deploy and perform audited mass edit after reviewing changes.