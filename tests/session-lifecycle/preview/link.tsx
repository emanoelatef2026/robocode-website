import type { ComponentProps } from 'react'

export default function Link({ href, onClick, prefetch: _prefetch, replace: _replace, scroll: _scroll, ...props }: Omit<ComponentProps<'a'>, 'href'> & {
  href: string | { pathname?: string }; prefetch?: boolean; replace?: boolean; scroll?: boolean
}) {
  const target = typeof href === 'string' ? href : href.pathname ?? '#'
  return <a {...props} href={target} onClick={event => {
    event.preventDefault()
    onClick?.(event)
    window.dispatchEvent(new CustomEvent('synthetic-navigation', { detail: target }))
  }} />
}
