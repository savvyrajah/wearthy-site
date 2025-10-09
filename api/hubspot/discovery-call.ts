import type { VercelRequest, VercelResponse } from '@vercel/node';

const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
const HUBSPOT_API_URL = 'https://api.hubapi.com';

// Helper function to upload file to HubSpot Files API
async function uploadFileToHubSpot(fileData: string, fileName: string): Promise<string | null> {
  try {
    // Convert base64 to buffer
    const base64Data = fileData.split(',')[1];
    const buffer = Buffer.from(base64Data, 'base64');

    // Create form data for file upload
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36);
    const formDataParts = [];

    // Add file
    formDataParts.push(`--${boundary}\r\n`);
    formDataParts.push(`Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`);
    formDataParts.push(`Content-Type: image/jpeg\r\n\r\n`);
    formDataParts.push(buffer);
    formDataParts.push(`\r\n`);

    // Add options
    formDataParts.push(`--${boundary}\r\n`);
    formDataParts.push(`Content-Disposition: form-data; name="options"\r\n\r\n`);
    formDataParts.push(JSON.stringify({ access: 'PRIVATE' }));
    formDataParts.push(`\r\n`);

    // Add folderPath
    formDataParts.push(`--${boundary}\r\n`);
    formDataParts.push(`Content-Disposition: form-data; name="folderPath"\r\n\r\n`);
    formDataParts.push('/discovery-call-photos');
    formDataParts.push(`\r\n--${boundary}--\r\n`);

    const body = Buffer.concat(
      formDataParts.map(part =>
        typeof part === 'string' ? Buffer.from(part, 'utf-8') : part
      )
    );

    const uploadResponse = await fetch(`${HUBSPOT_API_URL}/files/v3/files`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('File upload error:', errorText);
      return null;
    }

    const result = await uploadResponse.json();
    return result.id;
  } catch (error) {
    console.error('Error uploading file to HubSpot:', error);
    return null;
  }
}

// Helper function to create a note with attachments
async function createNoteWithAttachments(contactId: string, fileIds: string[]): Promise<void> {
  try {
    const notePayload = {
      properties: {
        hs_note_body: 'Discovery call photos submitted via website form',
        hs_attachment_ids: fileIds.join(';')
      },
      associations: [
        {
          to: { id: contactId },
          types: [
            {
              associationCategory: 'HUBSPOT_DEFINED',
              associationTypeId: 202 // Note to Contact association
            }
          ]
        }
      ]
    };

    const noteResponse = await fetch(`${HUBSPOT_API_URL}/crm/v3/objects/notes`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(notePayload)
    });

    if (!noteResponse.ok) {
      const errorText = await noteResponse.text();
      console.error('Note creation error:', errorText);
    }
  } catch (error) {
    console.error('Error creating note:', error);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    // Check if API key is configured
    if (!HUBSPOT_API_KEY) {
      console.error('HUBSPOT_API_KEY is not configured');
      return res.status(500).json({
        success: false,
        message: 'Server configuration error. Please contact support.'
      });
    }

    // Debug: Log first/last few characters of API key (never log full key!)
    console.log('API Key check:', {
      hasKey: !!HUBSPOT_API_KEY,
      keyPrefix: HUBSPOT_API_KEY?.substring(0, 7),
      keySuffix: HUBSPOT_API_KEY?.substring(HUBSPOT_API_KEY.length - 4),
      keyLength: HUBSPOT_API_KEY?.length
    });

    const formData = req.body;

    // Extract and split name
    const fullName = formData.contactName || '';
    const nameParts = fullName.trim().split(' ');
    const firstname = nameParts[0] || '';
    const lastname = nameParts.slice(1).join(' ') || '';

    // Extract other fields
    const email = formData.email;
    const phone = formData.phone;
    const company = formData.serviceName;
    const jobtitle = formData.position;
    const serviceType = formData.serviceType;
    const studentCount = formData.studentCount;
    const budgetRange = formData.indicativeBudget;
    const ageGroup = formData.ageGroup;
    const additionalInfo = formData['additional-info'];

    // Handle multi-select planning stage
    const planningStage = Array.isArray(formData['phase[]'])
      ? formData['phase[]'].join(';')
      : formData['phase[]'] || '';

    // Prepare HubSpot contact payload - only basic fields first
    const contactPayload = {
      properties: {
        email,
        firstname,
        lastname,
        phone,
        company,
        jobtitle
      }
    };

    console.log('Creating contact with email:', email);
    console.log('Sending to URL:', `${HUBSPOT_API_URL}/crm/v3/objects/contacts`);
    console.log('Basic contact payload:', JSON.stringify(contactPayload, null, 2));
    console.log('Custom properties to be added after delay:', {
      serviceType,
      studentCount,
      budgetRange,
      ageGroup,
      planningStage,
      hasAdditionalInfo: !!additionalInfo
    });

    // Create or update contact in HubSpot
    const hubspotResponse = await fetch(`${HUBSPOT_API_URL}/crm/v3/objects/contacts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(contactPayload)
    });

    let contactId;

    console.log('HubSpot response status:', hubspotResponse.status);

    if (hubspotResponse.status === 409) {
      // Contact already exists, update instead
      const errorData = await hubspotResponse.json();
      const existingContactId = errorData.message.match(/Existing ID: (\d+)/)?.[1];

      if (existingContactId) {
        const updateResponse = await fetch(`${HUBSPOT_API_URL}/crm/v3/objects/contacts/${existingContactId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(contactPayload)
        });

        const updateData = await updateResponse.json();
        contactId = updateData.id;
        console.log('Existing contact updated with ID:', contactId);

        // Wait and update custom properties for existing contact too
        console.log('Waiting 2 seconds before updating custom properties...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        console.log('Updating existing contact with custom properties');
        const customPropsUpdate = await fetch(`${HUBSPOT_API_URL}/crm/v3/objects/contacts/${contactId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            properties: {
              wearthy_service_type: serviceType || '',
              wearthy_student_count: studentCount || '',
              wearthy_budget_range: budgetRange || '',
              wearthy_age_group: ageGroup || '',
              wearthy_planning_stage: planningStage || '',
              message: additionalInfo || '',
              wearthy_discovery_call_requested: 'true'
            }
          })
        });

        if (customPropsUpdate.ok) {
          console.log('Custom properties updated for existing contact');
        } else {
          const updateError = await customPropsUpdate.text();
          console.error('Failed to update custom properties for existing contact:', updateError);
        }
      }
    } else if (hubspotResponse.ok) {
      const data = await hubspotResponse.json();
      contactId = data.id;
      console.log('Contact created with ID:', contactId);

      // Wait 2 seconds for HubSpot to fully process the contact
      console.log('Waiting 2 seconds before updating custom properties...');
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Update contact with custom properties (HubSpot timing workaround)
      console.log('Updating contact with custom properties');
      const updateResponse = await fetch(`${HUBSPOT_API_URL}/crm/v3/objects/contacts/${contactId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          properties: {
            wearthy_service_type: serviceType || '',
            wearthy_student_count: studentCount || '',
            wearthy_budget_range: budgetRange || '',
            wearthy_age_group: ageGroup || '',
            wearthy_planning_stage: planningStage || '',
            message: additionalInfo || '',
            wearthy_discovery_call_requested: 'true'
          }
        })
      });

      if (updateResponse.ok) {
        console.log('Custom properties updated successfully');
      } else {
        const updateError = await updateResponse.text();
        console.error('Failed to update custom properties:', updateError);
      }
    } else {
      // Log the full error response for debugging
      const responseText = await hubspotResponse.text();
      console.error('HubSpot API Error Response:', {
        status: hubspotResponse.status,
        statusText: hubspotResponse.statusText,
        body: responseText.substring(0, 500) // First 500 chars
      });

      throw new Error(`Failed to create contact in HubSpot: ${hubspotResponse.status} ${hubspotResponse.statusText}`);
    }

    // Handle photo uploads if present
    const photos = formData.photos;
    console.log('Photo check:', {
      hasPhotos: !!photos,
      isArray: Array.isArray(photos),
      length: Array.isArray(photos) ? photos.length : 0,
      contactId
    });

    if (photos && Array.isArray(photos) && photos.length > 0 && contactId) {
      console.log(`Processing ${photos.length} photos for contact ${contactId}`);
      const fileIds: string[] = [];

      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        const fileName = `discovery-call-photo-${Date.now()}-${i}.jpg`;
        console.log(`Uploading photo ${i + 1}/${photos.length}: ${fileName}`);
        const fileId = await uploadFileToHubSpot(photo, fileName);

        if (fileId) {
          console.log(`Photo ${i + 1} uploaded successfully with ID: ${fileId}`);
          fileIds.push(fileId);
        } else {
          console.error(`Failed to upload photo ${i + 1}`);
        }
      }

      // Create a note with the uploaded photos attached to the contact
      if (fileIds.length > 0) {
        console.log(`Creating note with ${fileIds.length} attachments`);
        await createNoteWithAttachments(contactId, fileIds);
        console.log('Note created successfully');
      }
    } else {
      console.log('No photos to process');
    }

    return res.status(200).json({
      success: true,
      contactId,
      message: 'Thank you! Please select a time below to speak with Flora.'
    });

  } catch (error) {
    console.error('Error processing discovery call form:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred. Please try again or contact us directly.'
    });
  }
}
