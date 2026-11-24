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
      const buttons = Array.from(select.options).map((option) => {
        const button = document.createElement('button')
        button.type = 'button'
        button.setAttribute('role', 'option')
        button.setAttribute('aria-selected', String(option.selected))
        button.disabled = option.disabled || !!option.closest('optgroup')?.disabled
        button.textContent = option.label
        button.addEventListener('click', () => {
          select.value = option.value
          select.dispatchEvent(new Event('input', { bubbles: true }))
          select.dispatchEvent(new Event('change', { bubbles: true }))
          close?.()
          select.focus({ preventScroll: true })
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
            buttons[index].focus({ preventScroll: true })
            buttons[index].scrollIntoView({ block: 'nearest' })
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
          select.focus({ preventScroll: true })
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
      const reposition = (event?: Event) => {
        if (event?.target instanceof Node && menu.contains(event.target)) return
        const rect = select.getBoundingClientRect()
        const container = select.closest('.modal-dialog__body')?.getBoundingClientRect()
        if (
          !select.isConnected ||
          rect.bottom <= Math.max(0, container?.top ?? 0) ||
          rect.top >= Math.min(innerHeight, container?.bottom ?? innerHeight)
        ) {
          close?.()
          return
        }
        const width = Math.min(rect.width, innerWidth - 24)
        menu.style.width = width + 'px'
        const height = Math.min(300, menu.scrollHeight + 2)
        const below = innerHeight - rect.bottom - 18
        const above = rect.top - 18
        const opensBelow = below >= height || below >= above
        const maxHeight = Math.min(height, opensBelow ? below : above)
        Object.assign(menu.style, {
          left: Math.max(12, Math.min(rect.left, innerWidth - width - 12)) + 'px',
          top: (opensBelow ? rect.bottom + 6 : rect.top - maxHeight - 6) + 'px',
          maxHeight: maxHeight + 'px',
        })
      }
      menu.addEventListener('keydown', keyboard)
      document.addEventListener('pointerdown', outside, true)
      window.addEventListener('resize', reposition)
      window.addEventListener('scroll', reposition, true)
      select.setAttribute('aria-expanded', 'true')
      menu.showPopover()
      close = () => {
        clearTimeout(queryTimer)
        menu.remove()
        select.removeAttribute('aria-expanded')
        document.removeEventListener('pointerdown', outside, true)
        window.removeEventListener('resize', reposition)
        window.removeEventListener('scroll', reposition, true)
        close = undefined
      }
      reposition()
      if (menu.isConnected) focus(index)
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
