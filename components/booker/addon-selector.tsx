"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";

// Demo organization ID - in production, this would come from URL or auth
const DEMO_ORG_ID = "demo-org";

export interface SelectedAddon {
  resourceId: string;
  name: string;
  quantity: number;
  maxQuantity: number;
}

interface AddonSelectorProps {
  /** Currently selected add-ons */
  selectedAddons: SelectedAddon[];
  /** Callback when add-ons change */
  onAddonsChange: (addons: SelectedAddon[]) => void;
  /** Optional: Hide if no add-ons available (default: true) */
  hideIfEmpty?: boolean;
}

export function AddonSelector({
  selectedAddons,
  onAddonsChange,
  hideIfEmpty = true,
}: AddonSelectorProps) {
  // Query all active resources
  const resources = useQuery(api.booking.listResources, {
    organizationId: DEMO_ORG_ID,
    activeOnly: true,
  });

  // Filter to non-standalone resources (add-ons only)
  const addons = resources?.filter((r) => r.isStandalone === false);

  // Loading state
  if (resources === undefined) {
    return (
      <Card className="bg-card/50 border-border">
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Hide if no add-ons and hideIfEmpty is true
  if (hideIfEmpty && (!addons || addons.length === 0)) {
    return null;
  }

  // Toggle addon selection
  const toggleAddon = (resourceId: string, name: string, maxQuantity: number) => {
    const existing = selectedAddons.find((a) => a.resourceId === resourceId);

    if (existing) {
      // Remove addon
      onAddonsChange(selectedAddons.filter((a) => a.resourceId !== resourceId));
    } else {
      // Add addon with quantity 1
      onAddonsChange([
        ...selectedAddons,
        { resourceId, name, quantity: 1, maxQuantity },
      ]);
    }
  };

  // Update addon quantity
  const updateQuantity = (resourceId: string, delta: number) => {
    onAddonsChange(
      selectedAddons.map((addon) => {
        if (addon.resourceId === resourceId) {
          const newQuantity = Math.max(1, Math.min(addon.maxQuantity, addon.quantity + delta));
          return { ...addon, quantity: newQuantity };
        }
        return addon;
      })
    );
  };

  // Check if addon is selected
  const isSelected = (resourceId: string) =>
    selectedAddons.some((a) => a.resourceId === resourceId);

  // Get selected addon
  const getSelectedAddon = (resourceId: string) =>
    selectedAddons.find((a) => a.resourceId === resourceId);

  return (
    <Card className="bg-card/50 border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Package className="h-5 w-5" />
          Add-ons
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Optional extras you can add to your booking
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!addons || addons.length === 0 ? (
          <p className="text-muted-foreground text-sm">No add-ons available</p>
        ) : (
          <div className="space-y-4">
            {addons.map((addon) => {
              const selected = isSelected(addon.id);
              const selectedAddon = getSelectedAddon(addon.id);
              const maxQuantity = addon.quantity ?? 1;
              const isFungible = addon.isFungible ?? false;

              return (
                <div
                  key={addon._id}
                  className={`
                    p-4 rounded-lg border transition-all cursor-pointer
                    ${selected
                      ? "border-primary/50 bg-primary/5"
                      : "border-border hover:border-border bg-card/30"
                    }
                  `}
                  onClick={() => toggleAddon(addon.id, addon.name, maxQuantity)}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selected}
                      className="mt-1"
                      onClick={(e) => e.stopPropagation()}
                      onCheckedChange={() =>
                        toggleAddon(addon.id, addon.name, maxQuantity)
                      }
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-foreground font-medium cursor-pointer">
                            {addon.name}
                          </Label>
                          {addon.description && (
                            <p className="text-muted-foreground text-sm mt-0.5">
                              {addon.description}
                            </p>
                          )}
                        </div>
                        <Badge variant="outline" className="text-muted-foreground border-border">
                          {addon.type}
                        </Badge>
                      </div>

                      {/* Quantity selector (only for fungible resources with quantity > 1) */}
                      {selected && isFungible && maxQuantity > 1 && (
                        <div
                          className="flex items-center gap-3 mt-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="text-sm text-muted-foreground">Quantity:</span>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => updateQuantity(addon.id, -1)}
                              disabled={selectedAddon?.quantity === 1}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="text-foreground font-medium w-8 text-center">
                              {selectedAddon?.quantity || 1}
                            </span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => updateQuantity(addon.id, 1)}
                              disabled={selectedAddon?.quantity === maxQuantity}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            (max {maxQuantity})
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default AddonSelector;
