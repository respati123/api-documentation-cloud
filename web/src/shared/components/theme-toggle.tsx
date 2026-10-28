import { Monitor, Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import { THEME_OPTION_TEXT, THEME_TEXT } from '@/shared/constants/theme-text.constants'
import type { ThemePreference } from '@/shared/theme/theme'
import { useThemeStore } from '@/shared/theme/theme.store'

const icons = { system: Monitor, light: Sun, dark: Moon } as const

export function ThemeToggle() {
  const { t } = useTranslation()
  const preference = useThemeStore((state) => state.preference)
  const setPreference = useThemeStore((state) => state.setPreference)
  const Icon = icons[preference]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label={t(THEME_TEXT.label)} data-testid="theme-toggle-button" />}
      >
        <Icon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        <DropdownMenuLabel>{t(THEME_TEXT.label)}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={preference} onValueChange={(value) => setPreference(value as ThemePreference)}>
          {(Object.keys(THEME_OPTION_TEXT) as ThemePreference[]).map((option) => (
            <DropdownMenuRadioItem key={option} value={option} data-testid={`theme-option-${option}`}>
              {t(THEME_OPTION_TEXT[option])}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
