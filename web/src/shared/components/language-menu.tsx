import { Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/shared/components/primitives/dropdown-menu'
import { LANGUAGE_NAME_TEXT, LANGUAGE_TEXT } from '@/shared/constants/language-text.constants'
import { supportedLanguages } from '@/shared/i18n'

type Language = (typeof supportedLanguages)[number]

// A language submenu for any dropdown menu. It changes the language the same way the language switcher does.
export function LanguageMenu() {
  const { t, i18n } = useTranslation()
  const current: Language = supportedLanguages.find((language) => language === i18n.resolvedLanguage) ?? 'en'

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger data-testid="language-menu-trigger">
        <Languages />
        {t(LANGUAGE_TEXT.label)}
        <span className="ml-auto text-xs text-muted-foreground">{t(LANGUAGE_NAME_TEXT[current])}</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuRadioGroup value={current} onValueChange={(value: Language) => void i18n.changeLanguage(value)}>
          {supportedLanguages.map((language) => (
            <DropdownMenuRadioItem key={language} value={language} data-testid={`language-menu-option-${language}`}>
              {t(LANGUAGE_NAME_TEXT[language])}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}
