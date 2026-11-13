import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, expect, vi } from 'vitest'
import * as axeMatchers from 'vitest-axe/matchers'
import type { AxeMatchers } from 'vitest-axe/matchers'

expect.extend(axeMatchers)

// vitest-axe 0.1 only types its matcher for older Vitest versions,
// so add toHaveNoViolations to Vitest's own Matchers interface here.
// The type parameters must repeat Vitest's own exactly, even though they are unused here.
/* eslint-disable @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars */
declare module 'vitest' {
  interface Matchers<
    R extends void | Promise<void> = void | Promise<void>,
    T = unknown,
  > extends AxeMatchers {}
}
/* eslint-enable @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars */

// jsdom has no showModal(), focus trap, Escape handling or focus return.
// This minimal stub lets tests open and close dialogs. Real dialog behaviour
// is covered by the manual checks in the feature specs.
HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
  this.open = true
}
HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
  if (!this.open) return
  this.open = false
  this.dispatchEvent(new Event('close'))
}

// Settings sync runs on every auth event and talks to the user_settings table. Most
// test files mock Supabase without tables, so it's off by default here.
// src/lib/settingsSync.test.ts unmocks it to test it.
vi.mock('./src/lib/settingsSync', () => ({
  syncSettingsOnAuthChange: vi.fn(),
  saveSettingsToAccount: vi.fn(),
}))

afterEach(() => {
  cleanup()
})
