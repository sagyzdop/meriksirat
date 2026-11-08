# ERD: equipment

Which tables describe the equipment catalog? Source: `src/db/schema.ts`. Rentals of it are in [bookings.md](bookings.md).

```mermaid
erDiagram
    category ||--o{ equipment : groups
    equipment ||--o{ booking_item : "rented as"
    category {
        int id PK
        text name UK
        int sortOrder
    }
    equipment {
        int id PK
        text modelName
        text shortName
        int categoryId FK
        text googleCalendarId UK
        int requiredClearanceLevel
        text imagePath "R2 key"
        bool isActive
    }
    booking_item {
        int id PK
        int equipmentId FK
    }
```

- Each piece of equipment has its own Google calendar (`gcal_id`).
- `imagePath` is a single R2 key such as `equipment-images/{id}.jpg`.
- `requiredClearanceLevel` is a catalog attribute used for filtering; booking code does not compare it with `user.clearanceLevel`.
