// Minimal stand-in for Supabase's API gateway: /rest/v1 → PostgREST,
// /auth/v1 → a fake GoTrue that trusts JWTs signed with SECRET.
import http from "node:http";

import crypto from "node:crypto";
import { sign, verify } from "./jwt.mjs";

// The e2e user and how the app turns a PIN into a password (see src/lib/pin.ts).
const USER = { id: "22222222-2222-4222-8222-222222222222", email: "me@test" };
const PEPPER = process.env.PIN_PEPPER ?? "";
let pinPassword = PEPPER ? crypto.createHmac("sha256", PEPPER).update("money-desk-pin:2471").digest("hex") : null;

function readBody(req) {
  return new Promise((resolve) => {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => resolve(b ? JSON.parse(b) : {}));
  });
}

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
    if (url.pathname === "/auth/v1/token" && url.searchParams.get("grant_type") === "password") {
      readBody(req).then((body) => {
        if (body.email !== USER.email || !pinPassword || body.password !== pinPassword) {
          return send(res, 400, { error: "invalid_grant", error_description: "Invalid login credentials" });
        }
        const now = Math.floor(Date.now() / 1000);
        const user = { ...USER, aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} };
        send(res, 200, {
          access_token: sign({ sub: USER.id, email: USER.email, role: "authenticated", aud: "authenticated", iat: now, exp: now + 3600 }),
          refresh_token: "r", token_type: "bearer", expires_in: 3600, expires_at: now + 3600, user,
        });
      });
      return;
    }
    if (url.pathname === "/auth/v1/user" && req.method === "PUT") {
      const claims = verify(req.headers.authorization?.replace(/^Bearer /, ""));
      if (!claims) return send(res, 401, { message: "invalid JWT" });
      readBody(req).then((body) => {
        if (body.password) pinPassword = body.password;
        send(res, 200, { id: claims.sub, email: claims.email, aud: "authenticated", role: "authenticated" });
      });
      return;
    }
    if (url.pathname === "/auth/v1/.well-known/jwks.json") return send(res, 200, { keys: [] });
    if (url.pathname === "/auth/v1/logout") return send(res, 204);
    if (url.pathname === "/auth/v1/otp") return send(res, 200, {});
    send(res, 404, { message: "not faked: " + url.pathname });
  })
  .listen(54321, () => console.log("gateway on 54321"));
