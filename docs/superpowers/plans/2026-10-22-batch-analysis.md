# LeafLens batch analysis implementation plan

Goal: allow one to five photographs per session, preserve detailed per-image analysis and publish the tested result to the existing production project.

Architecture: extract the diagnosis workspace from App into a focused component. Keep the single-image prediction API and issue sequential per-file requests; this respects Vercel's request-size limit and existing CPU inference locking. Each item owns its image, status, result and error. Keep successful results during retries, invalidate results on model change, cancel outstanding work on unmount, and release preview URLs.

- [x] Inspect current code, design, deployment instructions and tests.
- [x] Write browser scenarios and observe failure on the original single-file input.
- [x] Implement selection, contact sheet, individual inspection, progress, partial failure and targeted retries.
- [x] Add comparison summary, per-image guidance, history and JSON batch export.
- [x] Verify limits, mixed files, switching, cancellation, mobile layout and real trained-model responses.
- [x] Run Python and browser suites, inspect screenshots and check accessibility.
- [ ] Review final diff, verify genuine Git identity, commit and push.
- [ ] Deploy the existing Vercel project and verify anonymous production health and real multi-image analysis.

Files: frontend/src/DiagnosisWorkspace.jsx; frontend/src/App.jsx; frontend/src/style.css; frontend/tests/batch.spec.js; documentation and screenshots. Model weights and dataset stay unchanged. Existing single-image users retain their flow. Report artefacts generated before this feature describe the earlier version; update their feature description after the code is settled if requested.
