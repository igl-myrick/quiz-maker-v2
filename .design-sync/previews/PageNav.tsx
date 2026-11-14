import { PageNav } from 'quiz-maker'

const noop = () => {}

export function FirstPage() {
  return (
    <PageNav
      page={1}
      totalPages={3}
      submitting={false}
      onPrevious={noop}
      onNext={noop}
      onSubmit={noop}
    />
  )
}

export function MiddlePage() {
  return (
    <PageNav
      page={2}
      totalPages={3}
      submitting={false}
      onPrevious={noop}
      onNext={noop}
      onSubmit={noop}
    />
  )
}

export function LastPage() {
  return (
    <PageNav
      page={3}
      totalPages={3}
      submitting={false}
      onPrevious={noop}
      onNext={noop}
      onSubmit={noop}
    />
  )
}

export function Submitting() {
  return (
    <PageNav page={3} totalPages={3} submitting onPrevious={noop} onNext={noop} onSubmit={noop} />
  )
}
