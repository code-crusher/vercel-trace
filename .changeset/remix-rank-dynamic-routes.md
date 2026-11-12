---
'@vercel/remix-builder': patch
---

Rank dynamic route rules by React Router's route specificity so a more specific route in its own server bundle is no longer shadowed by an earlier catch-all route.
