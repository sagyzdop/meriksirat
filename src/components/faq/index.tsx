import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'

const faqItems = [
  {
    id: 'getting-started',
    question: 'How do I get started with booking equipment?',
    answer:
      'Sign in with your Google account and complete your profile with your personal information. Link your Telegram account for notifications and quick access. Once your profile is complete, browse the equipment catalog and start making bookings.',
  },
  {
    id: 'telegram-linking',
    question: 'Why do I need to link my Telegram account?',
    answer:
      "Telegram linking is required for accountability and communication. You'll receive notifications about your bookings and can use the /return_equipment command through the bot to return equipment with photo verification.",
  },
  {
    id: 'making-booking',
    question: 'How do I book equipment?',
    answer:
      'Browse the equipment catalog, select an item, and view its availability calendar. Choose your desired date and time slots (30-minute increments), add optional notes, and confirm your booking. The system will check for conflicts and create a Google Calendar event automatically.',
  },
  {
    id: 'booking-duration',
    question: 'How long can I book equipment for?',
    answer:
      'You can book equipment for any duration that fits within the operating hours set by administrators. The system uses 30-minute time slots, and you can select multiple consecutive slots for longer bookings.',
  },
  {
    id: 'viewing-availability',
    question: 'How can I see if equipment is available?',
    answer:
      'Each equipment page shows a Google Calendar view with all bookings. You can see exactly when equipment is available or in use. The equipment catalog also displays real-time availability status for quick browsing.',
  },
  {
    id: 'managing-bookings',
    question: 'How do I manage my bookings?',
    answer:
      'Go to the Bookings page to view all your bookings. You can filter by status (booked, active, returned, cancelled, overdue), view booking details, edit booking times and notes, or cancel bookings you no longer need.',
  },
  {
    id: 'return-process',
    question: 'How do I return equipment?',
    answer:
      "Use the /return_equipment command in the Telegram bot. If you have multiple active bookings, select which items to return. You'll be prompted to send a photo of the equipment as proof of its condition. The photo is timestamped and sent to administrators for verification.",
  },
  {
    id: 'partial-return',
    question: 'Can I return some items while keeping others?',
    answer:
      'Yes! When using /return_equipment in Telegram, you can select specific items to return if you have multiple active bookings. This allows you to return equipment individually as you finish using each item.',
  },
  {
    id: 'clearance-levels',
    question: "Why can't I see certain equipment?",
    answer:
      "Some equipment requires specific clearance levels. Equipment with a higher required clearance level than your account won't appear in your catalog. Contact an administrator if you need access to specialized equipment.",
  },
  {
    id: 'telegram-commands',
    question: 'What Telegram bot commands are available?',
    answer:
      'Use /start with the link from your profile to connect your Telegram account. Use /my_bookings to see active and upcoming bookings, /cancel_booking to cancel items, and /return_equipment to return equipment with photo verification. The bot also sends automatic notifications about your bookings.',
  },
  {
    id: 'calendar-integration',
    question: 'How does Google Calendar integration work?',
    answer:
      'Each piece of equipment has its own dedicated Google Calendar. When you make a booking, an event is automatically created with your details. You can view these calendars directly on equipment pages to see availability and plan your bookings.',
  },
  {
    id: 'booking-notes',
    question: 'Can I add notes to my bookings?',
    answer:
      'Yes! When creating or editing a booking, you can add notes about your intended use. These notes appear in the calendar event and help administrators understand equipment usage patterns. Administrators can also set a global booking note that appears on all bookings.',
  },
]

export function Page() {
  return (
    <PageContainer>
      <PageHeader
        title="Frequently Asked Questions"
        description="Find answers to common questions about booking and managing equipment"
      />
      <div className="mx-auto w-full max-w-4xl">
        <Accordion type="single" collapsible className="space-y-4">
          {faqItems.map((item) => (
            <AccordionItem
              key={item.id}
              value={item.id}
              className="rounded-lg border bg-card px-4 shadow-sm transition-shadow duration-200 hover:shadow-md"
            >
              <AccordionTrigger className="py-4 text-left text-lg font-medium hover:no-underline">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="pb-6 text-base leading-relaxed text-muted-foreground">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </PageContainer>
  )
}
