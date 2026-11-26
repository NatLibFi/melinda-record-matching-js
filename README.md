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
