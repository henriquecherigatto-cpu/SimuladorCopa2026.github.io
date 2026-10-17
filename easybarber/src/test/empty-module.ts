// Stand-in for the "server-only" package under Vitest (plain Node
// module resolution). Next.js resolves "server-only"/"client-only" to
// internal stubs via its own bundler — there is no real npm package
// on disk to resolve against outside of Next's build, so
// vitest.config.ts aliases it here instead.
export {};
