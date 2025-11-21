# Convex Booking Calendar - Cal.com Architecture Comparison Report

## Executive Summary
This report documents the architectural differences between Cal.com's booking interface and the current Convex booking calendar implementation. The findings will inform a planned CSS Grid refactor to match Cal.com's sophisticated layout system.

---

## 1. Layout System

### Cal.com Approach
**Technology:** CSS Grid + CSS Variables
```css
grid-template-areas: "meta main timeslots" "meta main timeslots";
grid-template-columns: var(--booker-meta-width) 1fr var(--booker-timeslots-width);
```

**Key Features:**
- Named grid areas for semantic layout (`meta`, `main`, `timeslots`)
- Responsive CSS variables:
  - Mobile meta width: 240px
  - Desktop meta width: 280px
  - Mobile/Desktop timeslots: 240px/280px
  - Main calendar: flexible (1fr)
- All widths centralized in inline style attributes
- Easy one-point updates to entire layout

### Current Implementation
**Technology:** Flexbox + Tailwind Classes
```tsx
<div className="flex flex-col lg:flex-row">
  <EventMetaPanel ... />     {/* lg:w-72 (288px) */}
  <CalendarGrid ... />       {/* flex-1 */}
  <TimeSlotsPanel ... />     {/* lg:w-72 (288px) */}
</div>
```

**Issues:**
- Classes scattered across 3+ component files
- No semantic grid areas
- Harder to visualize layout structure
- Changes require editing multiple files
- No mobile-specific width adjustments

---

## 2. Sizing & Widths

### Cal.com Structure
| Component | Mobile | Desktop | Notes |
|-----------|--------|---------|-------|
| Metadata | 240px | 280px | Responsive CSS var |
| Main Calendar | Flexible | Flexible | Uses 1fr (fill remaining) |
| Time Slots | 240px | 280px | Responsive CSS var |
| **Total Width** | 720px | 840px | Calculated by grid |
| **Min Height** | 450px | 450px | Set on container |

### Current Implementation
| Component | Mobile | Desktop | Notes |
|-----------|--------|---------|-------|
| Metadata | 100% | 288px | Hardcoded in component |
| Main Calendar | 100% | flex-1 | No specific width |
| Time Slots | 100% | 288px | Hardcoded in component |
| **Total Width** | 100% (full screen) | Flex | Depends on parent |
| **Min Height** | Auto | Auto | No constraint |

**Key Difference:** Cal.com specifies exact pixel widths; current implementation uses percentages and flex units inconsistently.

---

## 3. Responsive Behavior

### Cal.com Approach
- Single `lg:` breakpoint for responsive CSS variables
- Variables defined inline in style attribute:
  ```html
  lg:[--booker-timeslots-width:280px]
  lg:[--booker-meta-width:280px]
  ```
- Grid structure remains identical on all screen sizes (always 3-column grid)

### Current Implementation
- Uses Tailwind's `lg:` breakpoint for layout switch
- Mobile: vertical stack (`flex-col`)
- Desktop: horizontal layout (`lg:flex-row`)
- Components handle responsive behavior independently
- Each component makes its own responsive decisions

**Advantage of Cal.com:** Layout is predictable at all breakpoints because grid structure doesn't change.

---

## 4. Height Management

### Cal.com Approach
```html
style="
  min-height: 450px;
  height: auto;
  grid-template-rows: 1fr 0fr;
"
```

**Behavior:**
- Minimum height of 450px
- Grows with content (height: auto)
- Grid rows distribute space (1fr 0fr)
- Time slots container locked to `h-[400px]` with scrolling

### Current Implementation
- No explicit min-height on container
- Components grow naturally with content
- Time slots: `max-h-96` (384px) with scrolling
- No constrained total height by default

---

## 5. Component Structure

### Cal.com Grid Areas
```
┌─────────────────────────────────────────┐
│ [header] (fixed, top-right)             │
├──────────────┬────────────────┬─────────┤
│              │                │         │
│ [meta]       │ [main]         │[timeslots]│
│ (sticky top) │ (calendar)     │ (scroll)│
│              │                │         │
├──────────────┼────────────────┼─────────┤
│ [footer-area]│ [footer-area]  │[footer] │
└──────────────┴────────────────┴─────────┘
```

**Features:**
- Sticky meta panel (`position: sticky; top: 0px`)
- Fixed header positioned absolute
- Scrollable time slots
- Footer area can span multiple grid areas

### Current Implementation
```
Mobile (flex-col):
┌──────────────┐
│ EventMeta    │
├──────────────┤
│ Calendar     │
├──────────────┤
│ TimeSlots    │
└──────────────┘

Desktop (lg:flex-row):
┌──────────┬──────────┬──────────┐
│ EventMeta│ Calendar │TimeSlots │
└──────────┴──────────┴──────────┘
```

**Limitations:**
- No sticky positioning on meta panel
- No semantic grid areas
- Layout changes completely at breakpoint (not just sizing)

---

## 6. CSS Variable System

### Cal.com Variables (in HTML style attribute)
```html
[--booker-timeslots-width:240px]
lg:[--booker-timeslots-width:280px]
[--booker-meta-width:240px]
lg:[--booker-meta-width:280px]
[--booker-main-width:480px]
```

**Advantages:**
- All sizing in one place
- Easy to adjust for different event types
- Responsive without layout restructuring
- Variables can be changed dynamically via JavaScript

### Current Implementation
- No CSS variables
- Tailwind classes hardcoded in JSX
- Would require component changes to adjust widths

---

## 7. Positioning & Sticky Behavior

### Cal.com
```html
<div style="position: sticky; top: 0px;">
  <div class="[grid-area:meta]">
    <!-- Meta panel stays visible when scrolling -->
  </div>
</div>
```

**Behavior:** Meta panel stays fixed at top while user scrolls calendar/timeslots

### Current Implementation
- No sticky positioning
- Meta panel scrolls out of view
- Less ideal UX for mobile/small viewports

---

## 8. Borders & Separators

### Cal.com
- Responsive borders: `lg:border-l`, `lg:border-t`
- Changes based on layout direction
- Clear visual separation between grid areas

### Current Implementation
- Static borders: `border-neutral-800`
- Same borders at all breakpoints
- Borders defined independently in each component

---

## 9. Color & Theme

### Cal.com
- Color tokens in Tailwind config: `bg-default`, `text-emphasis`, `border-subtle`
- Automatically handles dark mode with `dark:` prefix
- Consistent semantic colors throughout

### Current Implementation
- Hardcoded colors: `bg-neutral-900`, `text-neutral-100`, `border-neutral-800`
- Limited theme flexibility
- Would require code changes for different themes

---

## 10. Time Slots Scrolling

### Cal.com
```html
<div class="md:h-[400px]">  <!-- Fixed height on desktop -->
  <div class="scroll-bar flex-grow overflow-auto">
    <!-- Slots scroll -->
  </div>
</div>
```

**Height:** 400px on desktop, responsive on mobile

### Current Implementation
```tsx
<div className="max-h-96 overflow-y-auto">  <!-- max-h-96 = 384px -->
  <!-- Slots scroll -->
</div>
```

**Difference:** Cal.com uses fixed `h-` classes, current uses `max-h-`

---

## Summary of Key Differences

| Aspect | Cal.com | Current | Priority |
|--------|---------|---------|----------|
| Layout System | CSS Grid | Flexbox | **HIGH** |
| Sizing Method | CSS Variables | Hardcoded Tailwind | **HIGH** |
| Responsive Logic | Centralized | Scattered | **HIGH** |
| Sticky Meta Panel | Yes (sticky) | No | **MEDIUM** |
| Min Height | 450px | Auto | **LOW** |
| Color System | Semantic tokens | Hardcoded | **MEDIUM** |
| Grid Areas | Named areas | None | **HIGH** |
| Breakpoint Changes | Width only | Layout + width | **MEDIUM** |

---

## Recommended Refactor Order

1. **Phase 1 (High Priority):**
   - Migrate to CSS Grid layout
   - Introduce CSS variables for widths
   - Define named grid areas

2. **Phase 2 (Medium Priority):**
   - Add sticky positioning to meta panel
   - Adjust responsive breakpoints to adjust widths only (not layout)
   - Migrate to semantic color tokens

3. **Phase 3 (Enhancement):**
   - Add dynamic width adjustment via CSS variables
   - Support theme variations without code changes
   - Consider fixing header positioning like Cal.com

---

## Implementation Notes

**Files to Update (for CSS Grid refactor):**
- `components/booking-calendar/calendar.tsx` - Main container (convert to grid)
- `components/booking-calendar/event-meta-panel.tsx` - Update grid area, add sticky
- `components/booking-calendar/calendar-grid.tsx` - Update grid area, adjust width
- `components/booking-calendar/time-slots-panel.tsx` - Update grid area, fixed height
- Consider: Create new CSS module with grid variables and layout

**Benefits of Refactoring:**
- Single source of truth for layout sizing
- Easier to adjust widths for different use cases
- Better semantic HTML/CSS structure
- Improved maintainability
- More responsive without code changes
- Can support different "booker sizes" via CSS variables
