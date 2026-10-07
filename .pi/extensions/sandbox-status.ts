/**
 * Sandbox status extension - adds ONE line to the footer saying whether pi
 * is running inside the agent-sandbox (bubblewrap) or not:
 *   🔒 sandboxed   /   ⚠ no sandbox
 *
 * The built-in footer is left completely untouched: the line is injected via
 * ctx.ui.setStatus(), which the stock footer renders as an extra status line
 * below the token stats. Nothing else about the footer changes.
 *
 * Lives in .pi/extensions/ (project scope) or ~/.pi/agent/extensions/
 * (user scope); see README.md for install instructions.
 * /sandbox re-checks; /sandbox off|on toggles.
 */

import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { promisify } from "node:util";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const execFileP = promisify(execFile);

async function detectSandbox(): Promise<boolean> {
	// Preferred: the agent-sandbox CLI knows where it runs
	try {
		await execFileP("agent-sandbox", ["--check"], { timeout: 3000 });
		return true; // exit 0 => inside a sandbox
	} catch (err) {
		const e = err as NodeJS.ErrnoException & { code?: string | number; killed?: boolean };
		// Only fall back to the checks below if the binary is not available
		// (ENOENT) or did not answer in time (timeout kill).
		if (!(e.code === "ENOENT" || e.killed)) return false; // binary answered: outside
	}
	// Fallbacks (binary not available):
	// 1. Markers the agent-sandbox launcher sets for processes it starts
	if (process.env.AGENT_SANDBOX_REAL || process.env.AGENT_SANDBOX_CMD) return true;
	// 2. The sandbox bind-mounts an execute-only control dir at /run/agent-sandbox
	if (existsSync("/run/agent-sandbox")) return true;
	// 3. Inside the bubblewrap namespace PID 1 is bwrap (outside: systemd/init)
	try {
		if (readFileSync("/proc/1/comm", "utf8").trim() === "bwrap") return true;
	} catch {
		/* /proc not available */
	}
	return false;
}

export default function sandboxStatusExtension(pi: ExtensionAPI) {
	let enabled = true;

	const BOLD = "\x1b[1m";
	const GREEN = "\x1b[32m";
	const RED = "\x1b[31m";
	const RESET = "\x1b[0m";
	// ANSI codes survive the footer's status sanitizing and pi-tui is
	// ANSI-aware, so the badge renders bold green/red.
	const badge = (inside: boolean) =>
		inside ? `${BOLD}${GREEN}🔒 sandboxed${RESET}` : `${BOLD}${RED}⚠ no sandbox${RESET}`;

	const apply = async (ctx: {
		hasUI: boolean;
		ui: { setStatus(key: string, text: string | undefined): void };
	}): Promise<boolean> => {
		const inside = await detectSandbox();
		if (ctx.hasUI) {
			ctx.ui.setStatus("sandbox", enabled ? badge(inside) : undefined);
		}
		return inside;
	};

	pi.on("session_start", async (_event, ctx) => {
		const inside = await apply(ctx);
		if (ctx.hasUI) {
			ctx.ui.notify(
				inside ? "🔒 Running inside sandbox" : "⚠ NOT running inside sandbox",
				inside ? "info" : "error",
			);
		}
	});

	pi.registerCommand("sandbox", {
		description: "Re-check sandbox status (/sandbox off|on toggles the footer line)",
		handler: async (args, ctx) => {
			const arg = args.trim().toLowerCase();
			if (arg === "off") {
				enabled = false;
				if (ctx.hasUI) ctx.ui.setStatus("sandbox", undefined);
				ctx.ui.notify("Sandbox footer line disabled", "info");
				return;
			}
			if (arg === "on") enabled = true;
			const inside = await apply(ctx);
			ctx.ui.notify(
				inside ? "🔒 Running inside sandbox" : "⚠ NOT running inside sandbox",
				inside ? "info" : "error",
			);
		},
	});
}
