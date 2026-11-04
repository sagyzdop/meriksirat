// PROTOTYPE: four whole-page profile layouts where every field is an Item. Mock data, edits stay in memory.
import { useState } from 'react'
import { ChevronRight, Lock } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from '@/components/ui/item'
import { cn } from '@/lib/utils'
import { FlameMotif, type FlameState } from './flame-motif'

export type ProfileState = 'guest' | 'keeper' | 'invite' | FlameState

interface VariantProps {
  state: ProfileState
}

interface Field {
  key: string
  label: string
  value: string
  placeholder?: string
}

const PERSONAL: Array<Field> = [
  { key: 'firstName', label: 'First name', value: 'Aigerim' },
  { key: 'lastName', label: 'Last name', value: 'Sample' },
  { key: 'birthday', label: 'Birthday', value: '', placeholder: 'Not set' },
  { key: 'major', label: 'Major', value: 'Computer Science' },
  { key: 'graduation', label: 'Graduating', value: 'June 2028' },
  { key: 'nuId', label: 'NU ID', value: '202012345' },
]
const INSTAGRAM: Field = {
  key: 'instagram',
  label: 'Instagram',
  value: '',
  placeholder: 'Not set',
}
const EMAIL = 'aigerim.sample@nu.edu.kz'
const TELEGRAM = '@aigerim'
const CLUB = [
  { label: 'Status', value: 'Active' },
  { label: 'Role', value: 'Member' },
  { label: 'Clearance', value: 'Level 3' },
  { label: 'Joined', value: 'September 2025' },
]
const PLEDGED_GB = 5

const FLAME: Record<
  ProfileState,
  { title: string; description: string; usedGb: number; action?: string }
> = {
  guest: {
    title: 'Keep the flame alive',
    description: "Lend a little of your NU Drive to the club's albums.",
    usedGb: 0,
    action: 'Become a flamekeeper',
  },
  keeper: {
    title: "You're keeping the flame alive",
    description: 'Thank you for your pledge.',
    usedGb: 1.2,
  },
  invite: {
    title: 'Keep the flame alive',
    description: "Lend a little of your NU Drive to the club's albums.",
    usedGb: 0,
    action: 'Become a flamekeeper',
  },
  ember: {
    title: "You're keeping the flame alive",
    description: 'Thank you for your pledge.',
    usedGb: 0,
  },
  flame: {
    title: "You're keeping the flame alive",
    description: 'Thank you for your pledge.',
    usedGb: 1.2,
  },
  fading: {
    title: 'Your flame is winding down',
    description: 'Thank you for keeping it lit. Nothing to do on your side.',
    usedGb: 0.7,
  },
  out: {
    title: 'We lost touch with your Drive',
    description: 'Reconnect within 7 days to keep your flame lit.',
    usedGb: 1.2,
    action: 'Reconnect Drive',
  },
}

const motif = (state: ProfileState): FlameState =>
  state === 'guest' || state === 'invite'
    ? 'ember'
    : state === 'keeper'
      ? 'flame'
      : state
const isPledged = (state: ProfileState) =>
  state !== 'guest' && state !== 'invite'
const isKeeping = (state: ProfileState) =>
  state === 'ember' || state === 'flame' || state === 'keeper'
const pledgeLine = (state: ProfileState) =>
  `${FLAME[state].usedGb} GB of ${PLEDGED_GB} GB pledged`
const pledgePercent = (state: ProfileState) =>
  (FLAME[state].usedGb / PLEDGED_GB) * 100

function useValues() {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      [...PERSONAL, INSTAGRAM].map((field) => [field.key, field.value])
    )
  )
  return {
    values,
    set: (key: string, value: string) =>
      setValues((prev) => ({ ...prev, [key]: value })),
  }
}

function Initials({ className }: { className?: string }) {
  return (
    <Avatar className={className}>
      <AvatarFallback>AS</AvatarFallback>
    </Avatar>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-1 px-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
      {children}
    </h2>
  )
}

function InlineRow({
  field,
  value,
  onSave,
}: {
  field: Field
  value: string
  onSave: (value: string) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <Item size="sm" className="min-h-14 px-3 hover:bg-accent/40">
      <ItemDescription className="w-24 shrink-0 sm:w-32">
        {field.label}
      </ItemDescription>
      {draft === null ? (
        <>
          <ItemContent className="min-w-0">
            <ItemTitle className={cn(!value && 'text-muted-foreground')}>
              {value || field.placeholder}
            </ItemTitle>
          </ItemContent>
          <ItemActions>
            <Button size="sm" variant="ghost" onClick={() => setDraft(value)}>
              Edit
            </Button>
          </ItemActions>
        </>
      ) : (
        <>
          <ItemContent className="min-w-32">
            <Input
              autoFocus
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
          </ItemContent>
          <ItemActions>
            <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                onSave(draft)
                setDraft(null)
              }}
            >
              Save
            </Button>
          </ItemActions>
        </>
      )}
    </Item>
  )
}

export function VariantA({ state }: VariantProps) {
  const { values, set } = useValues()
  const flame = FLAME[state]
  const member = state !== 'guest'
  return (
    <div className="mx-auto w-full max-w-2xl space-y-8 px-4 py-8 pb-40">
      <Item className="px-3">
        <ItemMedia>
          <Initials className="size-14" />
        </ItemMedia>
        <ItemContent>
          <ItemTitle className="text-lg">
            {member ? 'Aigerim Sample' : EMAIL}
          </ItemTitle>
          <ItemDescription>
            {member ? 'Computer Science, class of 2028' : 'Not a club member'}
          </ItemDescription>
        </ItemContent>
      </Item>

      <section>
        <SectionLabel>Flamekeeper</SectionLabel>
        <ItemGroup>
          <Item size="sm" className="min-h-14 px-3">
            <ItemMedia>
              <FlameMotif state={motif(state)} size={18} />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{flame.title}</ItemTitle>
              <ItemDescription>{flame.description}</ItemDescription>
            </ItemContent>
            {flame.action && (
              <ItemActions>
                <Button size="sm">{flame.action}</Button>
              </ItemActions>
            )}
          </Item>
          {isPledged(state) && (
            <>
              <ItemSeparator />
              <Item size="sm" className="min-h-14 px-3 hover:bg-accent/40">
                <ItemDescription className="w-24 shrink-0 sm:w-32">
                  Pledge
                </ItemDescription>
                <ItemContent className="min-w-0">
                  <ItemTitle>{pledgeLine(state)}</ItemTitle>
                  <Progress value={pledgePercent(state)} className="h-1" />
                </ItemContent>
                {isKeeping(state) && (
                  <ItemActions>
                    <Button size="sm" variant="ghost">
                      Edit
                    </Button>
                  </ItemActions>
                )}
              </Item>
              <ItemSeparator />
              <Item size="sm" className="min-h-14 px-3 hover:bg-accent/40">
                <ItemDescription className="w-24 shrink-0 sm:w-32">
                  Graduating
                </ItemDescription>
                <ItemContent>
                  <ItemTitle>June 2028</ItemTitle>
                </ItemContent>
                {isKeeping(state) && (
                  <ItemActions>
                    <Button size="sm" variant="ghost">
                      Edit
                    </Button>
                  </ItemActions>
                )}
              </Item>
            </>
          )}
        </ItemGroup>
      </section>

      {member && (
        <section>
          <SectionLabel>About you</SectionLabel>
          <ItemGroup>
            {PERSONAL.map((field, index) => (
              <div key={field.key}>
                {index > 0 && <ItemSeparator />}
                <InlineRow
                  field={field}
                  value={values[field.key]}
                  onSave={(value) => set(field.key, value)}
                />
              </div>
            ))}
          </ItemGroup>
        </section>
      )}

      <section>
        <SectionLabel>Contact</SectionLabel>
        <ItemGroup>
          <Item size="sm" className="min-h-14 px-3">
            <ItemDescription className="w-24 shrink-0 sm:w-32">
              Email
            </ItemDescription>
            <ItemContent className="min-w-0">
              <ItemTitle className="break-all">{EMAIL}</ItemTitle>
            </ItemContent>
            <ItemMedia>
              <Lock className="size-3.5 text-muted-foreground" />
            </ItemMedia>
          </Item>
          {member && (
            <>
              <ItemSeparator />
              <Item size="sm" className="min-h-14 px-3 hover:bg-accent/40">
                <ItemDescription className="w-24 shrink-0 sm:w-32">
                  Telegram
                </ItemDescription>
                <ItemContent>
                  <ItemTitle>{TELEGRAM}</ItemTitle>
                </ItemContent>
                <ItemActions>
                  <Button size="sm" variant="ghost">
                    Relink
                  </Button>
                </ItemActions>
              </Item>
              <ItemSeparator />
              <InlineRow
                field={INSTAGRAM}
                value={values.instagram}
                onSave={(value) => set('instagram', value)}
              />
            </>
          )}
        </ItemGroup>
      </section>

      {member ? (
        <section>
          <SectionLabel>Club, set by admins</SectionLabel>
          <ItemGroup>
            {CLUB.map((row, index) => (
              <div key={row.label}>
                {index > 0 && <ItemSeparator />}
                <Item size="sm" className="min-h-12 px-3">
                  <ItemDescription className="w-24 shrink-0 sm:w-32">
                    {row.label}
                  </ItemDescription>
                  <ItemContent>
                    <ItemTitle>{row.value}</ItemTitle>
                  </ItemContent>
                </Item>
              </div>
            ))}
          </ItemGroup>
        </section>
      ) : (
        <section>
          <SectionLabel>Club</SectionLabel>
          <ItemGroup>
            <Item size="sm" className="px-3">
              <ItemContent className="min-w-40">
                <ItemTitle>Join the club</ItemTitle>
                <ItemDescription>Enter the club code.</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Input placeholder="Club code" className="w-32" />
                <Button size="sm">Join</Button>
              </ItemActions>
            </Item>
          </ItemGroup>
        </section>
      )}

      {(isKeeping(state) || !member) && (
        <section>
          <ItemGroup>
            {isKeeping(state) && (
              <Item asChild size="sm" className="px-3">
                <button type="button" className="w-full text-left">
                  <ItemContent>
                    <ItemTitle className="font-normal text-muted-foreground">
                      Stop flamekeeping
                    </ItemTitle>
                  </ItemContent>
                </button>
              </Item>
            )}
            {!member && (
              <Item asChild size="sm" className="px-3">
                <button type="button" className="w-full text-left">
                  <ItemContent>
                    <ItemTitle className="font-normal text-destructive">
                      Delete my account
                    </ItemTitle>
                  </ItemContent>
                </button>
              </Item>
            )}
          </ItemGroup>
        </section>
      )}
    </div>
  )
}

function DialogRow({
  field,
  value,
  onEdit,
}: {
  field: Field
  value: string
  onEdit: () => void
}) {
  return (
    <Item asChild size="sm">
      <button
        type="button"
        onClick={onEdit}
        className="w-full cursor-pointer text-left hover:bg-accent/50"
      >
        <ItemContent>
          <ItemTitle>{field.label}</ItemTitle>
        </ItemContent>
        <ItemDescription className="min-w-0 truncate">
          {value || field.placeholder}
        </ItemDescription>
        <ChevronRight className="size-4 text-muted-foreground" />
      </button>
    </Item>
  )
}

export function VariantB({ state }: VariantProps) {
  const { values, set } = useValues()
  const [editing, setEditing] = useState<Field | null>(null)
  const [draft, setDraft] = useState('')
  const flame = FLAME[state]
  const member = state !== 'guest'
  const open = (field: Field) => {
    setDraft(values[field.key])
    setEditing(field)
  }
  const group = 'overflow-hidden rounded-xl bg-muted/40'

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-8 pb-40 lg:grid-cols-[260px_1fr]">
      <aside className="flex flex-col items-center gap-3 text-center lg:sticky lg:top-20 lg:self-start">
        <Initials className="size-24" />
        <div>
          <p className="text-xl font-semibold">
            {member ? 'Aigerim Sample' : 'Welcome'}
          </p>
          <p className="text-sm break-all text-muted-foreground">{EMAIL}</p>
        </div>
        {member && (
          <div className="flex flex-wrap justify-center gap-1">
            <Badge>Active</Badge>
            <Badge variant="outline">Member</Badge>
            <Badge variant="secondary">Level 3</Badge>
          </div>
        )}
        <FlameMotif state={motif(state)} size={36} className="mt-4" />
        <p className="text-sm font-medium">{flame.title}</p>
      </aside>

      <div className="min-w-0 space-y-6">
        <ItemGroup className={group}>
          <Item size="sm">
            <ItemContent>
              <ItemTitle>Flamekeeper</ItemTitle>
              <ItemDescription>{flame.description}</ItemDescription>
            </ItemContent>
            {flame.action && (
              <ItemActions>
                <Button size="sm">{flame.action}</Button>
              </ItemActions>
            )}
          </Item>
          {isPledged(state) && (
            <>
              <ItemSeparator />
              <Item asChild size="sm">
                <button
                  type="button"
                  className="w-full cursor-pointer text-left hover:bg-accent/50"
                >
                  <ItemContent>
                    <ItemTitle>Pledge</ItemTitle>
                    <Progress value={pledgePercent(state)} className="h-1" />
                  </ItemContent>
                  <ItemDescription>{pledgeLine(state)}</ItemDescription>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </button>
              </Item>
              <ItemSeparator />
              <Item asChild size="sm">
                <button
                  type="button"
                  className="w-full cursor-pointer text-left hover:bg-accent/50"
                >
                  <ItemContent>
                    <ItemTitle>Graduating</ItemTitle>
                  </ItemContent>
                  <ItemDescription>June 2028</ItemDescription>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </button>
              </Item>
            </>
          )}
        </ItemGroup>

        {member && (
          <ItemGroup className={group}>
            {[...PERSONAL, INSTAGRAM].map((field, index) => (
              <div key={field.key}>
                {index > 0 && <ItemSeparator />}
                <DialogRow
                  field={field}
                  value={values[field.key]}
                  onEdit={() => open(field)}
                />
              </div>
            ))}
            <ItemSeparator />
            <Item asChild size="sm">
              <button
                type="button"
                className="w-full cursor-pointer text-left hover:bg-accent/50"
              >
                <ItemContent>
                  <ItemTitle>Telegram</ItemTitle>
                </ItemContent>
                <ItemDescription>{TELEGRAM}</ItemDescription>
                <ChevronRight className="size-4 text-muted-foreground" />
              </button>
            </Item>
          </ItemGroup>
        )}

        {!member && (
          <ItemGroup className={group}>
            <Item size="sm">
              <ItemContent className="min-w-40">
                <ItemTitle>Join the club</ItemTitle>
                <ItemDescription>Enter the club code.</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Input placeholder="Club code" className="w-32" />
                <Button size="sm">Join</Button>
              </ItemActions>
            </Item>
          </ItemGroup>
        )}

        {(isKeeping(state) || !member) && (
          <ItemGroup className={group}>
            <Item asChild size="sm">
              <button
                type="button"
                className={cn(
                  'w-full cursor-pointer justify-center hover:bg-accent/50',
                  member ? 'text-muted-foreground' : 'text-destructive'
                )}
              >
                {member ? 'Stop flamekeeping' : 'Delete my account'}
              </button>
            </Item>
          </ItemGroup>
        )}
      </div>

      <Dialog
        open={editing !== null}
        onOpenChange={(next) => !next && setEditing(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.label}</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <DialogFooter>
            <Button
              onClick={() => {
                if (editing) set(editing.key, draft)
                setEditing(null)
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function VariantC({ state }: VariantProps) {
  const { values, set } = useValues()
  const [editing, setEditing] = useState(false)
  const flame = FLAME[state]
  const member = state !== 'guest'
  const cell = 'items-start px-3 py-3'

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8 pb-40">
      <div className="flex flex-wrap items-center gap-4 px-3">
        <Initials className="size-12" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {member ? 'Aigerim Sample' : EMAIL}
          </h1>
          {member && (
            <p className="text-sm text-muted-foreground">
              Active · Member · Level 3 · Joined September 2025
            </p>
          )}
        </div>
        {member && (
          <Button
            variant={editing ? 'default' : 'outline'}
            onClick={() => setEditing(!editing)}
          >
            {editing ? 'Save changes' : 'Edit profile'}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-y px-3 py-3">
        <FlameMotif state={motif(state)} size={18} />
        <p className="text-sm font-medium">{flame.title}</p>
        {isPledged(state) && (
          <p className="text-sm text-muted-foreground">
            {pledgeLine(state)} · Graduating June 2028
          </p>
        )}
        <div className="ml-auto flex flex-wrap gap-1">
          {flame.action && <Button size="sm">{flame.action}</Button>}
          {isKeeping(state) && (
            <>
              <Button size="sm" variant="ghost">
                Edit pledge
              </Button>
              <Button size="sm" variant="ghost">
                Stop
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
        {member &&
          [...PERSONAL, INSTAGRAM].map((field) => (
            <Item key={field.key} className={cell}>
              <ItemContent className="min-w-0">
                <ItemDescription>{field.label}</ItemDescription>
                {editing ? (
                  <Input
                    value={values[field.key]}
                    onChange={(event) => set(field.key, event.target.value)}
                  />
                ) : (
                  <ItemTitle
                    className={cn(
                      'text-base',
                      !values[field.key] && 'text-muted-foreground'
                    )}
                  >
                    {values[field.key] || field.placeholder}
                  </ItemTitle>
                )}
              </ItemContent>
            </Item>
          ))}
        <Item className={cell}>
          <ItemContent className="min-w-0">
            <ItemDescription>Email</ItemDescription>
            <ItemTitle className="text-base break-all">{EMAIL}</ItemTitle>
          </ItemContent>
        </Item>
        {member && (
          <Item className={cell}>
            <ItemContent>
              <ItemDescription>Telegram</ItemDescription>
              <ItemTitle className="text-base">{TELEGRAM}</ItemTitle>
            </ItemContent>
            <ItemActions>
              <Button size="sm" variant="ghost">
                Relink
              </Button>
            </ItemActions>
          </Item>
        )}
        {!member && (
          <Item className={cn(cell, 'sm:col-span-2')}>
            <ItemContent className="min-w-40">
              <ItemDescription>Join the club</ItemDescription>
              <div className="flex gap-2">
                <Input placeholder="Club code" className="max-w-40" />
                <Button size="sm">Join</Button>
              </div>
            </ItemContent>
          </Item>
        )}
      </div>

      {!member && (
        <Button variant="ghost" size="sm" className="text-destructive">
          Delete my account
        </Button>
      )}
    </div>
  )
}

export function VariantE({ state }: VariantProps) {
  const { values, set } = useValues()
  const flame = FLAME[state]
  const member = state !== 'guest' && state !== 'keeper'
  const graduation = PERSONAL.find((field) => field.key === 'graduation')!

  const fieldItem = (field: Field) => (
    <Item key={field.key} variant="outline" size="sm">
      <ItemContent className="min-w-24">
        <ItemTitle>{field.label}</ItemTitle>
      </ItemContent>
      <Input
        className="w-full sm:w-64"
        value={values[field.key]}
        placeholder={field.placeholder}
        onChange={(event) => set(field.key, event.target.value)}
      />
    </Item>
  )

  return (
    <div className="mx-auto w-full max-w-2xl space-y-10 px-4 py-8 pb-40">
      <div className="flex flex-col items-center gap-3 text-center">
        <Initials className="size-24" />
        <div className="max-w-full">
          <p className="text-xl font-semibold">Aigerim Sample</p>
          <p className="text-sm break-all text-muted-foreground">{EMAIL}</p>
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Flamekeeper</h2>
        <Item variant="muted">
          <ItemMedia>
            <FlameMotif state={motif(state)} size={24} />
          </ItemMedia>
          <ItemContent>
            <ItemTitle className="text-base">{flame.title}</ItemTitle>
            <ItemDescription>{flame.description}</ItemDescription>
          </ItemContent>
          {flame.action && (
            <ItemActions>
              <Button size="sm">{flame.action}</Button>
            </ItemActions>
          )}
        </Item>
        {isPledged(state) && (
          <Item variant="outline" size="sm">
            <ItemContent>
              <ItemTitle>{pledgeLine(state)}</ItemTitle>
              <Progress value={pledgePercent(state)} className="h-1" />
            </ItemContent>
            {isKeeping(state) && (
              <ItemActions>
                <Button size="sm" variant="outline">
                  Edit
                </Button>
              </ItemActions>
            )}
          </Item>
        )}
        {state === 'keeper' && fieldItem(graduation)}
        {isKeeping(state) && (
          <Item variant="outline" size="sm">
            <ItemContent>
              <ItemTitle className="font-normal">Stop flamekeeping</ItemTitle>
            </ItemContent>
            <ItemActions>
              <Button size="sm" variant="ghost">
                Stop
              </Button>
            </ItemActions>
          </Item>
        )}
      </section>

      {member && (
        <>
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">About you</h2>
            {PERSONAL.map(fieldItem)}
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Contact</h2>
            <Item variant="outline" size="sm">
              <ItemContent className="min-w-24">
                <ItemTitle>Email</ItemTitle>
              </ItemContent>
              <Input className="w-full sm:w-64" value={EMAIL} disabled />
            </Item>
            <Item variant="outline" size="sm">
              <ItemContent>
                <ItemTitle>Telegram</ItemTitle>
                <ItemDescription>{TELEGRAM}</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button size="sm" variant="outline">
                  Relink
                </Button>
              </ItemActions>
            </Item>
            {fieldItem(INSTAGRAM)}
          </section>
        </>
      )}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Club</h2>
        {member ? (
          CLUB.map((row) => (
            <Item key={row.label} variant="outline" size="sm">
              <ItemContent>
                <ItemTitle>{row.label}</ItemTitle>
              </ItemContent>
              <ItemDescription>{row.value}</ItemDescription>
            </Item>
          ))
        ) : (
          <Item variant="outline" size="sm">
            <ItemContent className="min-w-40">
              <ItemTitle>Join the club</ItemTitle>
              <ItemDescription>Enter the club code.</ItemDescription>
            </ItemContent>
            <ItemActions>
              <Input placeholder="Club code" className="w-32" />
              <Button size="sm">Join</Button>
            </ItemActions>
          </Item>
        )}
        {state === 'guest' && (
          <Item variant="outline" size="sm">
            <ItemContent>
              <ItemTitle className="text-destructive">
                Delete my account
              </ItemTitle>
            </ItemContent>
            <ItemActions>
              <Button size="sm" variant="destructive">
                Delete
              </Button>
            </ItemActions>
          </Item>
        )}
      </section>
    </div>
  )
}

type Section = 'flame' | 'you' | 'contact' | 'club'

export function VariantD({ state }: VariantProps) {
  const { values, set } = useValues()
  const [section, setSection] = useState<Section>('flame')
  const flame = FLAME[state]
  const member = state !== 'guest'
  const sections: Array<{ key: Section; label: string }> = [
    { key: 'flame', label: 'Flamekeeper' },
    ...(member ? [{ key: 'you' as const, label: 'About you' }] : []),
    { key: 'contact', label: 'Contact' },
    { key: 'club', label: 'Club' },
  ]
  const active = sections.some((s) => s.key === section) ? section : 'flame'

  const fieldItem = (field: Field) => (
    <Item key={field.key} variant="outline" size="sm">
      <ItemContent className="min-w-24">
        <ItemTitle>{field.label}</ItemTitle>
      </ItemContent>
      <Input
        className="w-full sm:w-64"
        value={values[field.key]}
        placeholder={field.placeholder}
        onChange={(event) => set(field.key, event.target.value)}
      />
    </Item>
  )

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-8 pb-40 md:grid-cols-[240px_1fr]">
      <div className="min-w-0 space-y-6 md:sticky md:top-20 md:self-start">
        <div className="flex flex-col items-center gap-3 text-center">
          <Initials className="size-24" />
          <div className="max-w-full">
            <p className="text-xl font-semibold">
              {member ? 'Aigerim Sample' : 'Welcome'}
            </p>
            <p className="text-sm break-all text-muted-foreground">{EMAIL}</p>
          </div>
          {member && (
            <div className="flex flex-wrap justify-center gap-1">
              <Badge>Active</Badge>
              <Badge variant="outline">Member</Badge>
              <Badge variant="secondary">Level 3</Badge>
            </div>
          )}
        </div>
        <nav className="flex gap-1 overflow-x-auto md:flex-col">
          {sections.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSection(s.key)}
              className={cn(
                'shrink-0 rounded-md px-3 py-1.5 text-left text-sm',
                active === s.key
                  ? 'bg-accent font-medium'
                  : 'text-muted-foreground hover:bg-accent/50'
              )}
            >
              {s.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="min-w-0 space-y-2">
        {active === 'flame' && (
          <>
            <Item variant="muted">
              <ItemMedia>
                <FlameMotif state={motif(state)} size={26} />
              </ItemMedia>
              <ItemContent>
                <ItemTitle className="text-base">{flame.title}</ItemTitle>
                <ItemDescription>{flame.description}</ItemDescription>
              </ItemContent>
              {flame.action && (
                <ItemActions>
                  <Button size="sm">{flame.action}</Button>
                </ItemActions>
              )}
            </Item>
            {isPledged(state) && (
              <>
                <Item variant="outline" size="sm">
                  <ItemContent>
                    <ItemTitle>{pledgeLine(state)}</ItemTitle>
                    <Progress value={pledgePercent(state)} className="h-1" />
                  </ItemContent>
                  {isKeeping(state) && (
                    <ItemActions>
                      <Button size="sm" variant="outline">
                        Edit
                      </Button>
                    </ItemActions>
                  )}
                </Item>
              </>
            )}
            {isKeeping(state) && (
              <Item variant="outline" size="sm">
                <ItemContent>
                  <ItemTitle className="font-normal">
                    Stop flamekeeping
                  </ItemTitle>
                </ItemContent>
                <ItemActions>
                  <Button size="sm" variant="ghost">
                    Stop
                  </Button>
                </ItemActions>
              </Item>
            )}
          </>
        )}

        {active === 'you' && PERSONAL.map(fieldItem)}

        {active === 'contact' && (
          <>
            <Item variant="outline" size="sm">
              <ItemContent className="min-w-24">
                <ItemTitle>Email</ItemTitle>
              </ItemContent>
              <Input className="w-full sm:w-64" value={EMAIL} disabled />
            </Item>
            {member && (
              <>
                <Item variant="outline" size="sm">
                  <ItemContent>
                    <ItemTitle>Telegram</ItemTitle>
                    <ItemDescription>{TELEGRAM}</ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <Button size="sm" variant="outline">
                      Relink
                    </Button>
                  </ItemActions>
                </Item>
                {fieldItem(INSTAGRAM)}
              </>
            )}
          </>
        )}

        {active === 'club' &&
          (member ? (
            CLUB.map((row) => (
              <Item key={row.label} variant="outline" size="sm">
                <ItemContent>
                  <ItemTitle>{row.label}</ItemTitle>
                </ItemContent>
                <ItemDescription>{row.value}</ItemDescription>
              </Item>
            ))
          ) : (
            <>
              <Item variant="outline" size="sm">
                <ItemContent className="min-w-40">
                  <ItemTitle>Join the club</ItemTitle>
                  <ItemDescription>Enter the club code.</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Input placeholder="Club code" className="w-32" />
                  <Button size="sm">Join</Button>
                </ItemActions>
              </Item>
              <Item variant="outline" size="sm">
                <ItemContent>
                  <ItemTitle className="text-destructive">
                    Delete my account
                  </ItemTitle>
                </ItemContent>
                <ItemActions>
                  <Button size="sm" variant="destructive">
                    Delete
                  </Button>
                </ItemActions>
              </Item>
            </>
          ))}
      </div>
    </div>
  )
}
