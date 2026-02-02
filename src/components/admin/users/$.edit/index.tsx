import { useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
import { updateUserAdminFn } from '@/lib/user'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Save, User, Shield, AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

const editUserSchema = z.object({
  role: z.enum(['user', 'manager', 'admin']),
  clearanceLevel: z.number().min(1).max(10),
  status: z.enum(['Active', 'Inactive', 'On Probation', 'Board', 'Ex-Board', 'Roommate', 'Ex-Roommate', 'Graduated']),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
})

type EditUserForm = z.infer<typeof editUserSchema>

interface PageProps {
  targetUser: any
  currentUser: any
  userId: string
}

export function Page({ targetUser, currentUser, userId }: PageProps) {
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const canAssignElevatedRoles = currentUser.role === 'admin'

  const form = useForm<EditUserForm>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      role: targetUser.role || 'user',
      clearanceLevel: targetUser.clearanceLevel || 1,
      status: targetUser.status || 'Active',
      firstName: targetUser.firstName || '',
      lastName: targetUser.lastName || '',
    },
  })

  const onSubmit = async (data: EditUserForm) => {
    setIsSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      await updateUserAdminFn({
        data: {
          userId,
          ...data,
        },
      })

      setSuccess('User updated successfully!')
      
      setTimeout(() => {
        navigate({ to: '/admin/users' })
      }, 1500)
    } catch (error) {
      console.error('Failed to update user:', error)
      setError(error instanceof Error ? error.message : 'Failed to update user. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    navigate({ to: '/admin/users' })
  }

  return (
    <div className="h-full flex-1 flex-col gap-6 p-4 sm:gap-8 sm:p-8 md:flex">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            className="flex items-center gap-2 w-fit"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Users
          </Button>
          <div className="flex flex-col gap-1">
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">Edit User</h2>
            <p className="text-sm sm:text-base text-muted-foreground">
              Modify user role, clearance level, status, and profile information
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            User Information
          </CardTitle>
          <CardDescription>
            Editing user: {targetUser.name || `${targetUser.firstName} ${targetUser.lastName}`} ({targetUser.email})
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">User ID:</span>
              <span className="ml-2 font-mono text-muted-foreground break-all">{targetUser.id}</span>
            </div>
            <div>
              <span className="font-medium">Email:</span>
              <span className="ml-2 text-muted-foreground break-all">{targetUser.email}</span>
            </div>
            <div>
              <span className="font-medium">Current Role:</span>
              <Badge variant={targetUser.role === 'admin' ? 'destructive' : targetUser.role === 'manager' ? 'default' : 'secondary'} className="ml-2">
                {targetUser.role === 'admin' && <Shield className="h-3 w-3 mr-1" />}
                {targetUser.role === 'manager' && <Shield className="h-3 w-3 mr-1" />}
                {targetUser.role || 'No Role'}
              </Badge>
            </div>
            <div>
              <span className="font-medium">Current Status:</span>
              <Badge variant="outline" className="ml-2">
                {targetUser.status || 'No Status'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {!canAssignElevatedRoles && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You can only assign 'user' roles. Admin role assignment requires admin privileges.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Edit User Details</CardTitle>
          <CardDescription>
            Update the user's role, clearance level, status, and profile information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        disabled={isSubmitting}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem 
                            value="manager" 
                            disabled={!canAssignElevatedRoles}
                          >
                            Manager {!canAssignElevatedRoles && '(Admin Only)'}
                          </SelectItem>
                          <SelectItem 
                            value="admin" 
                            disabled={!canAssignElevatedRoles}
                          >
                            Admin {!canAssignElevatedRoles && '(Admin Only)'}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="clearanceLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Clearance Level</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          max="10"
                          placeholder="Enter clearance level (1-10)"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={isSubmitting}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Inactive">Inactive</SelectItem>
                        <SelectItem value="On Probation">On Probation</SelectItem>
                        <SelectItem value="Board">Board</SelectItem>
                        <SelectItem value="Ex-Board">Ex-Board</SelectItem>
                        <SelectItem value="Roommate">Roommate</SelectItem>
                        <SelectItem value="Ex-Roommate">Ex-Roommate</SelectItem>
                        <SelectItem value="Graduated">Graduated</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter first name"
                          {...field}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter last name"
                          {...field}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert className="border-green-200 bg-green-50 text-green-800">
                  <AlertDescription>{success}</AlertDescription>
                </Alert>
              )}

              <div className="flex flex-col gap-4 pt-4 sm:flex-row sm:items-center">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 w-full sm:w-auto"
                >
                  <Save className="h-4 w-4" />
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isSubmitting}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
