<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Task continuity

Do not interrupt or abandon the current task when new instructions appear.

If a new instruction is unrelated to the active task:
- finish the active task first,
- summarize what was completed,
- then complete the next task.
