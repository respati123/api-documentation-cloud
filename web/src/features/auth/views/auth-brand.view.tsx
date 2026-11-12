import { useTranslation } from 'react-i18next'
import { Badge } from '@/shared/components/primitives/badge'
import { AUTH_PREVIEW_ROWS, AUTH_TEXT } from '../constants/auth-text.constants'

export function ProductMark() {
  return (
    <span className="flex size-9 flex-col items-center justify-center gap-1 rounded-xl bg-primary" aria-hidden="true">
      <span className="h-0.5 w-4 rounded-full bg-primary-foreground" />
      <span className="h-0.5 w-2.5 rounded-full bg-primary-foreground" />
      <span className="h-0.5 w-4 rounded-full bg-primary-foreground" />
    </span>
  )
}

export function AuthBrandPanel() {
  const { t } = useTranslation('auth')
  return (
    <section className="hidden min-h-0 flex-col justify-between gap-8 border-r border-border p-10 lg:flex">
      <div className="flex items-center gap-3 text-sm font-bold">
        <ProductMark />
        <span>{t(AUTH_TEXT.brand.name)}</span>
      </div>

      <div className="grid max-w-xl gap-5">
        <h1 className="font-display text-4xl leading-[1.05] font-bold text-balance uppercase 2xl:text-5xl">{t(AUTH_TEXT.brand.title)}</h1>
        <p className="max-w-md text-lg/7 font-medium text-muted-foreground text-pretty">{t(AUTH_TEXT.brand.copy)}</p>
      </div>

      <div className="grid max-w-xl gap-3 rounded-[22px] bg-card p-6" data-testid="auth-preview-board">
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-sm font-bold">{t(AUTH_TEXT.preview.title)}</p>
          <p className="text-xs text-muted-foreground">{t(AUTH_TEXT.preview.footer)}</p>
        </div>
        <ul className="grid">
          {AUTH_PREVIEW_ROWS.map((row) => (
            <li
              key={`${row.method}-${row.path}-${row.name}`}
              className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-4 border-t border-border py-3 first:border-t-0"
            >
              <span className="font-mono text-xs font-bold text-link">{row.method}</span>
              <span className="grid min-w-0">
                <span className="truncate text-sm font-medium">{t(row.name)}</span>
                <code className="truncate font-mono text-xs text-muted-foreground">{row.path}</code>
              </span>
              <Badge variant={row.status === AUTH_TEXT.preview.pending ? 'outline' : 'secondary'} className="tabular-nums">
                {t(row.status)}
              </Badge>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-muted-foreground">{t(AUTH_TEXT.brand.foot)}</p>
    </section>
  )
}
