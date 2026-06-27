import * as React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Text, Button } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { main, container, h1, text, card, btn, SITE_URL } from './_shared'

interface Props { name?: string; email?: string; subject?: string; body?: string }

const HelpNewTicketEmail = ({ name, email, subject, body }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New help message: {subject ?? ''}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>New help message</Heading>
        <Text style={text}>
          <strong>{name ?? 'Someone'}</strong> ({email ?? 'no email'}) wrote:
        </Text>
        <div style={card}>
          {subject && <Text style={{ ...text, fontWeight: 600, margin: '0 0 6px' }}>{subject}</Text>}
          {body && <Text style={{ ...text, margin: 0, whiteSpace: 'pre-wrap' }}>{body}</Text>}
        </div>
        <Button href={`${SITE_URL}/admin`} style={btn}>Open Help inbox</Button>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: HelpNewTicketEmail,
  subject: (d: Record<string, any>) => `New help message: ${d.subject ?? '(no subject)'}`,
  displayName: 'Help: notify admins',
  fromAlias: 'help',
  previewData: { name: 'Lerato', email: 'l@example.com', subject: 'Login issue', body: 'I cannot sign in.' },
} satisfies TemplateEntry & { fromAlias?: string }
