"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Clock, Plus, Pencil, Trash, Star, Building } from "lucide-react";
import { toast } from "sonner";
import { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hours = Math.floor(i / 2);
  const minutes = (i % 2) * 30;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
});

interface WeeklyHour {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export default function SchedulesPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    isDefault: false,
    weeklyHours: [] as WeeklyHour[],
  });

  // Get organizations to find one to use
  const organizations = useQuery(api.booking.listOrganizations, {});
  const firstOrg = organizations?.[0];

  // Only query schedules if we have an organization
  const schedules = useQuery(
    api.booking.listSchedules,
    firstOrg ? { organizationId: firstOrg._id } : "skip"
  );

  const createSchedule = useMutation(api.booking.createSchedule);
  const updateSchedule = useMutation(api.booking.updateSchedule);
  const deleteSchedule = useMutation(api.booking.deleteSchedule);
  const createOrganization = useMutation(api.booking.createOrganization);

  const handleCreateDemoOrg = async () => {
    try {
      await createOrganization({
        id: `org_${Date.now()}`,
        name: "Demo Organization",
        slug: "demo",
      });
      toast.success("Demo organization created!");
    } catch (error: any) {
      toast.error(error.message || "Failed to create organization");
    }
  };

  const openCreateModal = () => {
    setFormData({
      name: "",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      isDefault: false,
      weeklyHours: [
        { dayOfWeek: 1, startTime: "09:00", endTime: "17:00" },
        { dayOfWeek: 2, startTime: "09:00", endTime: "17:00" },
        { dayOfWeek: 3, startTime: "09:00", endTime: "17:00" },
        { dayOfWeek: 4, startTime: "09:00", endTime: "17:00" },
        { dayOfWeek: 5, startTime: "09:00", endTime: "17:00" },
      ],
    });
    setEditingSchedule(null);
    setShowCreateModal(true);
  };

  const openEditModal = (schedule: any) => {
    setFormData({
      name: schedule.name,
      timezone: schedule.timezone,
      isDefault: schedule.isDefault,
      weeklyHours: schedule.weeklyHours,
    });
    setEditingSchedule(schedule);
    setShowCreateModal(true);
  };

  const addDayHours = () => {
    const usedDays = formData.weeklyHours.map((h) => h.dayOfWeek);
    const nextDay = DAYS_OF_WEEK.find((d) => !usedDays.includes(d.value))?.value ?? 0;
    setFormData({
      ...formData,
      weeklyHours: [
        ...formData.weeklyHours,
        { dayOfWeek: nextDay, startTime: "09:00", endTime: "17:00" },
      ],
    });
  };

  const removeDayHours = (index: number) => {
    setFormData({
      ...formData,
      weeklyHours: formData.weeklyHours.filter((_, i) => i !== index),
    });
  };

  const updateDayHours = (index: number, field: keyof WeeklyHour, value: string | number) => {
    const updated = [...formData.weeklyHours];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, weeklyHours: updated });
  };

  const handleSubmit = async () => {
    if (!formData.name) {
      toast.error("Name is required");
      return;
    }
    if (!firstOrg) {
      toast.error("No organization found");
      return;
    }

    try {
      if (editingSchedule) {
        await updateSchedule({
          id: editingSchedule.id,
          name: formData.name,
          timezone: formData.timezone,
          isDefault: formData.isDefault,
          weeklyHours: formData.weeklyHours,
        });
        toast.success("Schedule updated");
      } else {
        await createSchedule({
          id: `sch_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          organizationId: firstOrg._id,
          name: formData.name,
          timezone: formData.timezone,
          isDefault: formData.isDefault,
          weeklyHours: formData.weeklyHours,
        });
        toast.success("Schedule created");
      }
      setShowCreateModal(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to save schedule");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this schedule?")) return;
    try {
      await deleteSchedule({ id });
      toast.success("Schedule deleted");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete schedule");
    }
  };

  const getDayLabel = (dayOfWeek: number) => {
    return DAYS_OF_WEEK.find((d) => d.value === dayOfWeek)?.label ?? "Unknown";
  };

  const formatHours = (weeklyHours: WeeklyHour[]) => {
    const sorted = [...weeklyHours].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
    return sorted
      .map((h) => `${getDayLabel(h.dayOfWeek).slice(0, 3)} ${h.startTime}-${h.endTime}`)
      .join(", ");
  };

  // Show setup message if no organization exists
  if (organizations !== undefined && organizations.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Schedules</h1>
          <p className="text-muted-foreground">
            Manage availability schedules for your event types
          </p>
        </div>
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Building className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No Organization</h3>
              <p className="text-muted-foreground mt-2">
                Create an organization first to manage schedules
              </p>
              <Button className="mt-4" onClick={handleCreateDemoOrg}>
                <Plus className="mr-2 h-4 w-4" />
                Create Demo Organization
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Schedules</h1>
          <p className="text-muted-foreground">
            Manage availability schedules for your event types
          </p>
        </div>
        <Button onClick={openCreateModal} disabled={!firstOrg}>
          <Plus className="mr-2 h-4 w-4" />
          New Schedule
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Schedules</CardTitle>
          <CardDescription>
            Configure weekly hours and date overrides for each schedule
          </CardDescription>
        </CardHeader>
        <CardContent>
          {schedules === undefined ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : schedules.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No schedules</h3>
              <p className="text-muted-foreground">
                Create a schedule to define your availability
              </p>
              <Button className="mt-4" onClick={openCreateModal}>
                <Plus className="mr-2 h-4 w-4" />
                Create Schedule
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Timezone</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.map((schedule) => (
                  <TableRow key={schedule._id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{schedule.name}</span>
                        {schedule.isDefault && (
                          <Badge variant="secondary">
                            <Star className="h-3 w-3 mr-1" />
                            Default
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {schedule.timezone}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">
                      {formatHours(schedule.weeklyHours)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditModal(schedule)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(schedule.id)}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingSchedule ? "Edit Schedule" : "Create Schedule"}
            </DialogTitle>
            <DialogDescription>
              Define when you are available for bookings
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Schedule Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Business Hours"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Select
                value={formData.timezone}
                onValueChange={(v) =>
                  setFormData({ ...formData, timezone: v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Intl.supportedValuesOf("timeZone").map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="isDefault">Set as default schedule</Label>
              <Switch
                id="isDefault"
                checked={formData.isDefault}
                onCheckedChange={(v) =>
                  setFormData({ ...formData, isDefault: v })
                }
              />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Weekly Hours</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addDayHours}
                  disabled={formData.weeklyHours.length >= 7}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Day
                </Button>
              </div>
              {formData.weeklyHours.map((hours, index) => (
                <div key={index} className="flex items-center gap-3">
                  <Select
                    value={hours.dayOfWeek.toString()}
                    onValueChange={(v) =>
                      updateDayHours(index, "dayOfWeek", Number(v))
                    }
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYS_OF_WEEK.map((day) => (
                        <SelectItem key={day.value} value={day.value.toString()}>
                          {day.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={hours.startTime}
                    onValueChange={(v) =>
                      updateDayHours(index, "startTime", v)
                    }
                  >
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.map((time) => (
                        <SelectItem key={time} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-muted-foreground">to</span>
                  <Select
                    value={hours.endTime}
                    onValueChange={(v) =>
                      updateDayHours(index, "endTime", v)
                    }
                  >
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.map((time) => (
                        <SelectItem key={time} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeDayHours(index)}
                    disabled={formData.weeklyHours.length <= 1}
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              {editingSchedule ? "Save Changes" : "Create Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
