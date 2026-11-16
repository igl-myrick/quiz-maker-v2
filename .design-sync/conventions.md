# Quiz Maker conventions (read first)

Quiz Maker is a casual quiz site styled with **Ply CSS** (a class-based CSS library, no JS) plus a thin layer of app CSS. These components are the app's real code.

## Setup: always wrap in `QuizMakerProvider`

`QuizCard`, `SearchForm`, `ResultRow` and `ResultNotices` render TanStack Router links and throw without a router. `QuizMakerProvider` supplies an in-memory router and the app's single screen-reader live region (used by `CopyLinkButton` and `Countdown`). Wrap the whole design once:

```jsx
const { QuizMakerProvider, QuizCard, PageNav } = window.QuizMaker;
<QuizMakerProvider>
  <main className="units-container">…</main>
</QuizMakerProvider>
```

## Styling idiom: Ply utility classes, not inline styles

Use the class names the app itself uses (all present in `styles.css` → `_ds_bundle.css`):

| Purpose | Classes |
|---|---|
| Page wrapper | `units-container` |
| Buttons | `btn` (default, dark), `btn btn-primary` (blue, one main action), `btn btn-red` (destructive); group with `btn-group` |
| Boxed sections / cards | `border padding margin-bottom` |
| Spacing | `margin-bottom`, `margin-top`, `padding` |
| Flex row | `display-flex justify-between items-center` |
| Small tag | `label` (e.g. "Trivia", "Quiz updated") |
| Muted text | `text-secondary`; hint text `form-desc` |
| Forms | wrap in `form`; inputs get a visible `<label>`; invalid input `input-error` |
| Errors | `error` (red, bold) — always paired with text, never colour alone |
| Lists without bullets | `flat-list` |
| Screen-reader only | `sr-only` |
| Dialogs | native `<dialog className="dialog-sm">` with `dialog-header`, `dialog-body`, `dialog-footer` |

Colours come from Ply tokens, e.g. `var(--ply-color-body)`, `var(--ply-color-muted)`, `var(--ply-border-color)`, `var(--ply-btn-default-bg)`, `var(--ply-bg-surface)`, `var(--ply-color-link)`; spacing tokens are `var(--ply-space-xs … xxl)`. Theme follows `prefers-color-scheme`; force one with `data-theme="light"|"dark"` on `<html>`. Text sizes are in `rem`; never use fixed `px` font sizes.

## Accessibility rules the design must keep (WCAG 2.2 AA)

- Answer choices are real radios/checkboxes inside a `fieldset` with the question as `legend` (use `QuestionFieldset`).
- Correct/incorrect and status are shown with text or an icon plus text, never colour alone.
- Dialogs use native `<dialog>`; buttons stay at least 24×24 CSS px.
- Quiz answers are choices only. There are no free-text answers, tags, categories, or private/draft quizzes.

## Where the truth lives

- `styles.css` and its import `_ds_bundle.css`: Ply plus the app overrides (`app.css`, `search.css`, `settings.css`, Lexend font). Read these before styling.
- `components/<group>/<Name>/<Name>.prompt.md` and `.d.ts`: props and examples for each component.

## Example

```jsx
const { QuizMakerProvider, QuizCard, QuizIllustration } = window.QuizMaker;
<QuizMakerProvider>
  <main className="units-container">
    <div className="display-flex justify-between items-center margin-bottom">
      <h1>Find a quiz</h1>
      <QuizIllustration />
    </div>
    <QuizCard
      quiz={{ id: '6f1c2a0e-1b7d-4c2e-9a51-0d3f8e2b7c41', kind: 'trivia', title: 'World Capitals',
              description: 'Name the capital of each country.', question_count: 12, suggested_time_seconds: 300 }}
      actions={<div className="btn-group"><button type="button" className="btn">Edit</button></div>}
    />
  </main>
</QuizMakerProvider>
```
