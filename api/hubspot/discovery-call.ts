import type { VercelRequest, VercelResponse } from '@vercel/node';

const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
const HUBSPOT_API_URL = 'https://api.hubapi.com';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
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

    // Prepare HubSpot contact payload
    const contactPayload = {
      properties: {
        email,
        firstname,
        lastname,
        phone,
        company,
        jobtitle,
        wearthy_service_type: serviceType || '',
        wearthy_student_count: studentCount || '',
        wearthy_budget_range: budgetRange || '',
        wearthy_age_group: ageGroup || '',
        wearthy_planning_stage: planningStage || '',
        message: additionalInfo || '',
        wearthy_discovery_call_requested: 'true'
      }
    };

    // Create or update contact in HubSpot
    const hubspotResponse = await fetch(`${HUBSPOT_API_URL}/crm/v3/contacts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(contactPayload)
    });

    let contactId;

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
      }
    } else if (hubspotResponse.ok) {
      const data = await hubspotResponse.json();
      contactId = data.id;
    } else {
      const errorData = await hubspotResponse.json();
      console.error('HubSpot API Error:', errorData);
      throw new Error('Failed to create contact in HubSpot');
    }

    // Handle photo uploads if present
    const photos = formData.photos;
    if (photos && contactId) {
      // TODO: Upload photos to HubSpot Files API
      console.log(`Received photos for contact ${contactId}`);
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
