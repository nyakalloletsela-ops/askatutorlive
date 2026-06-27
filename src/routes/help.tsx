import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { toast } from 'sonner'
import { Navbar } from '@/components/Navbar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/hooks/use-auth'
import { submitHelpMessage } from '@/lib/help.functions'

export const Route = createFileRoute('/help')({ component: HelpPage })

function HelpPage() {
  const { user } = useAuth()
  const submit = useServerFn(submitHelpMessage)
  const [name, setName] = useState(user?.user_metadata?.full_name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await submit({ data: { name, email, subject, body, user_id: user?.id ?? null } })
      setDone(true)
      setSubject(''); setBody('')
      toast.success('Message sent — check your inbox for a confirmation')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send')
    } finally { setBusy(false) }
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="mb-2 text-3xl font-bold text-navy">Contact Help</h1>
        <p className="mb-6 text-muted-foreground">
          Send us a message and our team will reply by email within 24 hours.
        </p>
        <Card>
          <CardHeader><CardTitle>Send a message</CardTitle></CardHeader>
          <CardContent>
            {done ? (
              <div className="space-y-3">
                <p className="text-sm">Thanks — we got it. A confirmation is on its way to <strong>{email}</strong>.</p>
                <Button variant="outline" onClick={() => setDone(false)}>Send another</Button>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="h-name">Your name</Label>
                    <Input id="h-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
                  </div>
                  <div>
                    <Label htmlFor="h-email">Your email</Label>
                    <Input id="h-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                </div>
                <div>
                  <Label htmlFor="h-subj">Subject</Label>
                  <Input id="h-subj" value={subject} onChange={(e) => setSubject(e.target.value)} required minLength={2} maxLength={200} />
                </div>
                <div>
                  <Label htmlFor="h-body">Message</Label>
                  <Textarea id="h-body" rows={6} value={body} onChange={(e) => setBody(e.target.value)} required minLength={5} maxLength={5000} />
                </div>
                <Button type="submit" disabled={busy} className="w-full">
                  {busy ? 'Sending…' : 'Send message'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
