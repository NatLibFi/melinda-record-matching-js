# Melinda record matching modules for Javascript [![NPM Version](https://img.shields.io/npm/v/@natlibfi/melinda-record-matching.svg)](https://npmjs.org/package/@natlibfi/melinda-record-matching)

## License and copyright

Copyright (c) 2020-2026 **University Of Helsinki (The National Library Of Finland)**

This project's source code is licensed under the terms of **MIT** or any later version.

## Publication Time Gradable Penalty Option

Both `publicationTimeAllowConsYears()` and `publicationTimeAllowConsYearsMulti()`
support a `{ gradablePenalty: true }` option (explicit opt-in) that replaces the
hard force-fail (-1.0) with a graded penalty based on year gap size:

| Gap | Penalty |
|-----|---------|
| ≤ 3 years | -0.1 |
| ≤ 7 years | -0.3 |
| ≤ 15 years | -0.5 |
| > 15 years | -0.7 |

Default behavior (no options) returns -1.0 for non-matching years (force-fail).

When either side has no valid 4-digit year (008 positions 07-11, excluding the
sentinel values 0000/9999), both variants return 0 (neutral) before any other
comparison. The `gradablePenalty` option does not govern this path.

## CLI Environment Variables

The CLI (`--help`) reads its configuration from environment variables. The
search type (`-t` / `MELINDA_RECORD_MATCH_SEARCH_TYPE`) must be one of:
`IDS`, `IDS_F773`, `STANDARD_IDS`, `STANDARD_IDS_F773`, `COMPONENT`, `CONTENT`,
`CONTENT_F773`, `CONTENTALT`, `CONTENTALT_F773`, `YSO`.

`ISSN_POSITIVE_WEIGHT` sets the positive weight for a shared ISSN in the
mirrored CLI strategies (STANDARD_IDS, STANDARD_IDS_F773); `0` disables it;
empty or unset uses the default of 0.75.
