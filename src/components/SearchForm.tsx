import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { useId } from 'react'
import { useForm } from 'react-hook-form'
import { MAX_QUERY_LENGTH, searchFormSchema, type SearchFormValues } from '../schemas/search'

type SearchFormProps = {
  q: string | undefined
}

export function SearchForm({ q }: SearchFormProps) {
  const navigate = useNavigate()
  const inputId = useId()

  // `values` keeps the box in step with q in the URL (for Back and Forward)
  // without a remount or an effect, so focus stays in the box.
  const form = useForm<SearchFormValues>({
    resolver: zodResolver(searchFormSchema),
    values: { q: q ?? '' },
  })

  function handleSearch(values: SearchFormValues) {
    void navigate({ to: '/search', search: values.q ? { q: values.q } : {} })
  }

  return (
    <form role="search" className="form" onSubmit={form.handleSubmit(handleSearch)}>
      <label htmlFor={inputId}>Search quizzes</label>
      {/* One rounded field holding the icon, the box and the button. */}
      <div className="search-field">
        <svg className="search-icon" aria-hidden="true" focusable="false" viewBox="0 0 16 16">
          <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <input id={inputId} type="search" maxLength={MAX_QUERY_LENGTH} {...form.register('q')} />
        <button type="submit" className="btn btn-primary">
          Search
        </button>
      </div>
    </form>
  )
}
