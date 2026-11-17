import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CoverArt } from './CoverArt'
import { StripArt } from './StripArt'

describe('CoverArt and StripArt', () => {
  it.each([
    ['CoverArt', <CoverArt key="c" />],
    ['StripArt trivia', <StripArt key="t" kind="trivia" />],
    ['StripArt personality', <StripArt key="p" kind="personality" />],
  ])('%s is decorative', (_name, art) => {
    const { container } = render(art)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).toHaveAttribute('focusable', 'false')
  })

  it('draws circles for trivia and rounded squares for personality', () => {
    const trivia = render(<StripArt kind="trivia" />).container
    // 15 answer bubbles and 5 filled marks.
    expect(trivia.querySelectorAll('circle')).toHaveLength(20)

    const personality = render(<StripArt kind="personality" />).container
    expect(personality.querySelectorAll('circle')).toHaveLength(0)
  })

  it('uses only theme colours', () => {
    const { container } = render(
      <>
        <CoverArt />
        <StripArt kind="trivia" />
        <StripArt kind="personality" />
      </>,
    )
    expect(container.innerHTML).not.toMatch(/#[0-9a-f]{3,6}\b/i)
  })
})
