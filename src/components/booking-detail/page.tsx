import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarDays, Download, Eye, FileText, MoreHorizontal } from "lucide-react";

export function Page() {
  return (
    <div className="bg-background min-h-screen p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h1 className="text-foreground text-2xl font-semibold">Workplace Safety Guide 2024</h1>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="border-red-200 bg-red-50 text-red-700">
                To-Do
              </Badge>
            </div>
          </div>
          <Button variant="ghost" size="icon">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>

        {/* Task Details Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Assignees */}
            <div className="space-y-3">
              <h3 className="text-muted-foreground text-sm font-medium">Assignee:</h3>
              <div className="flex items-center gap-3">
                <div className="bg-card flex items-center gap-2 rounded-lg border px-3 py-2">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src="/professional-man.jpg" />
                    <AvatarFallback>RS</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">Raden Sam Pitak</span>
                </div>
                <div className="bg-card flex items-center gap-2 rounded-lg border px-3 py-2">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src="/professional-man-glasses.png" />
                    <AvatarFallback>JK</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">James Kokoklomel</span>
                </div>
              </div>
            </div>

            {/* Date */}
            <div className="space-y-3">
              <h3 className="text-muted-foreground text-sm font-medium">Date</h3>
              <div className="bg-card flex w-fit items-center gap-2 rounded-lg border px-3 py-2">
                <CalendarDays className="text-muted-foreground h-4 w-4" />
                <span className="text-sm">May 18, 2024 - May 26, 2024</span>
              </div>
            </div>

            {/* Priority */}
            <div className="space-y-3">
              <h3 className="text-muted-foreground text-sm font-medium">Priority</h3>
              <Badge variant="secondary" className="w-fit border-blue-200 bg-blue-50 text-blue-700">
                Low
              </Badge>
            </div>
          </div>

          {/* Right Column - Attachments */}
          <div className="space-y-3">
            <h3 className="text-muted-foreground text-sm font-medium">Attachment</h3>
            <div className="grid gap-3">
              {/* Attachment 1 */}
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-red-100 p-2">
                      <FileText className="h-4 w-4 text-red-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">1248371294812.pdf</p>
                      <p className="text-muted-foreground text-xs">20 MB</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>

              {/* Attachment 2 */}
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-red-100 p-2">
                      <FileText className="h-4 w-4 text-red-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">guideline fix_2024.pdf</p>
                      <p className="text-muted-foreground text-xs">101 MB</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>

              {/* Attachment 3 */}
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-red-100 p-2">
                      <FileText className="h-4 w-4 text-red-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">21412981364.pdf</p>
                      <p className="text-muted-foreground text-xs">82 MB</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="space-y-3">
          <h3 className="text-muted-foreground text-sm font-medium">Description</h3>
          <Card className="p-4">
            <div className="border-l-4 border-blue-500 pl-4">
              <p className="text-foreground text-sm leading-relaxed">
                Create a comprehensive safety guide for the workplace, focusing on updated safety
                protocols, regulations, and best practices for 2024. The guide should cover
                essential topics such as emergency procedures, hazard identification, employee
                training, and equipment safety. Ensure the content is clear, practical, and
                accessible to all employees. Include visual aids, checklists, and real-life examples
                to enhance understanding and compliance.
              </p>
            </div>
          </Card>
        </div>

        {/* Phase 1 */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">🚀</span>
            <h2 className="text-lg font-semibold">Phase 1</h2>
          </div>

          <Card className="p-4">
            <div className="border-l-4 border-blue-500 pl-4">
              <p className="text-muted-foreground text-sm">
                The guide should be aligned with current industry standards and legal requirements,
                promoting a safe and healthy work environment for everyone.
              </p>
            </div>
          </Card>

          {/* Task Progress */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-green-600">✅</span>
                <h3 className="font-medium">Task - Phase 1</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm">3/4</span>
                <div className="flex gap-1">
                  <div className="h-2 w-8 rounded-full bg-green-500"></div>
                  <div className="h-2 w-8 rounded-full bg-green-500"></div>
                  <div className="h-2 w-8 rounded-full bg-green-500"></div>
                  <div className="bg-muted h-2 w-8 rounded-full"></div>
                </div>
              </div>
            </div>

            {/* Task List */}
            <div className="space-y-3">
              {/* Completed Tasks */}
              <div className="bg-card flex items-center gap-3 rounded-lg border p-3">
                <Checkbox checked disabled />
                <span className="text-muted-foreground text-sm line-through">
                  Update Safety Protocols
                </span>
                <div className="ml-auto">
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="bg-card flex items-center gap-3 rounded-lg border p-3">
                <Checkbox checked disabled />
                <span className="text-muted-foreground text-sm line-through">
                  Develop Clear Emergency Procedures
                </span>
                <div className="ml-auto">
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="bg-card flex items-center gap-3 rounded-lg border p-3">
                <Checkbox checked disabled />
                <span className="text-muted-foreground text-sm line-through">
                  Create Employee Training Modules
                </span>
                <div className="ml-auto">
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Pending Task */}
              <div className="bg-card flex items-center gap-3 rounded-lg border p-3">
                <Checkbox />
                <span className="text-sm font-medium">Include Visuals and Checklists</span>
                <div className="ml-auto">
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
