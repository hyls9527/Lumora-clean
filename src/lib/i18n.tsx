import { createContext, useContext, useState, useCallback, type ReactNode } from "react"
import en from "../i18n/en.json"
import zh from "../i18n/zh.json"

type Locale = "en" | "zh"

const translations: Record<Locale, typeof en> = { en, zh }

interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

function getStoredLocale(): Locale {
  const stored = localStorage.getItem("lumora-locale")
  if (stored === "en" || stored === "zh") return stored
  return navigator.language.startsWith("zh") ? "zh" : "en"
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getStoredLocale)

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale)
    localStorage.setItem("lumora-locale", newLocale)
  }, [])

  const t = useCallback(
    (key: string): string => {
      const keys = key.split(".")
      let result: any = translations[locale]
      for (const k of keys) {
        if (result == null) return key
        result = result[k]
      }
      return typeof result === "string" ? result : key
    },
    [locale],
  )

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useTranslation() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error("useTranslation must be used within I18nProvider")
  return ctx
}
