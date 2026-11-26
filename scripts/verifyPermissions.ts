import fs from "fs";
import path from "path";
import {
  PERMISSIONS,
  PLATFORM_PERMISSION_KEYS,
  ORGANIZATION_PERMISSION_KEYS,
  INDIVIDUAL_PERMISSION_KEYS,
} from "../src/seed/permissions.catalog";

type Scope = "PLATFORM" | "ORGANIZATION" | "INDIVIDUAL";

const SCOPE_KEYS: Record<Scope, Set<string>> = {
  PLATFORM: PLATFORM_PERMISSION_KEYS,
  ORGANIZATION: ORGANIZATION_PERMISSION_KEYS,
  INDIVIDUAL: INDIVIDUAL_PERMISSION_KEYS,
};

const usedByScope: Record<Scope, Set<string>> = {
  PLATFORM: new Set(),
  ORGANIZATION: new Set(),
  INDIVIDUAL: new Set(),
};

const problems: string[] = [];
const sellerKeys = new Set<string>();
const sourceRoot = path.resolve(__dirname, "..", "src");

const listTsFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "generated" || entry.name === "node_modules") return [];
      return listTsFiles(fullPath);
    }
    return entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")
      ? [fullPath]
      : [];
  });

const scopedCallPattern =
  /\b(?:requirePermission|checkPermission)\(\s*PermissionScope\.(PLATFORM|ORGANIZATION|INDIVIDUAL)\s*,\s*((?:["'][^"'\r\n]+["']\s*,?\s*)+)\)/g;
const sellerCallPattern =
  /\bcheckSellerPermission\(\s*((?:["'][^"'\r\n]+["']\s*,?\s*)+)\)/g;
const quotedKeyPattern = /["']([^"'\r\n]+)["']/g;

const lineAt = (content: string, index: number): number =>
  content.slice(0, index).split("\n").length;

const location = (file: string, line: number): string =>
  `${path.relative(sourceRoot, file).replace(/\\/g, "/")}:${line}`;

const validateKey = (
  key: string,
  scope: Scope,
  file: string,
  line: number
): void => {
  if (!SCOPE_KEYS[scope].has(key)) {
    problems.push(
      `${location(file, line)} uses unknown ${scope} permission "${key}"`
    );
    return;
  }
  usedByScope[scope].add(key);
};

const validateSellerKey = (
  key: string,
  file: string,
  line: number
): void => {
  const inOrganization = ORGANIZATION_PERMISSION_KEYS.has(key);
  const inIndividual = INDIVIDUAL_PERMISSION_KEYS.has(key);

  if (!inOrganization && !inIndividual) {
    problems.push(
      `${location(file, line)} uses unknown seller permission "${key}"`
    );
    return;
  }

  if (inOrganization) usedByScope.ORGANIZATION.add(key);
  if (inIndividual) usedByScope.INDIVIDUAL.add(key);
  sellerKeys.add(key);
};

const seenDefinitions = new Set<string>();
for (const permission of PERMISSIONS) {
  const key = `${permission.scope}:${permission.resource}:${permission.action}`;
  if (seenDefinitions.has(key)) {
    problems.push(`Duplicate permission definition "${key}"`);
  }
  seenDefinitions.add(key);
}

for (const file of listTsFiles(sourceRoot)) {
  const content = fs.readFileSync(file, "utf8");

  for (const match of content.matchAll(scopedCallPattern)) {
    const scope = match[1] as Scope;
    const line = lineAt(content, match.index ?? 0);
    for (const keyMatch of match[2].matchAll(quotedKeyPattern)) {
      validateKey(keyMatch[1], scope, file, line);
    }
  }

  for (const match of content.matchAll(sellerCallPattern)) {
    const line = lineAt(content, match.index ?? 0);
    for (const keyMatch of match[1].matchAll(quotedKeyPattern)) {
      validateSellerKey(keyMatch[1], file, line);
    }
  }
}

const countByScope = (scope: Scope): number =>
  PERMISSIONS.filter((permission) => permission.scope === scope).length;

const unused: string[] = [];
for (const scope of Object.keys(SCOPE_KEYS) as Scope[]) {
  for (const key of SCOPE_KEYS[scope]) {
    if (!usedByScope[scope].has(key)) unused.push(`${scope}:${key}`);
  }
}

console.log(
  `Permissions: ${PERMISSIONS.length} (PLATFORM ${countByScope("PLATFORM")}, ORGANIZATION ${countByScope("ORGANIZATION")}, INDIVIDUAL ${countByScope("INDIVIDUAL")})`
);
console.log(
  `Guard keys used: PLATFORM ${usedByScope.PLATFORM.size}, ORGANIZATION ${usedByScope.ORGANIZATION.size}, INDIVIDUAL ${usedByScope.INDIVIDUAL.size}, seller ${sellerKeys.size}`
);
console.log(`Unused catalogue keys: ${unused.length}`);

if (problems.length > 0) {
  for (const problem of problems) console.error(problem);
  process.exit(1);
}

console.log("Permission catalogue matches route guards.");
