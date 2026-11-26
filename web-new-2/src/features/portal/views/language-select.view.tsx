import { useTranslation } from 'react-i18next'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supportedLanguages, type AppLanguage } from '@/shared/i18n'

const LANGUAGE_NAMES: Record<AppLanguage, string> = {
  en: 'English',
  id: 'Bahasa Indonesia',
}

export function LanguageSelect({ className, testId = 'language-select' }: { className?: string; testId?: string }) {
  const { t, i18n } = useTranslation()
  const current: AppLanguage = i18n.resolvedLanguage === 'id' ? 'id' : 'en'

  return (
    <Select value={current} onValueChange={value => void i18n.changeLanguage(value)}>
      <SelectTrigger aria-label={t('language.label')} data-testid={testId} className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {supportedLanguages.map(language => (
          <SelectItem key={language} value={language}>
            {LANGUAGE_NAMES[language]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
