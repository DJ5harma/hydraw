import { readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { parseSync } from "oxc-parser";

const boundaries = {
  "packages/document": [],
  "packages/editor": ["@hydraw/document"],
  "apps/web": ["@hydraw/document", "@hydraw/editor", "react", "react-dom"],
  "apps/server": ["hono", "@hono/node-server"],
};
async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory() ? walk(join(directory, entry.name)) : join(directory, entry.name),
    ),
  );
  return files.flat().filter((file) => /\.tsx?$/.test(file));
}
const errors = [];
for (const [directory, allowed] of Object.entries(boundaries)) {
  const manifest = JSON.parse(await readFile(join(directory, "package.json"), "utf8"));
  for (const name of Object.keys(manifest.dependencies ?? {})) {
    if (!allowed.includes(name))
      errors.push(`${directory}: dependency ${name} violates its boundary`);
  }
  for (const file of await walk(join(directory, "src"))) {
    if (file.endsWith(".test.ts")) continue;
    const result = parseSync(file, await readFile(file, "utf8"));
    if (result.errors.length) errors.push(`${file}: could not parse source for boundary checks`);
    function check(specifier) {
      if (specifier.startsWith(".")) {
        const target = resolve(dirname(file), specifier);
        if (!target.startsWith(`${resolve(directory)}${sep}`))
          errors.push(`${file}: relative import escapes package: ${specifier}`);
        if (
          directory === "packages/editor" &&
          !file.endsWith("/canvas.ts") &&
          !file.includes("/src/browser/") &&
          (target.endsWith("/canvas.ts") || target.includes(`${sep}src${sep}browser${sep}`))
        )
          errors.push(`${file}: editor core cannot import its browser adapter`);
        return;
      }
      if (specifier.startsWith("node:") && directory === "apps/server") return;
      const name = specifier.startsWith("@")
        ? specifier.split("/").slice(0, 2).join("/")
        : specifier.split("/")[0];
      if (!allowed.includes(name)) errors.push(`${file}: disallowed import ${specifier}`);
      if (name.startsWith("@hydraw/") && ![name, "@hydraw/editor/canvas"].includes(specifier))
        errors.push(`${file}: use the public package entry for ${specifier}`);
    }
    function visit(node) {
      if (!node || typeof node !== "object") return;
      if (
        ["ImportDeclaration", "ExportNamedDeclaration", "ExportAllDeclaration"].includes(
          node.type,
        ) &&
        typeof node.source?.value === "string"
      )
        check(node.source.value);
      if (node.type === "ImportExpression") {
        if (typeof node.source?.value === "string") check(node.source.value);
        else errors.push(`${file}: dynamic imports must have a literal boundary-checkable source`);
      }
      if (node.type === "TSImportType" && typeof node.argument?.value === "string")
        check(node.argument.value);
      for (const value of Object.values(node)) {
        if (Array.isArray(value)) value.forEach(visit);
        else if (value && typeof value === "object" && "type" in value) visit(value);
      }
    }
    visit(result.program);
  }
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else console.log("Package boundaries verified.");
