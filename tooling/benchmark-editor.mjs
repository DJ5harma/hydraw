import { cpus, platform, arch } from "node:os";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Editor } from "../packages/editor/src/index.ts";

const source =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==";

function fixture(count, mixed) {
  const shapes = Array.from({ length: count }, (_, i) => {
    const bounds = {
      id: `shape-${i}`,
      x: (i % 100) * 200,
      y: Math.floor(i / 100) * 160,
      width: 100,
      height: 80,
    };
    if (mixed && i % 10 === 1) return { ...bounds, type: "image", src: source, name: "Picture" };
    if (mixed && i % 10 === 2)
      return {
        ...bounds,
        type: "ink",
        points: Array.from({ length: 20 }, (_, j) => ({ x: j / 19, y: (j % 2) * 0.8 })),
        color: "#243e33",
        strokeWidth: 2,
      };
    return { ...bounds, type: "rectangle", fill: "#e7eefb" };
  });
  const connectors = Array.from({ length: count - 1 }, (_, i) => ({
    id: `edge-${i}`,
    type: "connector",
    start: { type: "binding", shapeId: `shape-${i}` },
    end: { type: "binding", shapeId: `shape-${i + 1}` },
    color: "#243e33",
    arrowhead: "arrow",
  }));
  return { format: "hydraw", version: 1, theme: "clean", name: "Benchmark", shapes, connectors };
}

function p95(job, repetitions = 30) {
  for (let i = 0; i < 5; i++) job(i);
  const durations = [];
  for (let i = 0; i < repetitions; i++) {
    const start = performance.now();
    job(i);
    durations.push(performance.now() - start);
  }
  durations.sort((a, b) => a - b);
  return Number(durations[Math.ceil(durations.length * 0.95) - 1].toFixed(2));
}

function benchmark(Constructor, label, count, mixed) {
  const editor = new Constructor(fixture(count, mixed));
  editor.select("shape-0");
  editor.begin({ x: 50, y: 40 });
  const preview = p95((i) => editor.move({ x: 65 + (i % 3), y: 55 }, false));
  editor.cancelGesture();
  const singleCommit = p95(() => editor.nudgeSelection(1, 0));
  editor.selectAll();
  const allCommit = p95(() => editor.nudgeSelection(1, 0), 10);
  editor.dispose?.();
  return {
    implementation: label,
    shapes: count,
    connectors: count - 1,
    fixture: mixed ? "images + ink" : "rectangles",
    previewP95Ms: preview,
    singleCommitP95Ms: singleCommit,
    allCommitP95Ms: allCommit,
  };
}

console.log(
  JSON.stringify({
    node: process.version,
    platform: platform(),
    arch: arch(),
    cpu: cpus()[0]?.model,
  }),
);
const implementations = [];
if (process.argv[2]) {
  const entry = pathToFileURL(resolve(process.argv[2], "packages/editor/src/index.ts")).href;
  implementations.push([(await import(entry)).Editor, "baseline"]);
}
implementations.push([Editor, "current"]);
const rows = [];
for (const count of [100, 1000, 5000])
  for (const mixed of [false, true])
    for (const [Constructor, label] of implementations)
      rows.push(benchmark(Constructor, label, count, mixed));
console.table(rows);
console.log(
  "Editor-only timings; includes graph validation, excludes DOM, rendering, persistence and network. Advisory, not a CI threshold.",
);
