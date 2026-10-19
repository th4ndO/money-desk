import crypto from "node:crypto";

export const SECRET = "e2e-secret-that-is-at-least-32-characters-long";
const b64u = (b) => Buffer.from(b).toString("base64url");

export function sign(payload) {
  const h = b64u(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const p = b64u(JSON.stringify(payload));
  const s = crypto.createHmac("sha256", SECRET).update(`${h}.${p}`).digest("base64url");
  return `${h}.${p}.${s}`;
}

export function verify(token) {
  const [h, p, s] = (token ?? "").split(".");
  if (!s) return null;
  const good = crypto.createHmac("sha256", SECRET).update(`${h}.${p}`).digest("base64url");
  return good === s ? JSON.parse(Buffer.from(p, "base64url").toString()) : null;
}
