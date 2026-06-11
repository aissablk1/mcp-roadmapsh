// Single source of truth for the package version, read at runtime from
// package.json. Using createRequire (rather than a JSON import) keeps tsconfig's
// rootDir at "src", so the build still emits dist/index.js (not dist/src/...).
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// From dist/version.js, ../package.json resolves to the repo root manifest.
const pkg = require("../package.json") as { version: string };

export const VERSION: string = pkg.version;
