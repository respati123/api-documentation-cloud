import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import i18next, { languageStorageKey } from '@/shared/i18n'
import { LanguageSwitcher } from './language-switcher'

beforeEach(async () => {
  await i18next.changeLanguage('en')
})

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

describe('LanguageSwitcher', () => {
  test('marks the active language as selected', () => {
    render(<LanguageSwitcher />)

    expect(screen.getByTestId('language-option-en')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('language-option-id')).toHaveAttribute('aria-selected', 'false')
  })

  test('switches the interface and remembers the choice', async () => {
    render(<LanguageSwitcher />)

    fireEvent.click(screen.getByTestId('language-option-id'))

    await waitFor(() => expect(i18next.language).toBe('id'))
    expect(window.localStorage.getItem(languageStorageKey)).toBe('id')
    expect(screen.getByRole('tablist', { name: 'Bahasa' })).toBeInTheDocument()
  })
})
