import serverPromise from "../build/server/index.js";

// Vercel serverless function handler
export default async function handler(req) {
  // Await the server promise to get the actual Hono instance
  const server = await serverPromise;

  // Build a complete URL from Vercel's request
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host =
    req.headers["x-forwarded-host"] || req.headers.host || "localhost";
  const url = `${protocol}://${host}${req.url || "/"}`;

  // Convert to Web Request
  const request = new Request(url, {
    method: req.method,
    headers: req.headers,
    body: req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined,
  });

  // Call the Hono server's fetch method
  return await server.fetch(request);
}
