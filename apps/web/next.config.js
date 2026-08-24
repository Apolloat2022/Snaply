const path = require("path");

// In this pnpm workspace, the generated Prisma client (including its native
// query-engine binary) lives in the root node_modules/.pnpm virtual store,
// reached only transitively via @snaply-app/db — not a path Next.js's static
// file-tracing can discover, since the engine binary is loaded dynamically
// at runtime rather than via a traceable require(). Without this, Vercel's
// deployed function ships without the engine file and Prisma throws
// "could not locate the Query Engine" on every request.
/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(__dirname, "../.."),
  outputFileTracingIncludes: {
    "/*": ["../../node_modules/.pnpm/@prisma+client@*/node_modules/.prisma/client/**/*"],
  },
};

module.exports = nextConfig;
