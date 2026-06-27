import * as React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Text, Button } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { main, container, h1, text, btn, muted, SITE_URL } from './_shared'

interface Props { name?: string; amount?: number }

const SubscriptionApprovedEmail = ({ name, amount }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your tutor subscription is active</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>You're featured 🎉</Heading>
        <Text style={text}>
          Hi{name ? `, ${name}` : ''} — your subscription payment of <strong>M{amount ?? 250}</strong> has been
          approved. You'll appear as a Featured tutor for the next 30 days.
        </Text>
        <Button href={`${SITE_URL}/tutors`} style={btn}>View your profile</Button>
        <Text style={muted}>Reply to this email if you have any billing questions.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: SubscriptionApprovedEmail,
  subject: 'Your askatutor subscription is active',
  displayName: 'Subscription approved',
  fromAlias: 'billing',
  previewData: { name: 'Thabo', amount: 250 },
} satisfies TemplateEntry & { fromAlias?: string }
