import {FAQ} from "./faq";

const faqItems = [
  {
    id: "trial",
    question: "Is there a 14-days trial?",
    answer:
      "Yes, we offer a 14-day free trial for all new users. You can access all premium features during this period without any limitations. No credit card required to start your trial."
  },
  {
    id: "premium",
    question: "What's the benefits of the Premium Membership?",
    answer:
      "Premium members get access to advanced features, priority support, unlimited usage, exclusive content, and early access to new features. You also get dedicated account management and custom integrations."
  },
  {
    id: "billing",
    question: "How does billing work?",
    answer:
      "We offer flexible billing options including monthly and annual plans. Annual subscribers get a 20% discount. All plans include a 30-day money-back guarantee."
  },
  {
    id: "support",
    question: "What kind of support do you offer?",
    answer:
      "We provide 24/7 email support for all users, live chat for premium members, and dedicated phone support for enterprise customers. Our average response time is under 2 hours."
  }
];

export function Page() {
  return (
    <div>
      <div id="faqs" className="bg-faq py-16 md:py-32">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="text-foreground mb-4 text-2xl font-bold md:text-3xl">
              Most frequently asked questions
            </h2>
            <p className="text-muted-foreground mx-auto max-w-3xl">
              Here are the most frequently asked questions you may check before getting started
            </p>
          </div>
          <FAQ items={faqItems} />
        </div>
      </div>
    </div>
  );
}
