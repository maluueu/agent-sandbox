# Pi extension: sandbox-status

Shows a footer badge in [pi](https://github.com/earendil-works/pi) indicating
whether the current session runs inside the agent-sandbox (bubblewrap):

- 🔒 **sandboxed** — running inside the sandbox
- ⚠ **no sandbox** — running unsandboxed

The badge is checked at session start. `/sandbox` re-checks; `/sandbox off`
and `/sandbox on` toggle the footer line.

## Install

The extension loads from this project directory automatically once pi trusts
the project (project scope). To make it available in every project (user
scope) instead:

```bash
mkdir -p ~/.pi/agent/extensions
cp .pi/extensions/sandbox-status.ts ~/.pi/agent/extensions/
```

To try it out without installing:

```bash
pi --extension .pi/extensions/sandbox-status.ts
```

No build step is required — pi loads TypeScript extensions directly.

## Detection

Detection prefers the `agent-sandbox --check` exit code. If the binary is not
on `PATH` (or times out), it falls back to, in order:

1. `AGENT_SANDBOX_REAL` / `AGENT_SANDBOX_CMD` environment markers set by the
   launcher
2. the execute-only control dir bind-mounted at `/run/agent-sandbox`
3. `/proc/1/comm` being `bwrap` (PID 1 inside the namespace)
