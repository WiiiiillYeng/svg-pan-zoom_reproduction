const path = require("path");
const { spawn } = require("child_process");

const verifyRoot = __dirname;
const serverRoot = path.join(verifyRoot, "server-root");
const port = process.argv[2] || "3139";

function resolvePackageServer() {
  const packageJson = require.resolve("svg-pan-zoom/package.json", {
    paths: [verifyRoot, process.cwd()],
  });
  return path.join(path.dirname(packageJson), "server.js");
}

const serverJs = resolvePackageServer();
const shim = path.join(verifyRoot, "util-puts-shim.js");

const child = spawn(process.execPath, ["-r", shim, serverJs, port], {
  cwd: serverRoot,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exitCode = code || 0;
  }
});
