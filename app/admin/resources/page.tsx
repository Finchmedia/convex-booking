"use client";

import { useState } from "react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Textarea } from "@/components/ui/textarea";
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
import { Users, Plus, Pencil, Trash } from "lucide-react";
import { toast } from "sonner";

// Demo organization ID - in production, this would come from your auth system
const DEMO_ORG_ID = "demo-org";

const RESOURCE_TYPES = [
  { value: "room", label: "Room" },
  { value: "equipment", label: "Equipment" },
  { value: "person", label: "Person" },
  { value: "vehicle", label: "Vehicle" },
  { value: "other", label: "Other" },
];

export default function ResourcesPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingResource, setEditingResource] = useState<any>(null);
  const [pendingToggle, setPendingToggle] = useState<{ id: string; isActive: boolean } | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    type: "room",
    description: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    quantity: 1,
    isFungible: false,
    isStandalone: true,
    isActive: true,
  });

  // Query resources for the demo organization
  const resources = useQuery(api.booking.listResources, {
    organizationId: DEMO_ORG_ID,
  });

  const createResource = useMutation(api.booking.createResource);
  const updateResource = useMutation(api.booking.updateResource);
  const deleteResource = useMutation(api.booking.deleteResource);
  const toggleActive = useMutation(api.booking.toggleResourceActive);

  const openCreateModal = () => {
    setFormData({
      name: "",
      type: "room",
      description: "",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      quantity: 1,
      isFungible: false,
      isStandalone: true,
      isActive: true,
    });
    setEditingResource(null);
    setShowCreateModal(true);
  };

  const openEditModal = (resource: any) => {
    setFormData({
      name: resource.name,
      type: resource.type,
      description: resource.description || "",
      timezone: resource.timezone,
      quantity: resource.quantity || 1,
      isFungible: resource.isFungible || false,
      isStandalone: resource.isStandalone !== false, // Default to true if undefined
      isActive: resource.isActive,
    });
    setEditingResource(resource);
    setShowCreateModal(true);
  };

  const handleSubmit = async () => {
    if (!formData.name) {
      toast.error("Name is required");
      return;
    }

    try {
      if (editingResource) {
        await updateResource({
          id: editingResource.id,
          name: formData.name,
          type: formData.type,
          description: formData.description || undefined,
          timezone: formData.timezone,
          quantity: formData.quantity,
          isFungible: formData.isFungible,
          isStandalone: formData.isStandalone,
          isActive: formData.isActive,
        });
        toast.success("Resource updated");
      } else {
        await createResource({
          id: `res_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          organizationId: DEMO_ORG_ID,
          name: formData.name,
          type: formData.type,
          description: formData.description || undefined,
          timezone: formData.timezone,
          quantity: formData.quantity,
          isFungible: formData.isFungible,
          isStandalone: formData.isStandalone,
          isActive: formData.isActive,
        });
        toast.success("Resource created");
      }
      setShowCreateModal(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to save resource");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this resource?")) return;
    try {
      await deleteResource({ id });
      toast.success("Resource deleted");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete resource");
    }
  };

  const handleToggleActive = (id: string, isActive: boolean) => {
    // Set pending toggle to trigger the query and show the dialog if needed
    setPendingToggle({ id, isActive });
  };

  const confirmToggleActive = async (id: string, isActive: boolean) => {
    try {
      await toggleActive({ id, isActive });
      toast.success(isActive ? "Resource activated" : "Resource deactivated");
      setPendingToggle(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to update resource");
      setPendingToggle(null);
    }
  };

  const getTypeLabel = (type: string) => {
    return RESOURCE_TYPES.find((t) => t.value === type)?.label ?? type;
  };

  // Query presence count for pending toggle
  const presenceCount = useQuery(
    api.booking.getActivePresenceCount,
    pendingToggle ? { resourceId: pendingToggle.id } : "skip"
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Resources</h1>
          <p className="text-muted-foreground">
            Manage bookable resources like rooms, equipment, or staff
          </p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="mr-2 h-4 w-4" />
          New Resource
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Resources</CardTitle>
          <CardDescription>
            Resources can be assigned to event types for booking
          </CardDescription>
        </CardHeader>
        <CardContent>
          {resources === undefined ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : resources.length === 0 ? (
            <div className="text-center py-12">
              <Users className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No resources</h3>
              <p className="text-muted-foreground">
                Create a resource to start accepting bookings
              </p>
              <Button className="mt-4" onClick={openCreateModal}>
                <Plus className="mr-2 h-4 w-4" />
                Create Resource
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resources.map((resource) => (
                  <TableRow key={resource._id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{resource.name}</p>
                        {resource.description && (
                          <p className="text-sm text-muted-foreground truncate max-w-xs">
                            {resource.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{getTypeLabel(resource.type)}</Badge>
                    </TableCell>
                    <TableCell>
                      {resource.isFungible ? (
                        <span>
                          {resource.quantity ?? 1}{" "}
                          <span className="text-muted-foreground">(pooled)</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">1 (unique)</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={resource.isActive}
                          onCheckedChange={(checked) =>
                            handleToggleActive(resource.id, checked)
                          }
                        />
                        <span className="text-sm">
                          {resource.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditModal(resource)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(resource.id)}
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingResource ? "Edit Resource" : "Create Resource"}
            </DialogTitle>
            <DialogDescription>
              Add a new bookable resource to your organization
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Studio A, Conference Room"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select
                value={formData.type}
                onValueChange={(v) =>
                  setFormData({ ...formData, type: v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RESOURCE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Optional description..."
                rows={2}
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
              <div>
                <Label htmlFor="isFungible">Pooled Resource</Label>
                <p className="text-sm text-muted-foreground">
                  Enable for resources with multiple identical units
                </p>
              </div>
              <Switch
                id="isFungible"
                checked={formData.isFungible}
                onCheckedChange={(v) =>
                  setFormData({ ...formData, isFungible: v })
                }
              />
            </div>
            {formData.isFungible && (
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min={1}
                  value={formData.quantity}
                  onChange={(e) =>
                    setFormData({ ...formData, quantity: Number(e.target.value) })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  How many units of this resource are available
                </p>
              </div>
            )}
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="isStandalone">Standalone Booking</Label>
                <p className="text-sm text-muted-foreground">
                  Can be booked directly. Disable for add-ons only (e.g., microphones, engineers)
                </p>
              </div>
              <Switch
                id="isStandalone"
                checked={formData.isStandalone}
                onCheckedChange={(v) =>
                  setFormData({ ...formData, isStandalone: v })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="isActive">Active</Label>
                <p className="text-sm text-muted-foreground">
                  Inactive resources cannot be booked
                </p>
              </div>
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(v) =>
                  setFormData({ ...formData, isActive: v })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              {editingResource ? "Save Changes" : "Create Resource"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Presence Warning Dialog */}
      {pendingToggle && presenceCount !== undefined && (
        <AlertDialog
          open={presenceCount.count > 0}
          onOpenChange={(open) => {
            if (!open) {
              setPendingToggle(null);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Users Currently Booking</AlertDialogTitle>
              <AlertDialogDescription>
                {presenceCount.count} user{presenceCount.count !== 1 ? "s are" : " is"} currently
                booking this resource. {pendingToggle.isActive ? "Activating" : "Deactivating"} it
                may interrupt their booking process.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setPendingToggle(null)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  pendingToggle &&
                  confirmToggleActive(pendingToggle.id, pendingToggle.isActive)
                }
              >
                {pendingToggle.isActive ? "Activate" : "Deactivate"} Anyway
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Auto-confirm if no presence */}
      {pendingToggle &&
        presenceCount !== undefined &&
        presenceCount.count === 0 &&
        (() => {
          confirmToggleActive(pendingToggle.id, pendingToggle.isActive);
          return null;
        })()}
    </div>
  );
}
