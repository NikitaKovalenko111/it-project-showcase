import { useEffect } from 'react'

/** Keep native form semantics and React handlers while sharing the visible option menu. */
export function SelectMenus() {
  useEffect(() => {
    let close: (() => void) | undefined
    const open = (select: HTMLSelectElement) => {
      close?.()
      const menu = document.createElement('div')
      menu.className = 'select-menu'
      menu.setAttribute('popover', 'manual')
      menu.setAttribute('role', 'listbox')
      menu.setAttribute(
        'aria-label',
        select.labels?.[0]?.textContent?.trim() ||
          select.getAttribute('aria-label') ||
          'Выберите значение',
      )
      // A popover belongs to the dialog's subtree to remain interactive when a modal is open.
      ;(select.closest('dialog') || document.body).append(menu)
      const rect = select.getBoundingClientRect()
      const height = Math.min(300, innerHeight - 24)
      const below = innerHeight - rect.bottom - 8
      const top =
        below >= Math.min(height, select.options.length * 38 + 12)
          ? rect.bottom + 6
          : Math.max(12, rect.top - Math.min(height, select.options.length * 38 + 12) - 6)
      Object.assign(menu.style, {
        left: `${Math.max(12, Math.min(rect.left, innerWidth - Math.min(rect.width, innerWidth - 24) - 12))}px`,
        top: `${top}px`,
        width: `${Math.min(rect.width, innerWidth - 24)}px`,
        maxHeight: `${Math.min(height, innerHeight - top - 12)}px`,
      })
      const buttons = Array.from(select.options).map((option) => {
        const button = document.createElement('button')
        button.type = 'button'
        button.setAttribute('role', 'option')
        button.setAttribute('aria-selected', String(option.selected))
        button.disabled = option.disabled || !!option.closest('optgroup')?.disabled
        button.textContent = option.label
        button.addEventListener('click', () => {
          select.value = option.value
          select.dispatchEvent(new Event('change', { bubbles: true }))
          close?.()
          select.focus()
        })
        menu.append(button)
        return button
      })
      let index = Math.max(
        0,
        buttons.findIndex((button) => button.getAttribute('aria-selected') === 'true'),
      )
      const focus = (next: number) => {
        for (let step = 0; step < buttons.length; step++) {
          index = (next + step + buttons.length) % buttons.length
          if (!buttons[index].disabled) {
            buttons[index].focus()
            return
          }
        }
      }
      let query = '',
        queryTimer: ReturnType<typeof setTimeout>
      const keyboard = (event: KeyboardEvent) => {
        if (event.key === 'Escape' || event.key === 'Tab') {
          if (event.key === 'Escape') event.preventDefault()
          close?.()
          select.focus()
          return
        }
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault()
          const direction = event.key === 'ArrowUp' ? -1 : 1
          let next =
            event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? buttons.length - 1
                : (index + direction + buttons.length) % buttons.length
          for (let step = 0; step < buttons.length && buttons[next].disabled; step++)
            next = (next + direction + buttons.length) % buttons.length
          focus(next)
        } else if (event.key.length === 1 && event.key !== ' ') {
          query += event.key.toLocaleLowerCase('ru')
          clearTimeout(queryTimer)
          queryTimer = setTimeout(() => {
            query = ''
          }, 600)
          const found = buttons.findIndex(
            (button) =>
              !button.disabled && button.textContent?.toLocaleLowerCase('ru').startsWith(query),
          )
          if (found >= 0) focus(found)
        }
      }
      const outside = (event: PointerEvent) => {
        if (!menu.contains(event.target as Node) && event.target !== select) close?.()
      }
      const reposition = () => {
        close?.()
      }
      menu.addEventListener('keydown', keyboard)
      document.addEventListener('pointerdown', outside, true)
      window.addEventListener('resize', reposition)
      window.addEventListener('scroll', reposition)
      select.setAttribute('aria-expanded', 'true')
      menu.showPopover()
      focus(index)
      close = () => {
        clearTimeout(queryTimer)
        menu.remove()
        select.removeAttribute('aria-expanded')
        document.removeEventListener('pointerdown', outside, true)
        window.removeEventListener('resize', reposition)
        window.removeEventListener('scroll', reposition)
        close = undefined
      }
    }
    const selectFor = (target: EventTarget | null) =>
      target instanceof HTMLSelectElement &&
      !target.multiple &&
      !target.disabled &&
      target.size <= 1
        ? target
        : undefined
    const pointer = (event: MouseEvent) => {
      const select = selectFor(event.target)
      if (select && event.button === 0) {
        event.preventDefault()
        open(select)
      }
    }
    const keyboard = (event: KeyboardEvent) => {
      const select = selectFor(event.target)
      if (select && ['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(event.key)) {
        event.preventDefault()
        open(select)
      }
    }
    document.addEventListener('mousedown', pointer, true)
    document.addEventListener('keydown', keyboard, true)
    return () => {
      close?.()
      document.removeEventListener('mousedown', pointer, true)
      document.removeEventListener('keydown', keyboard, true)
    }
  }, [])
  return null
}
