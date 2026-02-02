import {ProfileHeader} from "./components/profile-header";
import {ProfileContent} from "./components/profile-content";

interface ProfilePageProps {
  user?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email: string;
    image?: string | null;
    createdAt: Date;
  };
}

export function Page({ user }: ProfilePageProps) {
  if (!user) {
    return (
      <div className="container mx-auto space-y-6 px-4 py-10">
        <div className="flex items-center justify-center">
          <div className="text-muted-foreground">Please sign in to view your profile.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 px-4 py-10">
      <ProfileHeader user={user} />
      <ProfileContent user={user} />
    </div>
  );
}
