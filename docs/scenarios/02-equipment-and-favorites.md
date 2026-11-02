# Equipment catalog, admin equipment and favorites

This covers how members browse and inspect equipment, how admins and managers manage equipment and categories (including images), how equipment images are served, and how any signed-in user saves favorite photos. The landing page `/` loads nothing and only redirects to `/albums`.

## Data

R2 holds equipment images under the key `equipment-images/{equipmentId}-{timestamp ms}.{jpeg, png or webp}`. Nothing ever deletes or expires these objects.

```mermaid
erDiagram
    category ||--o{ equipment : groups
    equipment ||--o{ booking_item : "booked as"
    booking ||--o{ booking_item : contains
    user ||--o{ favorite : saves
    photo ||--o{ favorite : "saved as"
    album ||--o{ photo : holds

    category {
        integer id PK
        text name "unique"
        text description
        integer sort_order
    }
    equipment {
        integer id PK
        text model_name
        text short_name
        text description
        integer category_id FK
        text gcal_id "unique, one Google calendar per item"
        integer required_clearance_level "default 1"
        text image_path "R2 key"
        integer is_active "true or false"
        integer updated_at
    }
    booking {
        integer id PK
        text status "booked, active, returned, cancelled, overdue, partially_returned"
    }
    booking_item {
        integer id PK
        integer booking_id FK
        integer equipment_id FK
    }
    user {
        text id PK
        integer clearance_level
        integer is_member
        text role "user, manager, admin"
    }
    album {
        text id PK
        integer favorite_count
        integer photos_indexed_at
    }
    photo {
        text id PK
        text album_id FK
        text drive_file_id
        text state "live, moving, deleted, dropped"
    }
    favorite {
        text user_id PK
        text photo_id PK
        integer created_at
    }
```

## Browsing the catalog and checking availability

A member opens Equipment in the sidebar. Only users with clearance level 2 or higher see anything. Free/busy results come from each equipment's own Google Calendar, read with the master Google token (cached in the Worker for about 50 minutes).

```mermaid
sequenceDiagram
    autonumber
    actor Member
    participant Browser
    participant Worker
    participant D1
    participant Calendar

    Member->>Browser: Open /equipment
    Browser->>Worker: Route guard getUserFn (see 01 auth file)
    Note over Browser,Worker: Loader runs the next calls in parallel and only logs failures
    Browser->>Worker: getEquipmentFn(no filters)
    Worker->>Worker: resolveSession from request headers
    Worker->>D1: read user.clearance_level (defaults to 1)
    alt no session or clearance under 2
        Worker-->>Browser: null
        Browser->>Browser: treated as empty list
        Browser-->>Member: "No equipment available"
    else allowed
        Worker->>D1: equipment joined to category, active only, required_clearance_level at most user level, sorted by model_name
        Worker-->>Browser: list of equipment
    end
    Browser->>Worker: getCategoriesFn()
    Worker->>D1: read category sorted by sort_order then name (same session and clearance-2 check, else null)
    Browser->>Worker: getBookingSettingsFn() for operating hours (see booking files)
    opt opened with mode add-to-booking and a bookingId
        Browser->>Worker: getBookingItemEquipmentIdsFn(bookingId) (see booking files)
        Browser->>Worker: getBookingWindowFn(bookingId) (see booking files)
    end
    Browser-->>Member: Cards grouped by category in sort order, Uncategorized last
    Note over Browser: Equipment list is cached 60s, categories use the 30s default
    Browser->>Browser: Window is the date and time filter, default today plus the next 30 minute slot, or the booking window in add mode
    loop calendars in chunks of 40
        Browser->>Worker: checkMultipleCalendarsFreeBusy(calendarIds, timeMin, timeMax)
        Worker->>Worker: requireAuthenticatedUser (else error "Not authenticated")
        Worker->>Calendar: freeBusy for up to 15 calendars per request, master token
        alt Google returns an error
            Worker-->>Browser: error, the query retries once
            Browser-->>Member: Cards stay on "Checking…"
        else ok
            Worker-->>Browser: busy periods per calendar
        end
    end
    Browser-->>Member: Each card shows Available, Unavailable, Checking… or In booking
    Note over Browser: A card is also Unavailable when is_active is false
    Member->>Browser: Type in search or pick a category
    Browser->>Browser: Filter in the browser only, search matches model name, description or category name and overrides the category pick
    Member->>Browser: Toggle available only or change date and time
    Browser->>Browser: URL search params change, the list is not reloaded, availability is re-checked
    Member->>Browser: Tap Select on cards then View and Book Selected
    alt normal mode
        Browser->>Browser: Go to /bookings/new with equipmentIds (see the booking creation file)
    else add-to-booking mode
        Browser->>Worker: checkMultipleCalendarsFreeBusy again for the booking window
        alt any selected item is busy
            Browser-->>Member: Toast "NAME is not available during this booking's time window"
        else all free
            Browser->>Browser: Go back to returnTo with equipmentIds added to the URL
        end
    end
```

## Opening one piece of equipment

The member taps Details on a card. The page shows the photo, details, an availability badge and the equipment's calendar.

```mermaid
sequenceDiagram
    autonumber
    actor Member
    participant Browser
    participant Worker
    participant D1
    participant Calendar

    Member->>Browser: Open /equipment/ID
    alt id in the URL is not a number
        Browser-->>Member: "Equipment not found" and "Invalid equipment ID"
    else
        Browser->>Worker: getEquipmentByIdFn(equipmentId)
        Worker->>D1: read user.clearance_level
        Worker->>D1: read equipment with category, active only, required_clearance_level at most user level
        alt no session, clearance under 2, inactive, level too high, or no such id
            Worker-->>Browser: nothing
            Browser-->>Member: "Equipment not found" and "The equipment you're looking for doesn't exist or you don't have access to it."
        else found
            Worker-->>Browser: equipment
        end
    end
    Browser->>Worker: GET /api/images/imagePath (see the image scenario below)
    alt image missing or request fails
        Browser-->>Member: Placeholder icon instead of the photo
    end
    Browser->>Worker: checkCalendarFreeBusy(calendarId, timeMin, timeMax)
    Worker->>Calendar: freeBusy for one calendar, master token
    alt Google error
        Browser-->>Member: Badge shows Unavailable
    else ok
        Browser-->>Member: Badge shows Available or Unavailable
    end
    Browser->>Worker: getCalendarEvents(equipmentCalendarId, timeMin, timeMax, up to 250 events)
    Worker->>Worker: requireAuthenticatedUser
    Worker->>Calendar: list events, master token
    alt Google error
        Browser-->>Member: Toast "Failed to load calendar events"
    else ok
        Browser-->>Member: Month, week or day calendar showing the bookings
    end
    Note over Browser,Worker: Moving to another week or month calls getCalendarEvents again
```

## Serving equipment images

Every image on the catalog, detail page and admin table is requested by the browser as `/api/images/{imagePath}`. Images are private and the browser reuses them for one day.

```mermaid
sequenceDiagram
    autonumber
    actor Member
    participant Browser
    participant Worker
    participant R2

    Member->>Browser: A page shows an equipment image
    Browser->>Worker: GET /api/images/equipment-images/ID-TIMESTAMP.jpeg
    alt no path
        Worker-->>Browser: 400 "Image path is required"
    else no session
        Worker-->>Browser: 401 "Unauthorized"
    else
        Worker->>Worker: rateLimit rl_images per user, 300 requests per 60 seconds
        alt over the limit
            Worker-->>Browser: 429 "Too Many Requests"
        else allowed
            Worker->>R2: get object, passing the browser's If-None-Match
            alt R2 binding missing
                Worker-->>Browser: 500 "Storage not configured"
            else object not found
                Worker-->>Browser: 404 "Image not found"
                Browser-->>Member: Placeholder icon
            else ETag matches
                Worker-->>Browser: 304 with no body
            else
                Worker-->>Browser: 200 image, Cache-Control private max-age 86400, ETag
            end
        end
    end
    Note over Worker: Any unexpected error returns 500 "Internal server error". If the rate limiter itself fails the request is let through
```

## Admin: managing equipment

Admins and managers open Admin, Equipment. Every admin function first runs `checkAdminPermission` for the roles admin and manager. Any other role cannot open the admin pages (error "Page not found"), and a direct call fails with "Unauthorized: No session" or "Insufficient permissions". Creating equipment does not create a Google calendar: the admin pastes the ID of a calendar that already exists.

```mermaid
sequenceDiagram
    autonumber
    actor Admin
    participant Browser
    participant Worker
    participant D1
    participant R2

    Admin->>Browser: Open Admin, Equipment
    Browser->>Worker: getAdminEquipmentFn(filters, page, limit)
    Worker->>D1: count and list all equipment (any level, any active state), default 50 per page, at most 100
    Browser->>Worker: getCategoriesFn()
    Browser-->>Admin: Table with filters in the URL and "Managing N equipment items"

    Admin->>Browser: Tick rows then Edit Clearance
    Browser->>Browser: Dialog "Bulk Edit Clearance Level" with levels 1 to 10
    Admin->>Browser: Update All
    Browser->>Worker: bulkUpdateEquipmentClearanceFn(equipmentIds, requiredClearanceLevel)
    alt no ids
        Worker-->>Browser: error "No equipment IDs provided"
        Browser-->>Admin: Toast "Failed to update equipment"
    else ok
        Worker->>D1: set required_clearance_level on all chosen rows
        Browser-->>Admin: Toast "Updated clearance level for N equipment item(s)"
        Browser->>Browser: Clear selection and invalidate equipment admin-list queries
    end

    Admin->>Browser: Add Equipment
    Browser->>Worker: getCategoriesFn()
    Admin->>Browser: Choose an image and fill the form
    alt file is not JPEG, PNG or WebP
        Browser-->>Admin: "Invalid file type. Only JPEG, PNG, and WebP images are allowed."
    else file over 5 MB
        Browser-->>Admin: "File size too large. Maximum size is 5MB."
    end
    Admin->>Browser: Create Equipment
    alt form invalid
        Browser-->>Admin: "Model name is required", "Category is required", "Google Calendar ID is required" or clearance outside 1 to 10
    else form valid
        Browser->>Worker: createEquipmentAdminFn(modelName, shortName, description, categoryId, googleCalendarId, requiredClearanceLevel)
        Worker->>D1: look for equipment with the same gcal_id
        alt calendar already used
            Worker-->>Browser: error "Google Calendar ID already exists. Each equipment must have a unique calendar."
            Browser-->>Admin: Red alert with that message
        else calendar is new
            Worker->>D1: check the category exists
            alt category missing
                Worker-->>Browser: error "Selected category does not exist"
                Browser-->>Admin: Red alert with that message
            else category found
                Worker->>D1: insert equipment with is_active true, return id
                Worker-->>Browser: equipmentId
                opt an image was chosen
                    Browser->>Browser: Read the file as a base64 data URL
                    Browser->>Worker: uploadEquipmentImageFn(equipmentId, imageData, contentType, fileName)
                    Note over Worker: Same steps as the upload in the edit part below
                    alt upload fails
                        Browser-->>Admin: "Equipment created successfully, but image upload failed. You can add an image later by editing the equipment."
                    end
                end
                Browser-->>Admin: Green alert "Equipment "NAME" created successfully!" plus " Image uploaded." if it worked
                Browser->>Browser: After 1.5 seconds go to /admin/equipment
            end
        end
    end

    Admin->>Browser: Click a table row
    Browser->>Worker: getAdminEquipmentByIdFn(equipmentId)
    Worker->>D1: read equipment with category, any level or state
    Browser->>Worker: getCategoriesFn()
    alt equipment not found or load fails
        Browser-->>Admin: Error "Failed to load equipment data"
    end
    Admin->>Browser: Change fields, active switch, optional new image, then Save Changes
    Browser->>Worker: updateEquipmentAdminFn(equipmentId and changed fields including isActive)
    Worker->>D1: read equipment
    alt not found
        Worker-->>Browser: error "Equipment not found"
    else new gcal_id used by another item
        Worker-->>Browser: error "Google Calendar ID already exists. Each equipment must have a unique calendar."
    else category missing
        Worker-->>Browser: error "Selected category does not exist"
    else valid
        Worker->>D1: update only the provided fields
        Worker-->>Browser: success
    end
    opt save succeeded and a new image was chosen
        Browser->>Worker: uploadEquipmentImageFn(equipmentId, imageData, contentType, fileName)
        alt content type not image/jpeg, image/jpg, image/png or image/webp
            Worker-->>Browser: error "Invalid file type. Only JPEG, PNG, and WebP images are allowed."
        else decoded size over 5 MB
            Worker-->>Browser: error "File size too large. Maximum size is 5MB."
        else equipment missing
            Worker-->>Browser: error "Equipment not found"
        else valid
            Worker->>R2: put equipment-images/ID-TIMESTAMP.ext with its content type
            alt R2 fails
                Worker-->>Browser: error "Failed to upload image: REASON"
            else stored
                Worker->>D1: set equipment.image_path to the new key and updated_at
                Worker-->>Browser: imagePath and "Image uploaded successfully"
            end
        end
    end
    alt save failed
        Browser-->>Admin: Red alert with the error message
    else saved and image uploaded
        Browser-->>Admin: Green alert "Equipment "NAME" updated successfully with new image!"
    else saved but image failed
        Browser-->>Admin: Green alert "Equipment "NAME" updated successfully, but image upload failed. You can try uploading the image again."
    else saved with no image chosen
        Browser-->>Admin: Green alert "Equipment "NAME" updated successfully!"
    end
    Browser->>Browser: After 1.5 seconds go to /admin/equipment

    Admin->>Browser: Delete Equipment
    Browser->>Browser: Confirm dialog "Are you sure you want to delete NAME?"
    Admin->>Browser: Confirm
    Browser->>Worker: deleteEquipmentAdminFn(equipmentId)
    Worker->>D1: read equipment
    alt not found
        Worker-->>Browser: error "Equipment not found"
        Browser-->>Admin: Red alert with that message
    else found
        Worker->>D1: count booking_item rows whose booking is booked, active, overdue or partially_returned
        alt one or more
            Worker->>D1: set is_active false and updated_at
            Worker-->>Browser: action deactivated
            Browser-->>Admin: "Equipment "NAME" has been marked as inactive due to active bookings. It will no longer be available for new bookings."
            Browser->>Browser: After 2 seconds go to /admin/equipment
        else none
            Worker->>D1: delete the equipment row
            Worker-->>Browser: action deleted
            Browser-->>Admin: "Equipment "NAME" has been permanently deleted."
            Browser->>Browser: After 1.5 seconds go to /admin/equipment
        end
    end
    Note over Worker,R2: Deleting or replacing never removes old images from R2 and never touches the Google calendar
```

## Admin: managing categories

Admins and managers open Admin, Categories. Rows can be reordered by drag and drop. After every change the page data is refreshed with a router invalidate.

```mermaid
sequenceDiagram
    autonumber
    actor Admin
    participant Browser
    participant Worker
    participant D1

    Admin->>Browser: Open Admin, Categories
    Browser->>Worker: getCategoriesWithCountFn()
    Worker->>Worker: checkAdminPermission admin or manager
    Worker->>D1: categories left joined to equipment with a count, sorted by sort_order then name
    alt load fails
        Browser-->>Admin: Empty list "No categories found"
    else loaded
        Browser-->>Admin: "Managing N categories"
    end

    Admin->>Browser: Add Category, fill name, description, sort order, submit
    Browser->>Worker: createCategoryFn(name, description, sortOrder)
    Worker->>D1: look for the same name
    alt name exists
        Worker-->>Browser: error "Category name already exists"
        Browser-->>Admin: Field error "A category with this name already exists"
    else new name
        Worker->>D1: insert category
        Browser-->>Admin: Toast "Category created successfully"
        Browser->>Browser: Close dialog and router invalidate
    end

    Admin->>Browser: Row menu, Edit, submit
    Browser->>Worker: updateCategoryFn(categoryId, name, description, sortOrder)
    Worker->>D1: read category
    alt not found
        Worker-->>Browser: error "Category not found"
        Browser-->>Admin: Toast "Category not found" and the dialog closes
    else another category has the name
        Worker-->>Browser: error "Category name already exists"
        Browser-->>Admin: Field error "A category with this name already exists"
    else valid
        Worker->>D1: update name, description, sort_order
        Browser-->>Admin: Toast "Category updated successfully"
        Browser->>Browser: Close dialog and router invalidate
    end

    Admin->>Browser: Row menu, Delete, confirm
    Browser->>Worker: deleteCategoryFn(categoryId)
    Worker->>D1: read category
    alt not found
        Worker-->>Browser: error "Category not found"
        Browser-->>Admin: Toast "Category not found" and the dialog closes
    else found
        Worker->>D1: find the category named Uncategorized
        opt it does not exist
            Worker->>D1: insert Uncategorized with sort_order 999
        end
        Worker->>D1: move all its equipment to Uncategorized
        Worker->>D1: delete the category
        alt category had equipment
            Browser-->>Admin: Toast "Category "NAME" deleted and N equipment items moved to "Uncategorized""
        else category was empty
            Browser-->>Admin: Toast "Category "NAME" deleted successfully"
        end
        Browser->>Browser: Close dialog and router invalidate
    end

    Admin->>Browser: Drag a row to a new place
    Browser->>Browser: Show the new order at once
    Browser->>Worker: updateCategorySortOrderFn(categoryUpdates with sortOrder 0, 1, 2 and so on)
    loop each category in the list
        Worker->>D1: set sort_order
    end
    alt fails
        Browser-->>Admin: Toast "Failed to update category order" and the order snaps back
    else saved
        Browser-->>Admin: Toast "Category order updated successfully"
        Browser->>Browser: Router invalidate
    end
```

## Favoriting photos and the favorites page

Any signed-in user, member or not, can heart photos in an album and see them under Favorites. Albums themselves are covered in other files.

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Browser
    participant Worker
    participant D1
    participant Drive

    User->>Browser: Open an album page
    Browser->>Worker: getAlbumFavoritesFn(albumId)
    alt not signed in
        Worker-->>Browser: empty list
    else signed in
        Worker->>D1: this user's favorites joined to live photos of the album
        Worker-->>Browser: photoId and driveFileId list
    end
    Note over Browser: Cached 30 seconds
    User->>Browser: Tap the heart on a photo
    Browser->>Browser: Show the change at once
    Browser->>Worker: setFavoriteFn(albumId, photoId, driveFileId, favorite)
    alt not signed in or user not found
        Worker-->>Browser: error "Sign in to favorite photos"
    else access rule canFavorite is false
        Worker-->>Browser: error "You cannot favorite photos"
    else album missing
        Worker-->>Browser: error "Album not found"
    else checks passed
        Worker->>D1: find live photo by id or by drive_file_id in that album
        opt photo unknown, no photoId, album never indexed, and adding a favorite
            Worker->>Drive: read file info, master token, must be in the album folder and not trashed
            alt file not in the folder
                Worker-->>Browser: error "Uploaded file not found in the album folder"
            else image file
                Worker->>D1: register the photo row
            end
            Worker->>D1: look the photo up again
        end
        alt photo still not found
            Worker-->>Browser: error "Photo not found in this album"
        else favoriting
            Worker->>D1: batch: album.favorite_count plus 1 only if not already saved, insert favorite ignoring duplicates
            Worker-->>Browser: photoId and favorite true
        else unfavoriting
            Worker->>D1: batch: album.favorite_count minus 1 (never below 0) only if saved, delete favorite
            Worker-->>Browser: photoId and favorite false
        end
    end
    alt any error
        Browser->>Browser: Undo the instant change
        Browser-->>User: Toast with the error message, or "Could not update favorite"
    end
    Browser->>Browser: Invalidate all favorites queries either way

    User->>Browser: Open Favorites in the sidebar
    Browser->>Worker: listMyFavoritesFn()
    Worker->>Worker: same sign-in and canFavorite checks and errors as above
    Worker->>D1: user's favorites joined to live photos and albums, newest first, at most 1000
    alt loader fails
        Browser->>Browser: Error is only logged and the page loads its own data
    end
    alt no favorites
        Browser-->>User: "No favorites yet" and "Tap the heart on a photo in any album to save it here."
    else some
        Browser-->>User: "My favorites" photo grid
    end
    User->>Browser: Tap the heart on a favorite
    Browser->>Worker: setFavoriteFn(albumId, photoId, driveFileId, favorite false)
    alt error
        Browser-->>User: Toast with the error message, or "Could not update favorite"
    else removed
        Browser->>Browser: Invalidate all favorites queries, the photo leaves the grid
    end
```
