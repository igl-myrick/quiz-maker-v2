import { AuthApiError } from '@supabase/supabase-js'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { Announcer } from './Announcer'
import { LoginButton } from './LoginButton'

const mocks = vi.hoisted(() => ({
  signInWithOtp: vi.fn(),
  verifyOtp: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithOtp: mocks.signInWithOtp,
      verifyOtp: mocks.verifyOtp,
    },
  },
}))

function renderLogin() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <LoginButton />
      <Announcer />
    </QueryClientProvider>,
  )
}

function getDialog() {
  return screen.getByRole('dialog', { name: 'Log in or sign up', hidden: true })
}

function openDialog() {
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
}

async function goToCodeStep(email = 'alex@example.test') {
  openDialog()
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: email } })
  fireEvent.click(screen.getByRole('button', { name: 'Send code' }))
  return screen.findByLabelText('Code from your email')
}

describe('LoginDialog', () => {
  beforeEach(() => {
    mocks.signInWithOtp.mockReset().mockResolvedValue({ data: {}, error: null })
    mocks.verifyOtp.mockReset().mockResolvedValue({ data: {}, error: null })
  })

  it('opens with focus in the email field, and closing resets it to step 1', async () => {
    renderLogin()
    openDialog()

    const dialog = getDialog()
    expect(dialog).toHaveAttribute('open')
    await waitFor(() => expect(screen.getByLabelText('Email address')).toHaveFocus())

    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'alex@example.test' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }))
    await screen.findByLabelText('Code from your email')

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(dialog).not.toHaveAttribute('open')

    openDialog()
    expect(screen.getByLabelText('Email address')).toHaveValue('')
    expect(screen.queryByLabelText('Code from your email')).not.toBeInTheDocument()
  })

  it('links an invalid email error to the field and focuses it', async () => {
    renderLogin()
    openDialog()

    const field = screen.getByLabelText('Email address')
    fireEvent.change(field, { target: { value: 'not-an-email' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }))

    const error = await screen.findByText('Enter a valid email address, like name@example.com.')
    expect(field).toHaveAttribute('aria-describedby', error.id)
    expect(field).toHaveAttribute('aria-invalid', 'true')
    await waitFor(() => expect(field).toHaveFocus())
    expect(mocks.signInWithOtp).not.toHaveBeenCalled()
  })

  it('sends a code and moves to step 2, announcing it', async () => {
    renderLogin()
    const codeField = await goToCodeStep()

    expect(mocks.signInWithOtp).toHaveBeenCalledWith({
      email: 'alex@example.test',
      options: { shouldCreateUser: true },
    })
    expect(screen.getByText('Code sent to alex@example.test.')).toBeInTheDocument()
    await waitFor(() => expect(codeField).toHaveFocus())
    expect(codeField).toHaveAttribute('autocomplete', 'one-time-code')
    expect(codeField).toHaveAttribute('inputmode', 'numeric')
  })

  it('shows a wrong-code error, clears and focuses the field, and stays open', async () => {
    mocks.verifyOtp.mockResolvedValue({
      data: {},
      error: new AuthApiError('Token has expired or is invalid', 403, 'otp_expired'),
    })
    renderLogin()
    const codeField = await goToCodeStep()

    fireEvent.change(codeField, { target: { value: '123456' } })
    fireEvent.click(within(getDialog()).getByRole('button', { name: 'Log in' }))

    expect(await screen.findByRole('alert', { hidden: true })).toHaveTextContent(
      "That code didn't work or has expired. Check it or send a new code.",
    )
    await waitFor(() => expect(codeField).toHaveValue(''))
    await waitFor(() => expect(codeField).toHaveFocus())
    expect(getDialog()).toHaveAttribute('open')
  })

  it('shows the rate-limit message when codes are requested too often', async () => {
    mocks.signInWithOtp.mockResolvedValue({
      data: {},
      error: new AuthApiError('For security purposes…', 429, 'over_email_send_rate_limit'),
    })
    renderLogin()
    openDialog()
    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'alex@example.test' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }))

    expect(await screen.findByRole('alert', { hidden: true })).toHaveTextContent(
      'Please wait a minute before asking for another code.',
    )
    expect(screen.getByLabelText('Email address')).toBeInTheDocument()
  })

  it('sends a new code and stays on step 2', async () => {
    renderLogin()
    await goToCodeStep()

    fireEvent.click(screen.getByRole('button', { name: 'Send a new code' }))

    expect(await screen.findByText('New code sent to alex@example.test.')).toBeInTheDocument()
    expect(mocks.signInWithOtp).toHaveBeenCalledTimes(2)
    expect(screen.getByLabelText('Code from your email')).toBeInTheDocument()
  })

  it('returns to step 1 with the email kept', async () => {
    renderLogin()
    await goToCodeStep()

    fireEvent.click(screen.getByRole('button', { name: 'Use a different email' }))

    expect(screen.getByLabelText('Email address')).toHaveValue('alex@example.test')
    await waitFor(() => expect(screen.getByLabelText('Email address')).toHaveFocus())
  })

  it('closes and announces "You\'re logged in" on success', async () => {
    renderLogin()
    const codeField = await goToCodeStep()

    const dialog = getDialog()
    fireEvent.change(codeField, { target: { value: '123 456' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Log in' }))

    await waitFor(() => expect(dialog).not.toHaveAttribute('open'))
    expect(mocks.verifyOtp).toHaveBeenCalledWith({
      email: 'alex@example.test',
      token: '123456',
      type: 'email',
    })
    expect(await screen.findByText("You're logged in")).toBeInTheDocument()
  })

  it('has no detectable accessibility violations on either step', async () => {
    const { container } = renderLogin()
    openDialog()
    expect(await axe(container)).toHaveNoViolations()

    await goToCodeStepFromOpen()
    expect(await axe(container)).toHaveNoViolations()
  })
})

async function goToCodeStepFromOpen() {
  fireEvent.change(screen.getByLabelText('Email address'), {
    target: { value: 'alex@example.test' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Send code' }))
  await screen.findByLabelText('Code from your email')
}
