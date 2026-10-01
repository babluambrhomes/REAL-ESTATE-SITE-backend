/**
 * Static check that route guards only reference permissions that exist.
 *
 * Run with:  npm run prisma:verify-permissions
 *
 * Why this is a script and not a type: permission keys are strings
 * ("property:update"), so a typo is invisible to tsc. The failure mode is
 * nasty — `checkPermission` rejects unknown keys with a 500 on the first
 * request, which in practice means a route that nobody can use and a stack
 * trace pointing at the middleware rather than the typo.
 *
 * Two things are checked:
 *
 *   1. Every key passed to requirePermission/checkPermission exists in the
 *      catalogue, for the scope the route declares. `property:read` is valid
 *      in both scopes, so scope is part of the check, not decoration.
 *   2. Every permission in the catalogue is reachable from at least one
 *      route. An unused permission is not automatically wrong — some are for
 *      the admin UI — but a large set of them usually means the catalogue and
 *      the routes were written independently and have drifted.
 *
 * This reads route files as text on purpose: importing them would boot the
 * Express app and open database connections just to parse source.
 */

import fs from "fs";
import path from "path";
import {
  PERMISSIONS,
  PLATFORM_PERMISSION_KEYS,
  ORGANIZATION_PERMISSION_KEYS,
} from "./permissions.catalog";

const ROUTE_DIR = path.join(__dirname, "..", "modules");

interface GuardUsage {
  file: string;
  scope: string | null;
  keys: string[];
  /** Multi-line calls, where the key list is on following lines. */
  isMultiline: boolean;
}

/**
 * Finds `requirePermission(` / `checkPermission(` calls and pulls out the
 * scope argument plus every quoted key.
 *
 * Deliberately a plain text scan rather than an AST walk: it only has to be
 * right about calls to two known function names, and a false negative here
 * means a missed typo check, not a wrong verdict about the schema.
 */
const collectGuardUsages = (): GuardUsage[] => {
  const usages: GuardUsage[] = [];

  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        walk(full);
        continue;
      }

      if (!entry.name.endsWith(".route.ts")) continue;

      const source = fs.readFileSync(full, "utf8");
      const callPattern = /(?:requirePermission|checkPermission)\s*\(/g;

      let match: RegExpExecArray | null;
      while ((match = callPattern.exec(source)) !== null) {
        const startIndex = match.index + match[0].length;
        const args = readBalancedArgs(source, startIndex);

        if (!args) continue;

        const scopeMatch = args.text.match(
          /PermissionScope\.([A-Z]+)/
        );

        const keyMatches = [
          ...args.text.matchAll(/"([a-zA-Z]+:[a-zA-Z]+)"/g),
        ].map((m) => m[1]);

        usages.push({
          file: path.relative(process.cwd(), full),
          scope: scopeMatch ? scopeMatch[1] : null,
          keys: keyMatches,
          isMultiline: args.text.includes("\n"),
        });
      }
    }
  };

  walk(ROUTE_DIR);
  return usages;
};

/**
 * Reads a balanced argument list starting at an opening paren.
 *
 * Returns the raw text plus how many chars were consumed, so the caller can
 * move past this call instead of re-matching nested parens forever.
 */
const readBalancedArgs = (
  source: string,
  startIndex: number
): { text: string; length: number } | null => {
  let depth = 1;
  let i = startIndex;

  while (i < source.length && depth > 0) {
    const ch = source[i];
    if (ch === "(") depth += 1;
    else if (ch === ")") depth -= 1;
    if (depth > 0) i += 1;
  }

  if (depth !== 0) return null;
  return { text: source.slice(startIndex, i), length: i - startIndex + 1 };
};

const main = (): void => {
  const problems: string[] = [];
  const usages = collectGuardUsages();

  // --- Catalogue integrity ------------------------------------------------
  const seen = new Set<string>();
  for (const p of PERMISSIONS) {
    const key = `${p.scope}/${p.resource}/${p.action}`;
    if (seen.has(key)) problems.push(`duplicate permission in catalogue: ${key}`);
    seen.add(key);
  }

  // --- Route guards -------------------------------------------------------
  const usedKeys = new Set<string>();

  for (const usage of usages) {
    if (usage.keys.length === 0) {
      problems.push(
        `${usage.file}: found a permission guard but could not read any "resource:action" keys${usage.isMultiline ? "" : ""} — check the call shape`
      );
      continue;
    }

    const allowed =
      usage.scope === "PLATFORM"
        ? PLATFORM_PERMISSION_KEYS
        : usage.scope === "ORGANIZATION"
          ? ORGANIZATION_PERMISSION_KEYS
          : null;

    if (!allowed) {
      problems.push(
        `${usage.file}: permission guard without a PermissionScope argument — keys ${usage.keys.join(", ")}`
      );
      continue;
    }

    for (const key of usage.keys) {
      usedKeys.add(`${usage.scope}/${key}`);
      if (!allowed.has(key)) {
        problems.push(
          `${usage.file}: "${key}" is not a valid ${usage.scope} permission`
        );
      }
    }
  }

  // --- Report -------------------------------------------------------------
  const platformCount = PERMISSIONS.filter((p) => p.scope === "PLATFORM").length;
  const orgCount = PERMISSIONS.length - platformCount;

  console.log(`permissions in catalogue : ${PERMISSIONS.length}`);
  console.log(`  PLATFORM               : ${platformCount}`);
  console.log(`  ORGANIZATION           : ${orgCount}`);
  console.log(`route guards found       : ${usages.length}`);
  console.log(`distinct permissions used: ${usedKeys.size}`);

  const unused = PERMISSIONS.filter(
    (p) => !usedKeys.has(`${p.scope}/${p.resource}:${p.action}`)
  );
  if (unused.length > 0) {
    console.log(
      `\nnot referenced by any route (${unused.length}) — fine if the admin UI or a future route uses them:`
    );
    for (const p of unused) {
      console.log(`  ${p.scope}/${p.resource}:${p.action}`);
    }
  }

  if (problems.length > 0) {
    console.error(`\n${problems.length} problem(s):`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }

  console.log("\nall route guards reference real permissions");
};

main();
