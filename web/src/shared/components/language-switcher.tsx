import { useTranslation } from 'react-i18next'
import { Tabs, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { LANGUAGE_CODE_LABEL, LANGUAGE_NAME_TEXT, LANGUAGE_TEXT } from '@/shared/constants/language-text.constants'
import { supportedLanguages } from '@/shared/i18n'

type Language = (typeof supportedLanguages)[number]

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation()
  const current: Language = supportedLanguages.find((language) => language === i18n.resolvedLanguage) ?? 'en'

  return (
    <Tabs value={current} onValueChange={(value) => void i18n.changeLanguage(value)}>
      <TabsList aria-label={t(LANGUAGE_TEXT.label)} className="h-8" data-testid="language-switcher">
        {supportedLanguages.map((language) => (
          <TabsTrigger
            key={language}
            value={language}
            aria-label={t(LANGUAGE_NAME_TEXT[language])}
            data-testid={`language-option-${language}`}
            className="px-2 text-xs font-semibold"
          >
            {LANGUAGE_CODE_LABEL[language]}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
