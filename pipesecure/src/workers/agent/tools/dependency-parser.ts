import fs from "fs/promises";
import path from "path";
import type { DependencyInfo } from "../types";

export async function parseDependencyManifests(repoPath: string): Promise<DependencyInfo[]> {
  const deps: DependencyInfo[] = [];

  const parsers: Array<{
    file: string;
    parse: (content: string, filePath: string) => DependencyInfo[];
  }> = [
    { file: "package.json", parse: parsePackageJson },
    { file: "requirements.txt", parse: parseRequirementsTxt },
    { file: "Gemfile.lock", parse: parseGemfileLock },
    { file: "go.sum", parse: parseGoSum },
    { file: "Cargo.lock", parse: parseCargoLock },
    { file: "pom.xml", parse: parsePomXml },
    { file: "composer.lock", parse: parseComposerLock },
  ];

  for (const parser of parsers) {
    const filePath = path.join(repoPath, parser.file);
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const parsed = parser.parse(content, parser.file);
      deps.push(...parsed);
    } catch {
      // file doesn't exist
    }
  }

  // Also check for package-lock.json for more precise versions
  try {
    const lockPath = path.join(repoPath, "package-lock.json");
    const content = await fs.readFile(lockPath, "utf-8");
    const lockDeps = parsePackageLockJson(content);
    // Replace npm deps with more precise lock file versions
    if (lockDeps.length > 0) {
      const npmIndices = deps.reduce<number[]>((acc, d, i) => {
        if (d.ecosystem === "npm") acc.push(i);
        return acc;
      }, []);
      for (const idx of npmIndices.reverse()) {
        deps.splice(idx, 1);
      }
      deps.push(...lockDeps);
    }
  } catch {
    // no lock file
  }

  return deps;
}

function parsePackageJson(content: string, filePath: string): DependencyInfo[] {
  const deps: DependencyInfo[] = [];
  try {
    const pkg = JSON.parse(content);
    for (const [name, version] of Object.entries(pkg.dependencies || {})) {
      const cleanVersion = String(version).replace(/^[\^~>=<]+/, "");
      if (cleanVersion && /^\d/.test(cleanVersion)) {
        deps.push({ name, version: cleanVersion, ecosystem: "npm", manifestFile: filePath });
      }
    }
    for (const [name, version] of Object.entries(pkg.devDependencies || {})) {
      const cleanVersion = String(version).replace(/^[\^~>=<]+/, "");
      if (cleanVersion && /^\d/.test(cleanVersion)) {
        deps.push({ name, version: cleanVersion, ecosystem: "npm", manifestFile: filePath });
      }
    }
  } catch {
    // invalid JSON
  }
  return deps;
}

function parsePackageLockJson(content: string): DependencyInfo[] {
  const deps: DependencyInfo[] = [];
  try {
    const lock = JSON.parse(content);
    const packages = lock.packages || {};
    for (const [pkgPath, info] of Object.entries(packages)) {
      if (!pkgPath || pkgPath === "") continue;
      const name = pkgPath.replace(/^node_modules\//, "");
      const version = (info as { version?: string }).version;
      if (name && version) {
        deps.push({ name, version, ecosystem: "npm", manifestFile: "package-lock.json" });
      }
    }
  } catch {
    // invalid JSON
  }
  return deps;
}

function parseRequirementsTxt(content: string, filePath: string): DependencyInfo[] {
  const deps: DependencyInfo[] = [];
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("-")) continue;
    const match = trimmed.match(/^([a-zA-Z0-9_.-]+)==([^\s;#]+)/);
    if (match) {
      deps.push({ name: match[1], version: match[2], ecosystem: "pypi", manifestFile: filePath });
    }
  }
  return deps;
}

function parseGemfileLock(content: string, filePath: string): DependencyInfo[] {
  const deps: DependencyInfo[] = [];
  const lines = content.split("\n");
  let inGems = false;
  for (const line of lines) {
    if (line.trim() === "GEM") { inGems = true; continue; }
    if (line.trim() === "" && inGems) { inGems = false; continue; }
    if (!inGems) continue;
    const match = line.match(/^\s{4}(\S+)\s+\((\S+)\)/);
    if (match) {
      deps.push({ name: match[1], version: match[2], ecosystem: "ruby", manifestFile: filePath });
    }
  }
  return deps;
}

function parseGoSum(content: string): DependencyInfo[] {
  const deps: DependencyInfo[] = [];
  const seen = new Set<string>();
  for (const line of content.split("\n")) {
    const match = line.match(/^(\S+)\s+v([^\s/]+)/);
    if (match) {
      const key = `${match[1]}@${match[2]}`;
      if (!seen.has(key)) {
        seen.add(key);
        deps.push({ name: match[1], version: match[2], ecosystem: "go", manifestFile: "go.sum" });
      }
    }
  }
  return deps;
}

function parseCargoLock(content: string): DependencyInfo[] {
  const deps: DependencyInfo[] = [];
  const packageBlocks = content.split("[[package]]");
  for (const block of packageBlocks) {
    const nameMatch = block.match(/name\s*=\s*"([^"]+)"/);
    const versionMatch = block.match(/version\s*=\s*"([^"]+)"/);
    if (nameMatch && versionMatch) {
      deps.push({
        name: nameMatch[1],
        version: versionMatch[1],
        ecosystem: "cargo",
        manifestFile: "Cargo.lock",
      });
    }
  }
  return deps;
}

function parsePomXml(content: string, filePath: string): DependencyInfo[] {
  const deps: DependencyInfo[] = [];
  const depRegex = /<dependency>\s*<groupId>([^<]+)<\/groupId>\s*<artifactId>([^<]+)<\/artifactId>\s*<version>([^<]+)<\/version>/g;
  let match;
  while ((match = depRegex.exec(content)) !== null) {
    deps.push({
      name: `${match[1]}:${match[2]}`,
      version: match[3],
      ecosystem: "maven",
      manifestFile: filePath,
    });
  }
  return deps;
}

function parseComposerLock(content: string): DependencyInfo[] {
  const deps: DependencyInfo[] = [];
  try {
    const lock = JSON.parse(content);
    for (const pkg of lock.packages || []) {
      if (pkg.name && pkg.version) {
        deps.push({
          name: pkg.name,
          version: pkg.version.replace(/^v/, ""),
          ecosystem: "packagist",
          manifestFile: "composer.lock",
        });
      }
    }
  } catch {
    // invalid JSON
  }
  return deps;
}
