# Batch diagnosis verification

22 October 2026

The diagnosis workspace accepts up to five images, including additive file selection, drag and drop, camera captures and dataset samples. Invalid types and oversize files are reported without discarding valid selections. Removing or clearing selections releases preview URLs.

Each photo uses a separate sequential prediction request with a 90-second timeout. The backend and trained models are unchanged. Per-image failures remain retryable; completed results are preserved. Stop aborts the current client request and leaves remaining photos ready. A server inference already running can finish after its client request is aborted. Navigation retains session state; reload clears the active session while compact history persists locally.

Detailed results contain all returned alternatives, confidence, Grad-CAM, observation guidance and per-image JSON export. The comparison summary groups completed images into confident healthy patterns, confident disease patterns and low-confidence review results; these are mutually exclusive UI categories, not agronomic diagnoses. Batch export includes every selection's status, result or error and the summary.

Verification before release:

- Production frontend build passed.
- Existing Python suite: 20 passed.
- Browser suite: 13 passed, including five real images on both CNN and VGG16, single-image compatibility, limits, invalid files, partial failures and targeted retries, stop/resume, navigation, model changes, history and JSON export.
- Axe WCAG 2 A/AA and WCAG 2.1 AA checks: no violations on the completed desktop and mobile real-model batch views.
- Desktop and 390-pixel mobile screenshots reviewed; no horizontal page overflow.
- Independent code review completed. Comparison accessible names include results and confidence; an always-mounted live status announces both single and batch completion.

Real-model evidence screenshots: docs/screenshots/batch-real-desktop.png and docs/screenshots/batch-real-mobile.png. Mock API responses are used only in interaction tests, not as evidence of model quality.
