// A predictable element ID for a form field, such as "field-questions-0-prompt",
// so the error summary can link straight to it.
export function fieldDomId(name: string) {
  return `field-${name.replaceAll('.', '-')}`
}

type FieldErrorProps = {
  id: string
  message: string | undefined
}

// An inline field error. The field points to it with aria-describedby.
export function FieldError({ id, message }: FieldErrorProps) {
  if (!message) return null
  return (
    <p id={id} className="error">
      {message}
    </p>
  )
}

// The id and aria attributes for a field that may have an error.
export function fieldProps(name: string, message: string | undefined) {
  const id = fieldDomId(name)
  return message
    ? {
        id,
        'aria-invalid': true as const,
        'aria-describedby': `${id}-error`,
        className: 'input-error',
      }
    : { id }
}
