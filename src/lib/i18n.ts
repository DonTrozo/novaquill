import { portuguese } from "./translations";

export type Locale = "en" | "pt";
export type Translator = (message: string, values?: Record<string, string | number>) => string;

export function preferredLocale(languages: readonly string[]): Locale {
  for (const language of languages) {
    const base = language.trim().toLowerCase().split(/[-_]/)[0];
    if (base === "en" || base === "pt") return base;
  }
  return "en";
}

export function localeFromHeader(header: string | null): Locale {
  const preferences = (header ?? "").split(",").map((entry, index) => {
    const [language, ...parameters] = entry.trim().split(";");
    const quality = parameters.find((value) => value.trim().startsWith("q="));
    return { language, weight: quality ? Number(quality.trim().slice(2)) : 1, index };
  }).filter((entry) => Number.isFinite(entry.weight) && entry.weight > 0 && entry.weight <= 1)
    .sort((a, b) => b.weight - a.weight || a.index - b.index);
  return preferredLocale(preferences.map((entry) => entry.language));
}

export function createTranslator(locale: Locale): Translator {
  return (message, values) => {
    const translated = locale === "pt" ? portuguese[message] ?? message : message;
    return translated.replace(/\{(\w+)\}/g, (token, key: string) => values?.[key] == null ? token : String(values[key]));
  };
}
