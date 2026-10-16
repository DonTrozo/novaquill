import { headers } from "next/headers";
import { localeFromHeader } from "./i18n";

export async function requestLocale() {
  return localeFromHeader((await headers()).get("accept-language"));
}
