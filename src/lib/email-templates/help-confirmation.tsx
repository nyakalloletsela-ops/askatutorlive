import * as React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { main, container, h1, text, card, muted, SITE } from './_shared'

interface Props { name?: string; subject?: string; body?: string }

const HelpConfirmationEmail = ({ name, subject, body }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>We received your message — {SITE} Help</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Thanks{name ? `, ${name}` : ''} — we've got it</Heading>
        <Text style={text}>
          Our help team has received your message and will reply within 24 hours.
        </Text>
        {(subject || body) && (
          <div style={card}>
            {subject && <Text style={{ ...text, fontWeight: 600, margin: '0 0 6px' }}>{subject}</Text>}
            {body && <Text style={{ ...text, margin: 0, whiteSpace: 'pre-wrap' }}>{body}</Text>}
          </div>
        )}
        <Text style={muted}>You can reply to this email and it will reach our team.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: HelpConfirmationEmail,
  subject: 'We received your message — askatutor Help',
  displayName: 'Help: confirmation to sender',
  fromAlias: 'help',
  previewData: { name: 'Lerato', subject: 'Login issue', body: 'I forgot my password.' },
} satisfies TemplateEntry & { fromAlias?: string }
