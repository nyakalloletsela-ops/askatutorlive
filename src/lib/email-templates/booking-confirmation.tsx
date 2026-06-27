import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

const SITE_NAME = 'Ask A Tutor Live'

interface BookingConfirmationProps {
  recipientName?: string
  counterpartName?: string
  subject?: string
  scheduledAt?: string
  durationMin?: number
  role?: 'tutor' | 'student'
}

const BookingConfirmationEmail = ({
  recipientName,
  counterpartName,
  subject,
  scheduledAt,
  durationMin,
  role = 'student',
}: BookingConfirmationProps) => {
  const greeting = recipientName ? `Hi ${recipientName},` : 'Hi there,'
  const lead =
    role === 'tutor'
      ? `A class has been scheduled${counterpartName ? ` with your student ${counterpartName}` : ''}.`
      : `Your class${counterpartName ? ` with ${counterpartName}` : ''} is confirmed.`

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Your {SITE_NAME} class is confirmed</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Class confirmed</Heading>
          <Text style={text}>{greeting}</Text>
          <Text style={text}>{lead}</Text>
          <Section style={card}>
            {subject && <Text style={row}><b>Subject:</b> {subject}</Text>}
            {scheduledAt && <Text style={row}><b>When:</b> {scheduledAt}</Text>}
            {durationMin && <Text style={row}><b>Duration:</b> {durationMin} minutes</Text>}
          </Section>
          <Text style={text}>
            Open your dashboard to join the classroom when it's time.
          </Text>
          <Text style={footer}>— The {SITE_NAME} team</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: BookingConfirmationEmail,
  subject: 'Your class is confirmed',
  displayName: 'Booking confirmation',
  previewData: {
    recipientName: 'Thabo',
    counterpartName: 'Ms. Lets\'ela',
    subject: 'Mathematics',
    scheduledAt: 'Mon, 26 May 2026 at 18:00',
    durationMin: 60,
    role: 'student',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#0b1220', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#374151', lineHeight: '1.6', margin: '0 0 12px' }
const card = {
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '14px 18px',
  margin: '16px 0',
}
const row = { fontSize: '14px', color: '#0b1220', margin: '4px 0' }
const footer = { fontSize: '12px', color: '#94a3b8', margin: '24px 0 0' }
