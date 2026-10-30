import crypto from "crypto";

export type PayfastEnv = "sandbox" | "live";

export function getPayfastEndpoint(env: PayfastEnv) {
  return env === "live"
    ? "https://www.payfast.co.za/eng/process"
    : "https://sandbox.payfast.co.za/eng/process";
}

export type PayfastParams = Record<string, string | number | undefined | null>;

function urlEncode(value: string) {
  return encodeURIComponent(value).replace(/%20/g, "+").replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

export function buildSignature(params: PayfastParams, passphrase?: string) {
  const entries = Object.entries(params)
    .filter(([key, val]) => key !== "signature" && val !== undefined && val !== null && val !== "");
  const base = entries.map(([k, v]) => `${k}=${urlEncode(String(v))}`).join("&");
  const withPass = passphrase ? `${base}&passphrase=${urlEncode(passphrase)}` : base;
  return crypto.createHash("md5").update(withPass).digest("hex");
}

export function buildForm(params: PayfastParams, action: string) {
  const escape = (value: string) => value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
  const inputs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `<input type=\"hidden\" name=\"${escape(k)}\" value=\"${escape(String(v))}\" />`)
    .join("");
  return `<!doctype html><html><body onload=\"document.forms[0].submit()\"><form method=\"post\" action=\"${action}\">${inputs}</form></body></html>`;
}


