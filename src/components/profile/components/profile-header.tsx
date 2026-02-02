import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar, Mail, Instagram } from "lucide-react";
import type { UserProfile } from "@/lib/user/types";

interface ProfileHeaderProps {
  user: UserProfile;
}

export function ProfileHeader({ user }: ProfileHeaderProps) {
  const joinedDate = new Date(user.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
  });

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.name;
  const initials = [user.firstName?.[0], user.lastName?.[0]].filter(Boolean).join('').toUpperCase() || user.name[0]?.toUpperCase() || 'U';

  const statusVariant = user.status === 'Active' ? 'default' : 
                       user.status === 'Inactive' ? 'secondary' : 
                       user.status === 'On Probation' ? 'destructive' : 'outline';

  const roleLabel = user.role === 'admin' ? 'Admin' : 
                   user.role === 'manager' ? 'Manager' : 
                   user.role ? 'Member' : 'No Role';

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-col items-start gap-6 md:flex-row md:items-center">
          <div className="relative">
            <Avatar className="h-24 w-24">
              <AvatarImage src={user.image || undefined} alt="Profile" />
              <AvatarFallback className="text-2xl">
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <h1 className="text-2xl font-bold">{fullName}</h1>
              <div className="flex gap-2">
                {user.status && <Badge variant={statusVariant}>{user.status}</Badge>}
                <Badge variant="outline">{roleLabel}</Badge>
                {user.clearanceLevel && <Badge variant="secondary">Level {user.clearanceLevel}</Badge>}
              </div>
            </div>
            {user.major && (
              <p className="text-muted-foreground">
                {user.major}
                {user.graduationYear && ` • Class of ${user.graduationYear}`}
              </p>
            )}
            <div className="text-muted-foreground flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-1">
                <Mail className="size-4" />
                {user.email}
              </div>
              {user.instagramUsername && (
                <div className="flex items-center gap-1">
                  <Instagram className="size-4" />
                  @{user.instagramUsername}
                </div>
              )}
              <div className="flex items-center gap-1">
                <Calendar className="size-4" />
                Joined {joinedDate}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
