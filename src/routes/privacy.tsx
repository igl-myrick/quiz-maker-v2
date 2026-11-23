import { createFileRoute } from '@tanstack/react-router'
import { PrivacyPage } from '../pages/PrivacyPage'

export const Route = createFileRoute('/privacy')({
  head: () => ({ meta: [{ title: 'Privacy · Quiz Maker' }] }),
  component: PrivacyPage,
})
