/**
 * Vercel's Ignored Build Step (`ignoreCommand` in vercel.json): exit 0 skips the
 * deployment, exit 1 builds it.
 *
 * Skips preview deployments of `claude/*` branches. Each preview stores a full
 * build, and agent branches push often; their changes are checked by CI on the
 * pull request instead. Production always builds.
 *
 * Plain Node, not tsx: Vercel runs this before installing dependencies. Needs
 * "Automatically expose System Environment Variables" on; without them both
 * variables read empty and every deployment builds.
 */
const env = process.env.VERCEL_ENV ?? "";
const ref = process.env.VERCEL_GIT_COMMIT_REF ?? "";
const skip = env === "preview" && ref.startsWith("claude/");

console.log(skip
  ? `[ignore-build] Skipping preview for ${ref}.`
  : `[ignore-build] Building ${env || "unknown environment"} for ${ref || "unknown branch"}.`);
process.exit(skip ? 0 : 1);
