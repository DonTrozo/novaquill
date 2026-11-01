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

export function buildForm(params: PayfastParams, action: string, review?: { html: string; acceptLabel: string; buttonLabel: string; title: string; locale: "en" | "pt" }) {
  const escape = (value: string) => value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
  const inputs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `<input type=\"hidden\" name=\"${escape(k)}\" value=\"${escape(String(v))}\" />`)
    .join("");
  if (review) {
    // Review HTML comes only from the escaped policy renderer; payment fields retain their signed order.
    return `<!doctype html><html lang="${review.locale}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(review.title)}</title><style>body{font:16px/1.65 system-ui,sans-serif;max-width:900px;margin:auto;padding:24px;color:#202020}h1,h2,h3{line-height:1.3}section{margin:28px 0}label{display:flex;gap:12px;align-items:flex-start}input[type=checkbox]{margin-top:6px}button{padding:12px 20px;margin-top:20px;font:inherit;background:#075e79;color:white;border:0;border-radius:6px}p{overflow-wrap:anywhere}a{color:#075e79}</style><body><main><h1>${escape(review.title)}</h1><form method="post" action="${escape(action)}">${inputs}${review.html}<label><input type="checkbox" required><span>${escape(review.acceptLabel)}</span></label><button type="submit">${escape(review.buttonLabel)}</button></form></main></body></html>`;
  }
  return `<!doctype html><html><body onload=\"document.forms[0].submit()\"><form method=\"post\" action=\"${action}\">${inputs}</form></body></html>`;
}


