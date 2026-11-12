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
      <input id={inputId} type="search" maxLength={MAX_QUERY_LENGTH} {...form.register('q')} />
      <button type="submit" className="btn btn-primary">
        Search
      </button>
    </form>
  )
}
