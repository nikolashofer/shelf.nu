import serverPromise from "../build/server/index.js";

// Cache the resolved server instance
let serverInstance = null;

// Vercel Functions format: export an object with a fetch method
export default {
  async fetch(request) {
    // Resolve and cache the server instance on first request
    if (!serverInstance) {
      serverInstance = await serverPromise;
    }

    // Forward the request directly to the Hono server
    return await serverInstance.fetch(request);
  },
};
