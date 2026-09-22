/** Typecheck complete MDX examples marked `check` against the installed package. */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const virtual = new Map();
const labels = new Map();
function visit(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) visit(file);
    else if (file.endsWith(".mdx")) {
      const source = fs.readFileSync(file, "utf8");
      const blocks = /```(?:typescript|tsx|ts) title="([^"]+)" check\n([\s\S]*?)\n```/g;
      for (const match of source.matchAll(blocks)) {
        const location = path.parse(match[1]);
        const name = path.join(root, location.dir, `__docs_${virtual.size}${location.ext}`);
        virtual.set(name, match[2]);
        labels.set(name, `${path.relative(root, file)} (${match[1]})`);
      }
    }
  }
}
visit(path.join(root, "app/docs"));
if (!virtual.size) throw new Error("No checked documentation examples found");
const configFile = ts.readConfigFile(path.join(root, "tsconfig.json"), ts.sys.readFile);
if (configFile.error) throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n"));
const config = ts.parseJsonConfigFileContent(configFile.config, ts.sys, root);
const options = { ...config.options, noEmit: true, incremental: false, plugins: [] };
const host = ts.createCompilerHost(options);
const readFile = host.readFile.bind(host);
const fileExists = host.fileExists.bind(host);
host.readFile = (file) => virtual.get(file) ?? readFile(file);
host.fileExists = (file) => virtual.has(file) || fileExists(file);
const program = ts.createProgram([...virtual.keys()], options, host);
const diagnostics = [...config.errors, ...ts.getPreEmitDiagnostics(program)];
for (const diagnostic of diagnostics) {
  const file = diagnostic.file;
  const where = file && diagnostic.start !== undefined
    ? `${labels.get(file.fileName) ?? file.fileName}:${file.getLineAndCharacterOfPosition(diagnostic.start).line + 1}`
    : "TypeScript";
  console.error(`${where}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}`);
}
if (diagnostics.length) process.exitCode = 1;
else console.log(`Typechecked ${virtual.size} documentation examples against the installed booking package.`);
