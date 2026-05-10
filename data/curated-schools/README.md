# Curated School Artifacts

Store one completed school per file in this directory.

Naming convention:

- `data/curated-schools/<school-slug>.json`

Workflow rule:

- finish one school
- write the JSON artifact here immediately
- then move to the next school

This keeps the model from carrying all 50 schools in context at once.

Useful commands:

- `npm --workspace @phofilledhackers/ingest run curate next`
- `npm --workspace @phofilledhackers/ingest run curate -- prompt --school=<school-slug>`
- `npm --workspace @phofilledhackers/ingest run curate -- validate --school=<school-slug>`
