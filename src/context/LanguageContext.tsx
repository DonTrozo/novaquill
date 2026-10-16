"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { createTranslator, preferredLocale, type Locale, type Translator } from "@/lib/i18n";

export const LanguageContext = createContext<{ locale: Locale; t: Translator }>({ locale: "en", t: createTranslator("en") });

function subscribe(listener: () => void) {
  window.addEventListener("languagechange", listener);
  return () => window.removeEventListener("languagechange", listener);
}
function browserLocale() {
  return preferredLocale(navigator.languages?.length ? navigator.languages : [navigator.language]);
}

export function LanguageProvider({ initialLocale, children }: { initialLocale: Locale; children: ReactNode }) {
  // The request header supplies the first render, avoiding a flash of English.
  const locale = useSyncExternalStore(subscribe, browserLocale, () => initialLocale);
  const value = useMemo(() => ({ locale, t: createTranslator(locale) }), [locale]);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}
