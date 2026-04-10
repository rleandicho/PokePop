---
name: No preview/screenshot tools
description: User prefers to test locally — never use Preview or Screenshot tools
type: feedback
---

Do not use Preview, Screenshot, or any browser automation tools for verification.

**Why:** Token cost. The user runs their own local dev server and will handle all browser testing themselves.

**How to apply:** After code changes, ask the user to verify on their local server if needed. Never call preview_start, preview_screenshot, preview_snapshot, preview_eval, or related tools.
