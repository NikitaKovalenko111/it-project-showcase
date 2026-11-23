import type { FormEvent } from 'react'

export function clearFieldError(event: FormEvent<HTMLFormElement>) {
  const field = event.target
  if (
    field instanceof HTMLInputElement ||
    field instanceof HTMLTextAreaElement ||
    field instanceof HTMLSelectElement
  ) {
    field.setCustomValidity('')
    if (field.validity.valid) field.removeAttribute('aria-invalid')
  }
}

export function markFieldError(event: FormEvent<HTMLFormElement>) {
  if (event.target instanceof HTMLElement) event.target.setAttribute('aria-invalid', 'true')
}

export function reportFieldError(form: HTMLFormElement, name: string, message: string) {
  const field = form.elements.namedItem(name)
  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
    field.setCustomValidity(message)
    field.reportValidity()
  }
}
