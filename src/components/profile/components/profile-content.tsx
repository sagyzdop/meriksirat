import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Shield, Upload, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Field, FieldLabel, FieldError, FieldDescription } from "@/components/ui/field";
import { updateUserProfileFn } from "@/lib/user/functions";
import { useRouter } from "@tanstack/react-router";
import type { UserProfile } from "@/lib/user/types";
import { DataTable } from "@/components/data-table/data-table";
import { bookingHistoryColumns } from "./booking-history-columns";
import { getUserBookingsFn } from "@/lib/booking/functions/user-bookings";
import { useQuery } from "@tanstack/react-query";

interface ProfileContentProps {
  user: UserProfile;
}

const profileFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  instagramUsername: z.string().optional(),
  birthday: z.string().optional(),
  major: z.string().optional(),
  graduationYear: z.string().optional(),
  image: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export function ProfileContent({ user }: ProfileContentProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user.image);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch user's booking history
  const { data: bookingsData, isLoading: isLoadingBookings } = useQuery({
    queryKey: ['user-bookings', { page: 1, limit: 10 }],
    queryFn: () => getUserBookingsFn({ data: { page: 1, limit: 10 } }),
  });

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: user.name || "",
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      instagramUsername: user.instagramUsername || "",
      birthday: user.birthday || "",
      major: user.major || "",
      graduationYear: user.graduationYear?.toString() || "",
      image: user.image || "",
    },
  });

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size must be less than 5MB');
        return;
      }

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setAvatarPreview(result);
        form.setValue('image', result);
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (data: ProfileFormValues) => {
    setIsSaving(true);
    try {
      const updateData = {
        ...data,
        graduationYear: data.graduationYear && data.graduationYear !== "" ? Number(data.graduationYear) : undefined,
      };
      
      await updateUserProfileFn({ data: updateData });
      toast.success("Profile updated successfully");
      setIsEditing(false);
      router.invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    form.reset();
    setAvatarPreview(user.image);
    setIsEditing(false);
  };

  return (
    <Tabs defaultValue="personal" className="space-y-6">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="personal">Personal</TabsTrigger>
        <TabsTrigger value="account">Account</TabsTrigger>
        <TabsTrigger value="connections">Connections</TabsTrigger>
      </TabsList>

      {/* Personal Information */}
      <TabsContent value="personal" className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>Update your personal details and profile information.</CardDescription>
              </div>
              {!isEditing ? (
                <Button onClick={() => setIsEditing(true)}>Edit Profile</Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
                    Cancel
                  </Button>
                  <Button onClick={form.handleSubmit(onSubmit)} disabled={isSaving}>
                    {isSaving ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Avatar Section */}
              <div className="flex items-center gap-6">
                <Avatar size="lg" className="size-20">
                  <AvatarImage src={avatarPreview || undefined} alt={user.name} />
                  <AvatarFallback>
                    <User className="size-8" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-2">
                  <Label>Profile Picture</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      disabled={!isEditing}
                      className="hidden"
                      id="avatar-upload"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!isEditing}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="mr-2 size-4" />
                      Upload Photo
                    </Button>
                    {avatarPreview && isEditing && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setAvatarPreview(null);
                          form.setValue('image', '');
                          if (fileInputRef.current) {
                            fileInputRef.current.value = '';
                          }
                        }}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    JPG, PNG or GIF. Max size 5MB.
                  </p>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="name">
                    Display Name <span className="text-destructive">*</span>
                  </FieldLabel>
                  <Input
                    id="name"
                    {...form.register("name")}
                    disabled={!isEditing}
                  />
                  <FieldError>{form.formState.errors.name?.message}</FieldError>
                </Field>

                <Field>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input id="email" type="email" value={user.email} disabled />
                  <FieldDescription>Email cannot be changed</FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="firstName">
                    First Name <span className="text-destructive">*</span>
                  </FieldLabel>
                  <Input
                    id="firstName"
                    {...form.register("firstName")}
                    disabled={!isEditing}
                  />
                  <FieldError>{form.formState.errors.firstName?.message}</FieldError>
                </Field>

                <Field>
                  <FieldLabel htmlFor="lastName">
                    Last Name <span className="text-destructive">*</span>
                  </FieldLabel>
                  <Input
                    id="lastName"
                    {...form.register("lastName")}
                    disabled={!isEditing}
                  />
                  <FieldError>{form.formState.errors.lastName?.message}</FieldError>
                </Field>

                <Field>
                  <FieldLabel htmlFor="birthday">Birthday</FieldLabel>
                  <Input
                    id="birthday"
                    type="date"
                    {...form.register("birthday")}
                    disabled={!isEditing}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="instagramUsername">Instagram Username</FieldLabel>
                  <Input
                    id="instagramUsername"
                    placeholder="username"
                    {...form.register("instagramUsername")}
                    disabled={!isEditing}
                  />
                  <FieldDescription>Without the @ symbol</FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="major">Major</FieldLabel>
                  <Input
                    id="major"
                    placeholder="e.g., Computer Science"
                    {...form.register("major")}
                    disabled={!isEditing}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="graduationYear">Graduation Year</FieldLabel>
                  <Input
                    id="graduationYear"
                    type="number"
                    placeholder="e.g., 2025"
                    {...form.register("graduationYear")}
                    disabled={!isEditing}
                  />
                  <FieldError>{form.formState.errors.graduationYear?.message}</FieldError>
                </Field>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Booking History Section */}
        <Card>
          <CardHeader>
            <CardTitle>Booking History</CardTitle>
            <CardDescription>View your recent equipment bookings and their status.</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={bookingHistoryColumns}
              data={bookingsData?.data || []}
              loading={isLoadingBookings}
              emptyMessage="No bookings found"
              pageSize={10}
            />
          </CardContent>
        </Card>
      </TabsContent>

      {/* Account Settings */}
      <TabsContent value="account" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>View your account status and permissions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-base">Account Status</Label>
                <p className="text-muted-foreground text-sm">Your current membership status</p>
              </div>
              <Badge variant={user.status === 'Active' ? 'default' : 'secondary'}>
                {user.status || 'Unknown'}
              </Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-base">Role</Label>
                <p className="text-muted-foreground text-sm">Your access level in the system</p>
              </div>
              <Badge variant="outline">
                {user.role === 'admin' ? 'Admin' : user.role === 'manager' ? 'Manager' : user.role ? 'Member' : 'No Role'}
              </Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-base">Clearance Level</Label>
                <p className="text-muted-foreground text-sm">Equipment access clearance</p>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="size-4 text-muted-foreground" />
                <Badge variant="secondary">Level {user.clearanceLevel || 1}</Badge>
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-base">Email Verification</Label>
                <p className="text-muted-foreground text-sm">Email verification status</p>
              </div>
              <Badge variant={user.emailVerified ? 'default' : 'destructive'}>
                {user.emailVerified ? 'Verified' : 'Not Verified'}
              </Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-base">Onboarding</Label>
                <p className="text-muted-foreground text-sm">Profile setup completion</p>
              </div>
              <Badge variant={user.onboardingComplete ? 'default' : 'secondary'}>
                {user.onboardingComplete ? 'Complete' : 'Incomplete'}
              </Badge>
            </div>
            {user.nuId && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-base">NU ID</Label>
                    <p className="text-muted-foreground text-sm">Your university ID number</p>
                  </div>
                  <Badge variant="outline">{user.nuId}</Badge>
                </div>
              </>
            )}
            <Separator />
            <div className="space-y-1">
              <Label className="text-base">Account Created</Label>
              <p className="text-muted-foreground text-sm">
                {new Date(user.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-base">Last Updated</Label>
              <p className="text-muted-foreground text-sm">
                {new Date(user.updatedAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Connections */}
      <TabsContent value="connections" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Connected Accounts</CardTitle>
            <CardDescription>Manage your connected social and authentication accounts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-base">Telegram</Label>
                <p className="text-muted-foreground text-sm">
                  {user.telegramUsername ? `@${user.telegramUsername}` : 'Not connected'}
                </p>
              </div>
              <Badge variant={user.telegramChatId ? 'default' : 'secondary'}>
                {user.telegramChatId ? 'Connected' : 'Not Connected'}
              </Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-base">Google</Label>
                <p className="text-muted-foreground text-sm">
                  {user.googleId ? 'Connected for authentication' : 'Not connected'}
                </p>
              </div>
              <Badge variant={user.googleId ? 'default' : 'secondary'}>
                {user.googleId ? 'Connected' : 'Not Connected'}
              </Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-base">Instagram</Label>
                <p className="text-muted-foreground text-sm">
                  {user.instagramUsername ? `@${user.instagramUsername}` : 'Not set'}
                </p>
              </div>
              <Badge variant={user.instagramUsername ? 'default' : 'secondary'}>
                {user.instagramUsername ? 'Set' : 'Not Set'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
