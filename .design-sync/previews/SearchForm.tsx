import { SearchForm } from 'quiz-maker'

export function Empty() {
  return <SearchForm q={undefined} />
}

export function WithQuery() {
  return <SearchForm q="capitals" />
}
