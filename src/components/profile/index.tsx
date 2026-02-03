import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/layout/section";
import { ProfileHeader } from "./components/profile-header";
import { ProfileContent } from "./components/profile-content";
import type { UserProfile } from "@/lib/user/types";

interface ProfilePageProps {
  user?: UserProfile;
}

export function Page({ user }: ProfilePageProps) {
  if (!user) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center py-10">
          <div className="text-muted-foreground">Please sign in to view your profile.</div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title="Profile" />
      <div className="space-y-6">
        <Section spacing="compact">
          <ProfileHeader user={user} />
        </Section>
        <Section>
          <ProfileContent user={user} />
        </Section>
      </div>
    </PageContainer>
  );
}
