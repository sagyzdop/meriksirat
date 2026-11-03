# Add New Equipment

> **Question:** What happens when an admin or manager adds a new piece of equipment, with or without a photo?
>
> **Answer:** The person opens Add Equipment (page /admin/equipment/new), fills in model name, category, Google Calendar ID and required clearance (1 or more), optionally short name, description and an image, and presses Create Equipment. The equipment is created as active, then the image is uploaded if one was chosen. A green message says the equipment was created, and after 1.5 seconds the page goes to the equipment list. If only the image upload fails, the equipment still exists and the page says so.
>
> **Notes:**
> - Every item needs its own Google Calendar ID, because bookings for that item are written to that calendar. A duplicate ID is refused.
> - The image is read in the browser, sent as base64 to the server and stored in R2 under equipment-images/{equipmentId}-{time in ms}.{jpeg, png or webp} (jpg if the browser reports image/jpg). Nothing expires. A later upload gets a new key and the old image is not deleted.
> - The browser checks the image type and the 5 MB limit as soon as the file is picked, and shows the error in the red message. The server checks both again, then checks the equipment exists.
> - The category choices come from the member catalog call, which returns nothing to an account whose own clearance level is under 2. Such an account sees an empty category list.
> - When the image fails, the red message is followed by the green created message, so both appear.
> - The form does not refresh any list. The list page loads its own data when opened.

```mermaid
sequenceDiagram
    autonumber
    actor Person as Admin or Manager
    participant Browser
    participant Worker
    participant D1
    participant R2

    Person->>Browser: open /admin/equipment/new
    Person->>Browser: pick an image
    alt wrong type
        Browser-->>Person: "Invalid file type. Only JPEG, PNG,<br/>and WebP images are allowed."
    else over 5 MB
        Browser-->>Person: "File size too large. Maximum size is 5MB."
    end
    Person->>Browser: fill the form, click Create Equipment
    alt a required field is empty
        Browser-->>Person: "Model name is required" or<br/>"Category is required" or<br/>"Google Calendar ID is required"
    else form valid
        Browser->>Worker: createEquipmentFn(form)
        alt calendar id already used
            Worker-->>Browser: error "Google Calendar ID already exists.<br/>Each equipment must have a unique calendar."
        else category missing
            Worker-->>Browser: error "Selected category does not exist"
        else ok
            Worker->>D1: insert equipment, is_active = true
            Worker-->>Browser: equipmentId
            opt an image was chosen
                Browser->>Worker: uploadEquipmentImageFn(equipmentId, base64, type)
                Worker->>R2: put equipment-images/id-time.ext
                Worker->>D1: set image_path
                alt upload fails
                    Browser-->>Person: "Equipment created successfully, but<br/>image upload failed. You can add an image<br/>later by editing the equipment."
                end
            end
            Browser-->>Person: green message, then redirect to /admin/equipment after 1.5 s
        end
    end
    alt create call failed
        Browser-->>Person: red message with the error
    end
```
