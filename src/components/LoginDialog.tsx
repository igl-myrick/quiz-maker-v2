import { zodResolver } from '@hookform/resolvers/zod'
import { isAuthApiError } from '@supabase/supabase-js'
import { useMutation } from '@tanstack/react-query'
import { useId, useState, type RefObject } from 'react'
import { flushSync } from 'react-dom'
import { useForm } from 'react-hook-form'
import { supabase } from '../lib/supabase'
import {
  codeFormSchema,
  emailFormSchema,
  type CodeFormInput,
  type CodeFormValues,
  type EmailFormValues,
} from '../schemas/login'
import { announce } from '../stores/announcerStore'

type Step = 'email' | 'code'

const GENERIC_ERROR = 'Something went wrong. Please try again.'

// Opens the login popup and puts focus in the email field.
// React's autoFocus can't do this, because the field mounts while the dialog is closed.
export function openLoginDialog(dialog: HTMLDialogElement) {
  dialog.showModal()
  dialog.querySelector<HTMLInputElement>('input[type="email"]')?.focus()
}

function isRateLimited(error: unknown) {
  return isAuthApiError(error) && error.status === 429
}

function sendErrorMessage(error: unknown) {
  return isRateLimited(error)
    ? 'Please wait a minute before asking for another code.'
    : GENERIC_ERROR
}

function verifyErrorMessage(error: unknown) {
  if (isRateLimited(error)) return 'Please wait a minute before trying again.'
  // Supabase answers a wrong or expired code with a 4xx API error (otp_expired).
  if (isAuthApiError(error) && error.status >= 400 && error.status < 500) {
    return "That code didn't work or has expired. Check it or send a new code."
  }
  return GENERIC_ERROR
}

async function requestCode(email: string) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  })
  if (error) throw error
}

type LoginDialogProps = {
  dialogRef: RefObject<HTMLDialogElement | null>
}

export function LoginDialog({ dialogRef }: LoginDialogProps) {
  // The only local state: which step is showing, and the email the code was sent to.
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')

  const headingId = useId()
  const emailId = useId()
  const emailErrorId = useId()
  const codeId = useId()
  const codeErrorId = useId()

  const emailForm = useForm<EmailFormValues>({
    resolver: zodResolver(emailFormSchema),
    defaultValues: { email: '' },
  })
  const codeForm = useForm<CodeFormInput, unknown, CodeFormValues>({
    resolver: zodResolver(codeFormSchema),
    defaultValues: { code: '' },
  })

  const sendCode = useMutation({ mutationFn: requestCode })
  const resendCode = useMutation({ mutationFn: requestCode })
  const verifyCode = useMutation({
    mutationFn: async (code: string) => {
      const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' })
      if (error) throw error
    },
    // These run even if the popup was closed while the code was being checked.
    onSuccess: () => {
      dialogRef.current?.close()
      announce("You're logged in")
    },
    onError: () => {
      codeForm.resetField('code')
      codeForm.setFocus('code')
    },
  })

  const busy = sendCode.isPending || resendCode.isPending || verifyCode.isPending

  function handleSendCode(values: EmailFormValues) {
    sendCode.mutate(values.email, {
      onSuccess: () => {
        // setFocus looks the field up straight away, so render step 2 first.
        flushSync(() => {
          setEmail(values.email)
          setStep('code')
        })
        codeForm.setFocus('code')
      },
      onError: () => emailForm.setFocus('email'),
    })
  }

  function handleVerify(values: CodeFormValues) {
    if (resendCode.isError) resendCode.reset()
    verifyCode.mutate(values.code)
  }

  function handleResend() {
    verifyCode.reset()
    resendCode.mutate(email, { onSettled: () => codeForm.setFocus('code') })
  }

  function handleUseDifferentEmail() {
    // setFocus looks the field up straight away, so render step 1 first.
    flushSync(() => {
      sendCode.reset()
      resendCode.reset()
      verifyCode.reset()
      codeForm.reset()
      setStep('email')
    })
    emailForm.setFocus('email')
  }

  // Runs for Escape and for the close button: start again next time.
  function handleClose() {
    setStep('email')
    setEmail('')
    emailForm.reset()
    codeForm.reset()
    sendCode.reset()
    resendCode.reset()
    verifyCode.reset()
  }

  let status = ''
  if (step === 'code') {
    if (resendCode.isPending) status = 'Sending a new code…'
    else if (resendCode.isSuccess) status = `New code sent to ${email}.`
    else status = `Code sent to ${email}.`
  }

  let requestError: string | null = null
  if (step === 'email' && sendCode.isError) requestError = sendErrorMessage(sendCode.error)
  if (step === 'code' && verifyCode.isError) requestError = verifyErrorMessage(verifyCode.error)
  else if (step === 'code' && resendCode.isError) requestError = sendErrorMessage(resendCode.error)

  const emailError = emailForm.formState.errors.email?.message
  const codeError = codeForm.formState.errors.code?.message

  return (
    <dialog ref={dialogRef} className="dialog-sm" aria-labelledby={headingId} onClose={handleClose}>
      <div className="dialog-header">
        <h2 id={headingId}>Log in or sign up</h2>
        <button
          type="button"
          className="dialog-close"
          aria-label="Close"
          onClick={() => dialogRef.current?.close()}
        >
          ×
        </button>
      </div>

      <div className="dialog-body">
        {/* Always rendered, so screen readers hear the change when a code is sent. */}
        <p role="status">{status}</p>

        {requestError && (
          <p role="alert" className="error">
            {requestError}
          </p>
        )}

        {step === 'email' ? (
          <form className="form" noValidate onSubmit={emailForm.handleSubmit(handleSendCode)}>
            <p>We&apos;ll email you a code. No password needed.</p>
            <label htmlFor={emailId}>Email address</label>
            <input
              id={emailId}
              type="email"
              autoComplete="email"
              aria-invalid={emailError ? true : undefined}
              aria-describedby={emailError ? emailErrorId : undefined}
              className={emailError ? 'input-error' : undefined}
              {...emailForm.register('email')}
            />
            {emailError && (
              <p id={emailErrorId} className="error">
                {emailError}
              </p>
            )}
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {sendCode.isPending ? 'Sending…' : 'Send code'}
            </button>
          </form>
        ) : (
          <form className="form" noValidate onSubmit={codeForm.handleSubmit(handleVerify)}>
            <label htmlFor={codeId}>Code from your email</label>
            <input
              id={codeId}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              aria-invalid={codeError ? true : undefined}
              aria-describedby={codeError ? codeErrorId : undefined}
              className={codeError ? 'input-error' : undefined}
              {...codeForm.register('code')}
            />
            {codeError && (
              <p id={codeErrorId} className="error">
                {codeError}
              </p>
            )}
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {verifyCode.isPending ? 'Checking…' : 'Log in'}
            </button>
            <button type="button" className="btn" disabled={busy} onClick={handleResend}>
              {resendCode.isPending ? 'Sending…' : 'Send a new code'}
            </button>
            <button type="button" className="btn" disabled={busy} onClick={handleUseDifferentEmail}>
              Use a different email
            </button>
          </form>
        )}
      </div>
    </dialog>
  )
}
