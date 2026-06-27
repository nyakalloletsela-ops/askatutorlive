import * as React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { main, container, h1, text, muted } from './_shared'

interface Props { name?: string; reason?: string }

const SubscriptionRejectedEmail = ({ name, reason }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your subscription payment was not approved</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Payment not approved</Heading>
        <Text style={text}>
          Hi{name ? `, ${name}` : ''} — we couldn't verify your recent subscription payment.
        </Text>
        {reason && <Text style={text}><strong>Reason:</strong> {reason}</Text>}
        <Text style={text}>
          Please re-submit a fresh transaction reference from your dashboard. Reply to this
          email if you need help.
        </Text>
        <Text style={muted}>— askatutor Billing</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: SubscriptionRejectedEmail,
  subject: 'Your askatutor subscription payment was not approved',
  displayName: 'Subscription rejected',
  fromAlias: 'billing',
  previewData: { name: 'Thabo', reason: 'Transaction reference could not be verified.' },
} satisfies TemplateEntry & { fromAlias?: string }
