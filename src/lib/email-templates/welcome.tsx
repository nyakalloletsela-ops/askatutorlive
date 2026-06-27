import * as React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Text, Button } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { main, container, h1, text, btn, muted, SITE, SITE_URL } from './_shared'

interface Props { name?: string }

const WelcomeEmail = ({ name }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Welcome to {SITE}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Welcome{name ? `, ${name}` : ''} 👋</Heading>
        <Text style={text}>
          Your {SITE} account is ready. You get 300 free tutoring minutes to start —
          jump in, pick a tutor, and book a session.
        </Text>
        <Button href={`${SITE_URL}/dashboard`} style={btn}>Go to dashboard</Button>
        <Text style={muted}>If you didn't create an account, you can ignore this email.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WelcomeEmail,
  subject: 'Welcome to askatutor',
  displayName: 'Welcome',
  fromAlias: 'noreply',
  previewData: { name: 'Thato' },
} satisfies TemplateEntry & { fromAlias?: string }
