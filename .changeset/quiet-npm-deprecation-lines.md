---
'@vercel-internals/builder-orchestration': patch
---

Only log individual `npm WARN deprecated` lines from `npm install` stderr when installing Builders, instead of dumping the entire stderr buffer when any deprecation warning is present.
