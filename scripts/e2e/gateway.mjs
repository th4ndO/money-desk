// Minimal stand-in for Supabase's API gateway: /rest/v1 → PostgREST,
// /auth/v1 → a fake GoTrue that trusts JWTs signed with SECRET.
import http from "node:http";

import { verify } from "./jwt.mjs";

const send = (res, code, body) => {
  res.writeHead(code, { "content-type": "application/json" });
  res.end(body === undefined ? "" : JSON.stringify(body));
};

http
  .createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    if (url.pathname.startsWith("/rest/v1")) {
      const target = url.pathname.replace("/rest/v1", "") + url.search;
      const headers = { ...req.headers, host: "127.0.0.1:3001" };
      const up = http.request({ host: "127.0.0.1", port: 3001, path: target || "/", method: req.method, headers }, (r) => {
        res.writeHead(r.statusCode, r.headers);
        r.pipe(res);
      });
      req.pipe(up);
      return;
    }
    if (url.pathname === "/auth/v1/user") {
      const claims = verify(req.headers.authorization?.replace(/^Bearer /, ""));
      if (!claims || claims.role !== "authenticated") return send(res, 401, { message: "invalid JWT" });
      return send(res, 200, { id: claims.sub, aud: "authenticated", role: "authenticated", email: claims.email, app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" });
    }
    if (url.pathname === "/auth/v1/.well-known/jwks.json") return send(res, 200, { keys: [] });
    if (url.pathname === "/auth/v1/logout") return send(res, 204);
    if (url.pathname === "/auth/v1/otp") return send(res, 200, {});
    send(res, 404, { message: "not faked: " + url.pathname });
  })
  .listen(54321, () => console.log("gateway on 54321"));
