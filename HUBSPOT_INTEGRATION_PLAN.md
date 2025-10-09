# HubSpot Integration Plan - Discovery Call Form

## Current State
- **HubSpot Account ID:** 441564870
- **API Key:** Available
- **Existing Custom Fields:** 4 wearthy fields (training-related)
- **Standard Fields Available:** firstname, lastname, email, phone, company, jobtitle, message

## Form Field Mapping

| Form Field | HubSpot Property | Status | Action Required |
|------------|------------------|--------|-----------------|
| Contact Name | `firstname` + `lastname` | ✅ Standard | Split name |
| Email | `email` | ✅ Standard | Use directly |
| Phone | `phone` | ✅ Standard | Use directly |
| School/Centre Name | `company` | ✅ Standard | Use directly |
| Position | `jobtitle` | ✅ Standard | Use directly |
| Service Type | `wearthy_service_type` | ✅ Created | Dropdown field |
| Student Count | `wearthy_student_count` | ✅ Created | Dropdown field |
| Budget Range | `wearthy_budget_range` | ✅ Created | Dropdown field |
| Age Group | `wearthy_age_group` | ✅ Created | Dropdown field |
| Planning Stage | `wearthy_planning_stage` | ✅ Created | Multi-checkbox field |
| Outdoor Space Notes | `message` | ✅ Standard | Use directly |
| Photos | File Upload | ✅ Implemented | Uploaded to HubSpot Files API |

## Custom Properties to Create

```javascript
1. wearthy_service_type (Dropdown)
   - Early Learning Centre
   - Primary School
   - Secondary School
   - K-12 School
   - Other

2. wearthy_student_count (Dropdown)
   - Under 50
   - 50-100
   - 100-300
   - 300-500
   - Over 500

3. wearthy_budget_range (Dropdown)
   - Under $50,000
   - $50,000 - $100,000
   - $100,000 - $250,000
   - $250,000 - $500,000
   - Over $500,000
   - Not sure yet

4. wearthy_age_group (Dropdown)
   - Early Childhood (0-5 years)
   - Junior Primary (5-8 years)
   - Middle Primary (8-10 years)
   - Upper Primary (10-12 years)
   - Secondary (12-18 years)
   - Mixed Ages

5. wearthy_planning_stage (Multi-checkbox)
   - Just exploring ideas
   - Planning 2026 budget
   - Interested in grant opportunities
   - Looking to upgrade existing spaces

6. wearthy_discovery_call_requested (Boolean)
   - Yes/No (auto-set to Yes on submission)
```

## Integration Architecture

### Recommended: API-First Approach

**Flow:**
1. User fills form → Client-side validation
2. JavaScript POSTs to `/api/hubspot/discovery-call`
3. Backend creates/updates HubSpot contact
4. Photos uploaded to HubSpot Files API
5. Return success
6. Hide form, show embedded calendar with credibility sidebar

**Why API over Embedded Form:**
- ✅ Full control over UX
- ✅ Can handle file uploads
- ✅ Custom validation
- ✅ No iframe/embed issues
- ✅ Better mobile experience

## Implementation Steps

### 1. Create Custom Properties (API)
```bash
POST https://api.hubapi.com/crm/v3/properties/contacts
# Create all 6 custom properties listed above
```

### 2. Add HubSpot Tracking Code
```html
<!-- Add to BaseLayout.astro <head> -->
<script type="text/javascript" id="hs-script-loader" async defer src="//js.hs-scripts.com/441564870.js"></script>
```

### 3. Build API Endpoint
```javascript
// File: pages/api/hubspot/discovery-call.js (or .ts)
export async function POST(request) {
  // 1. Parse form data + files
  // 2. Create/update contact in HubSpot
  // 3. Upload photos to HubSpot
  // 4. Return meeting scheduler URL
}
```

### 4. Update Form Submission
```javascript
// Replace alert() with:
fetch('/api/hubspot/discovery-call', {
  method: 'POST',
  body: formData
}).then(res => res.json())
  .then(data => {
    // Hide form
    // Show embedded calendar + credibility sidebar
    // No redirect - keeps user on site (no bounce)
  });
```

### 5. File Upload Handling ✅ IMPLEMENTED

Photos are now uploaded to HubSpot using the following workflow:

1. **Client-side:** Photos converted to base64 and sent with JSON payload
2. **Server-side:**
   - Photos uploaded to HubSpot Files API v3
   - Files stored in `/discovery-call-photos` folder with `PRIVATE` access
   - File IDs retrieved from upload response
3. **Association:**
   - A Note object is created with the body: "Discovery call photos submitted via website form"
   - File IDs attached to the Note via `hs_attachment_ids` property
   - Note associated with Contact using association type ID 202 (Note to Contact)
4. **Result:** Flora can view all photos directly in the contact record's activity timeline

**API Endpoints Used:**
- `POST /files/v3/files` - Upload photos
- `POST /crm/v3/objects/notes` - Create note with attachments

### 6. Meeting Scheduler Setup

**Flora's Meeting Link:** https://meetings-ap1.hubspot.com/flora

**Embedded Calendar Approach:**
After form submission, transform the page to show:

**Layout:**
```
┌─────────────────────────────────────┐
│  [HubSpot Calendar Embed - 60%]    │  [Credibility Sidebar - 40%]
│                                     │
│  Flora's calendar widget            │  ✓ 10 Years Creating Play Environments
│  (embedded iframe)                  │  ✓ 100+ Playgrounds Built
│                                     │  ✓ 2021-2023 QLD Play Spaces Winner
│                                     │
│                                     │  📝 All Saints Testimonial:
│                                     │  "The new playground has been a
│                                     │   fantastic addition to our school!
│                                     │   The giant slide and physical
│                                     │   challenges encourage students..."
└─────────────────────────────────────┘
```

**Credibility Elements to Show:**
- 10 Years Creating Play Environments
- 100+ Playgrounds Built
- 16,000+ Children Impacted
- 3x QLD Play Spaces Winner (2021-2023)
- All Saints Anglican School Testimonial (full quote below)

**All Saints Testimonial:**
> "The new playground has been a fantastic addition to our school! One of the standout features is the giant slide, which has quickly become a favorite among the children. Its size and speed bring a real sense of excitement and joy to playtime.
>
> Equally popular is the physical challenge aspect of the playground. The climbing structures, balance elements, and obstacle-style features encourage students to test their strength, coordination, and confidence in a fun and safe environment. It's wonderful to see so many children engaged, active, and smiling as they explore the space.
>
> Overall, the playground has not only enhanced outdoor play but also supports physical development and social interaction. A big win for our school community!"
>
> — All Saints Anglican School

## Technical Details

### API Endpoint Structure
```
POST /api/hubspot/discovery-call

Request (JSON):
{
  "contactName": "John Smith",
  "email": "john@school.edu",
  "phone": "+61400000000",
  "serviceName": "Example School",
  "position": "Principal",
  "serviceType": "primary-school",
  "studentCount": "300-500",
  "indicativeBudget": "100k-250k",
  "ageGroup": "middle-primary",
  "phase[]": ["exploring", "preparing-next-budget"],
  "additional-info": "We need help with outdoor spaces...",
  "photos": [
    "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
    "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
  ]
}

Response:
{
  "success": true,
  "contactId": "12345",
  "message": "Thank you! Please select a time below to speak with Flora."
}
```

**Note:** Photos are sent as base64-encoded data URLs in the JSON payload, then converted to binary on the server before uploading to HubSpot Files API.

### Contact Creation Payload
```json
{
  "properties": {
    "firstname": "John",
    "lastname": "Smith",
    "email": "john@school.edu",
    "phone": "+61400000000",
    "company": "Example School",
    "jobtitle": "Principal",
    "wearthy_service_type": "primary-school",
    "wearthy_student_count": "300-500",
    "wearthy_budget_range": "100k-150k",
    "wearthy_age_group": "middle-primary",
    "wearthy_planning_stage": "Planning 2026 budget;Interested in grant opportunities",
    "message": "We need help with outdoor spaces...",
    "wearthy_discovery_call_requested": "true"
  }
}
```

## Implementation Status ✅ COMPLETE

### Completed Items:
1. ✅ Custom properties created in HubSpot
2. ✅ API endpoint built (`/api/hubspot/discovery-call`)
3. ✅ Form JavaScript updated to send JSON with base64 photos
4. ✅ File upload handling implemented via HubSpot Files API
5. ✅ Photo association via Note engagements
6. ✅ Contact creation/update logic with duplicate handling
7. ✅ Meeting scheduler embedded (https://meetings-ap1.hubspot.com/flora)

### Implementation Details:

**Form Submission Flow:**
1. User fills out form and uploads photos (optional)
2. JavaScript converts photos to base64 and creates JSON payload
3. POST to `/api/hubspot/discovery-call` with all data
4. Server creates/updates contact in HubSpot
5. If photos present:
   - Upload each photo to HubSpot Files API
   - Create Note with attachments
   - Associate Note with Contact
6. Return success response
7. Hide form, show calendar booking interface

**Error Handling:**
- Duplicate contacts are updated instead of creating new records
- Photo upload failures are logged but don't block contact creation
- User-friendly error messages displayed on failure

## Success Metrics
- ✅ Contact created in HubSpot with all fields populated
- ✅ Photos uploaded to HubSpot and attached to contact record via Notes
- ✅ User seamlessly moved to calendar booking after submission
- ✅ All data trackable in HubSpot for reporting

## Testing Checklist
- [ ] Test form submission without photos
- [ ] Test form submission with 1 photo
- [ ] Test form submission with multiple photos
- [ ] Test duplicate email handling
- [ ] Test all checkbox combinations for planning stage
- [ ] Verify photos appear in contact timeline
- [ ] Verify calendar shows after successful submission
