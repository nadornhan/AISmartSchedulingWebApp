# CHRONO final source submission

## Submission identity

- Team: CSIT321 Group 27.
- Development baseline: `3112a134f92917a3d1b9ce8776c41a62bccd405b`.
- Preparation branch: `release/chrono-a5-final`.
- The ZIP records the final preparation commit and file hashes in `SUBMISSION_INFO.json` and `SOURCE_MANIFEST.json`.
- Actual local verification results are recorded in [FINAL_VALIDATION.md](FINAL_VALIDATION.md).

## Rubric coverage

Professional and consistent source: existing module architecture and coding checks are retained; CI lint/import issues are repaired, and all web regression suites are added to CI. A real priority-confirmation replay defect on equal clock ticks is repaired with deterministic regression coverage.

Clear commenting: security/session, cache isolation, static-route ordering, test transaction isolation and one-use priority confirmations explain their important invariants. Existing explanatory comments are preserved.

Author identification: AUTHORS.md identifies the six team members, and AUTHORSHIP.json records normalised Git contributors for source files. Selected module headers identify their contributors and refer to that record.

Installation: root README.md provides configuration, Docker/native startup, migrations, verification, quality checks, troubleshooting, shutdown and upgrade guidance. CONTRIBUTING.md describes current coding and API conventions.

## Package contents and exclusions

The ZIP contains application source, runtime assets, editable plant assets, shared contracts, migrations, tests, CI, lockfiles, examples and technical documentation.

The packaging tool uses an explicit root/directory allowlist. It excludes installed dependencies, generated output, Git metadata, real environment files, database dumps, avatar uploads, logs, Office temporary files, unrelated reports and report backups. High-confidence credential patterns block packaging for review. This scanner complements, rather than proves, a complete security audit.

## Rebuild or verify

From the repository root with Python:

```sh
python tools/submission/package_source.py --output submission-dist/CHRONO-A5-Source.zip
python tools/submission/package_source.py --verify submission-dist/CHRONO-A5-Source.zip
```

The tool records every payload file's size and SHA-256, checks archive CRC/inventory and emits a ZIP checksum sidecar. Its manifest excludes itself to avoid a recursive hash.

File credits can be regenerated from the original Git history with `python tools/submission/prepare_credits.py`. This requires a Git checkout containing the development baseline; it is not needed to install the extracted submission.

## Assessment use

Submit the ZIP through the required source-code submission field and retain the checksum. The report is a separate deliverable. The archive is the exact reviewed handover snapshot; the GitHub develop branch can change later. Source preparation does not automatically publish or deploy changes.
