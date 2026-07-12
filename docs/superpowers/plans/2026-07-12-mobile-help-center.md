# In-App Help Center Plan (Phase 11)

## Goal

Provide an in-app help/reference system so that new users (especially those who
didn't build the app) can self-serve common questions without leaving to find
external docs.

## Approach

### Phase A — Static Help Screen (MVP)

1. Add a `(modal)/help.tsx` route rendered as a modal Stack screen
2. Content is a hardcoded list of FAQ items (most common questions):
   - How to receive/remove/adjust stock
   - How to create and assign orders
   - How to mark a delivery out-for-delivery/delivered
   - What the offline queue does
   - How to export CSV
   - How Face ID lock works
3. Access via a "?" icon in the tab bar or a "Help" row in Settings

### Phase B — Search + Contextual Help (if needed)

1. Add search over help content
2. Context-sensitive help: a "Help" button on each screen that opens the
   relevant FAQ section
3. Content in a structured JSON file for easy updating without app releases
   (could be fetched from API if needed)

## Route Structure

```
app/
  (modal)/
    help.tsx           ← help screen (presented as modal)
    help/
      items.tsx        ← items-specific help
      orders.tsx       ← orders-specific help
      index.tsx        ← FAQ overview
```

## Content Format

```typescript
type HelpArticle = {
  id: string;
  title: string;
  content: string;
  tags: string[];
  relatedIds?: string[];
};
```

## MVP Scope

- One FAQ screen with expandable sections
- Accessible via Settings → Help
- No search, no contextual help, no analytics
- Pure static content, shipped with each build
