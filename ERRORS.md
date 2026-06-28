## ERROR1 Frontend Tests / Lint (push) 
Run pnpm lint
$ tsc --noEmit --skipLibCheck && biome check src
src/themes/everforest-dark.css format ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  × Formatter would have printed the following content:
  
     2  2 │     /* Everforest Dark Theme - Warm & Comforting Slate Green */
     3  3 │     --background: oklch(0.246 0.016 142); /* #2b3339 */
     4    │ - ··--foreground:·oklch(0.814·0.026·84);··/*·#d3c6aa·*/
        4 │ + ··--foreground:·oklch(0.814·0.026·84);·/*·#d3c6aa·*/
     5  5 │   
     6    │ - ··--card:·oklch(0.207·0.012·142);·······/*·#232a2e·(Hard)·*/
        6 │ + ··--card:·oklch(0.207·0.012·142);·/*·#232a2e·(Hard)·*/
     7  7 │     --card-foreground: oklch(0.814 0.026 84);
     8  8 │   
     9    │ - ··--popover:·oklch(0.283·0.019·142);····/*·#323c41·(Soft)·*/
        9 │ + ··--popover:·oklch(0.283·0.019·142);·/*·#323c41·(Soft)·*/
    10 10 │     --popover-foreground: oklch(0.85 0.026 84);
    11 11 │   
  

src/utils/theme.ts:1:1 assist/source/organizeImports  FIXABLE  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  × The imports and exports are not sorted.
  
  > 1 │ import defaultDarkThemeContent from "../themes/default-dark.css?raw";
      │ ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    2 │ import paperThemeContent from "../themes/paper.css?raw";
    3 │ import everforestDarkThemeContent from "../themes/everforest-dark.css?raw";
  
  i Safe fix: Organize Imports (Biome)
  
      1   1 │   import defaultDarkThemeContent from "../themes/default-dark.css?raw";
      2     │ - import·paperThemeContent·from·"../themes/paper.css?raw";
      3     │ - import·everforestDarkThemeContent·from·"../themes/everforest-dark.css?raw";
          2 │ + import·everforestDarkThemeContent·from·"../themes/everforest-dark.css?raw";
          3 │ + import·paperThemeContent·from·"../themes/paper.css?raw";
      4   4 │   
      5   5 │   // ============================================================================
  

Checked 406 files in 452ms. No fixes applied.
Found 2 errors.
check ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  × Some errors were emitted while running checks.
  

 ELIFECYCLE  Command failed with exit code 1.
Error: Process completed with exit code 1.

## ERROR2 Backend Tests / Static Checks (push)

run golangci-lint
  Running [/home/runner/golangci-lint-2.11.3-linux-amd64/golangci-lint config path] in [/home/runner/work/MemosNote/MemosNote] ...
  Running [/home/runner/golangci-lint-2.11.3-linux-amd64/golangci-lint config verify] in [/home/runner/work/MemosNote/MemosNote] ...
  Running [/home/runner/golangci-lint-2.11.3-linux-amd64/golangci-lint run  --timeout=3m] in [/home/runner/work/MemosNote/MemosNote] ...
  Error: server/router/api/v1/netease.go:31:1: Comment should end in a period (godot)
  // pkcs7Padding pads data to aes block size
  ^
  Error: server/router/api/v1/netease.go:38:1: Comment should end in a period (godot)
  // aesEncrypt encrypts content using AES-128-CBC
  ^
  Error: server/router/api/v1/netease.go:51:1: Comment should end in a period (godot)
  // rsaEncrypt performs plain raw RSA encryption with reversed bytes
  ^
  Error: server/router/api/v1/netease.go:19:1: File is not properly formatted (goimports)
  	"github.com/labstack/echo/v5"
  ^
  Error: server/router/api/v1/netease.go:236:3: var-naming: var userIdVal should be userIDVal (revive)
  		userIdVal, exists := profileMap["userId"]
  		^
  Error: server/router/api/v1/netease.go:241:3: var-naming: var userIdFloat should be userIDFloat (revive)
  		userIdFloat, ok := userIdVal.(float64)
  		^
  Error: server/router/api/v1/netease.go:245:3: var-naming: var userId should be userID (revive)
  		userId := int64(userIdFloat)
  		^
  Error: server/router/api/v1/netease.go:258:3: var-naming: var playlistId should be playlistID (revive)
  		playlistId := c.QueryParam("playlist_id")
  		^
  Error: server/router/api/v1/netease.go:277:3: var-naming: var songId should be songID (revive)
  		songId := c.QueryParam("song_id")
  		^
  9 issues:
  * godot: 3
  * goimports: 1
  * revive: 5
  
  Error: issues found
  Ran golangci-lint in 92120ms

## ERROR3 Build Canary Image / build-push (linux/amd64) (push) 

Node 20 is being deprecated. This workflow is running with Node 24 by default. If you need to temporarily use Node 20, you can set the ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION=true environment variable. For more information see: https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/
Run docker/login-action@v3
(node:3281) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
Error: Username and password required

## ERROR4 Build Canary Image / build-push (linux/arm64) (push) 

Node 20 is being deprecated. This workflow is running with Node 24 by default. If you need to temporarily use Node 20, you can set the ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION=true environment variable. For more information see: https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/
Run docker/login-action@v3
(node:3218) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
Error: Username and password required

## ERROR5 Build Desktop App / release (windows-latest) (push)

Run cd web
warn: This version of pnpm requires at least Node.js v22.13
warn: The current version of Node.js is v20.20.2
warn: Visit https://r.pnpm.io/comp to see the list of past pnpm versions with respective Node.js version support.
node:internal/modules/cjs/loader:1031
      throw new ERR_UNKNOWN_BUILTIN_MODULE(request);
            ^

Error [ERR_UNKNOWN_BUILTIN_MODULE]: No such built-in module: node:sqlite
    at Module._load (node:internal/modules/cjs/loader:1031:13)
    at Module.require (node:internal/modules/cjs/loader:1289:19)
    at require (node:internal/modules/helpers:182:18)
    at ../store/index/lib/index.js (file:///C:/Users/runneradmin/setup-pnpm/node_modules/.pnpm/pnpm@11.0.1/node_modules/pnpm/dist/pnpm.mjs:16035:25)
    at __init (file:///C:/Users/runneradmin/setup-pnpm/node_modules/.pnpm/pnpm@11.0.1/node_modules/pnpm/dist/pnpm.mjs:15:56)
    at ../resolving/npm-resolver/lib/index.js (file:///C:/Users/runneradmin/setup-pnpm/node_modules/.pnpm/pnpm@11.0.1/node_modules/pnpm/dist/pnpm.mjs:26731:5)
    at __init (file:///C:/Users/runneradmin/setup-pnpm/node_modules/.pnpm/pnpm@11.0.1/node_modules/pnpm/dist/pnpm.mjs:15:56)
    at ../workspace/projects-graph/lib/index.js (file:///C:/Users/runneradmin/setup-pnpm/node_modules/.pnpm/pnpm@11.0.1/node_modules/pnpm/dist/pnpm.mjs:26877:5)
    at __init (file:///C:/Users/runneradmin/setup-pnpm/node_modules/.pnpm/pnpm@11.0.1/node_modules/pnpm/dist/pnpm.mjs:15:56)
    at ../workspace/projects-filter/lib/index.js (file:///C:/Users/runneradmin/setup-pnpm/node_modules/.pnpm/pnpm@11.0.1/node_modules/pnpm/dist/pnpm.mjs:42782:5) {
  code: 'ERR_UNKNOWN_BUILTIN_MODULE'
}

Node.js v20.20.2
warn: This version of pnpm requires at least Node.js v22.13
warn: The current version of Node.js is v20.20.2
warn: Visit https://r.pnpm.io/comp to see the list of past pnpm versions with respective Node.js version support.
node:internal/modules/cjs/loader:1031
      throw new ERR_UNKNOWN_BUILTIN_MODULE(request);
            ^

Error [ERR_UNKNOWN_BUILTIN_MODULE]: No such built-in module: node:sqlite
    at Module._load (node:internal/modules/cjs/loader:1031:13)
    at Module.require (node:internal/modules/cjs/loader:1289:19)
    at require (node:internal/modules/helpers:182:18)
    at ../store/index/lib/index.js (file:///C:/Users/runneradmin/setup-pnpm/node_modules/.pnpm/pnpm@11.0.1/node_modules/pnpm/dist/pnpm.mjs:16035:25)
    at __init (file:///C:/Users/runneradmin/setup-pnpm/node_modules/.pnpm/pnpm@11.0.1/node_modules/pnpm/dist/pnpm.mjs:15:56)
    at ../resolving/npm-resolver/lib/index.js (file:///C:/Users/runneradmin/setup-pnpm/node_modules/.pnpm/pnpm@11.0.1/node_modules/pnpm/dist/pnpm.mjs:26731:5)
    at __init (file:///C:/Users/runneradmin/setup-pnpm/node_modules/.pnpm/pnpm@11.0.1/node_modules/pnpm/dist/pnpm.mjs:15:56)
    at ../workspace/projects-graph/lib/index.js (file:///C:/Users/runneradmin/setup-pnpm/node_modules/.pnpm/pnpm@11.0.1/node_modules/pnpm/dist/pnpm.mjs:26877:5)
    at __init (file:///C:/Users/runneradmin/setup-pnpm/node_modules/.pnpm/pnpm@11.0.1/node_modules/pnpm/dist/pnpm.mjs:15:56)
    at ../workspace/projects-filter/lib/index.js (file:///C:/Users/runneradmin/setup-pnpm/node_modules/.pnpm/pnpm@11.0.1/node_modules/pnpm/dist/pnpm.mjs:42782:5) {
  code: 'ERR_UNKNOWN_BUILTIN_MODULE'
}

Node.js v20.20.2
Error: Process completed with exit code 1.

## ERROR6 Release Please / release-please (push) 

RELEASE_PLEASE_TOKEN must be set to a fine-grained PAT so release-please tags can trigger release.yml.
Error: Process completed with exit code 1.
