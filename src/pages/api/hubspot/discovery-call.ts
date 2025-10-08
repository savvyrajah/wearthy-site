import type { APIRoute } from 'astro';

const HUBSPOT_API_KEY = import.meta.env.HUBSPOT_API_KEY;
const HUBSPOT_API_URL = 'https://api.hubapi.com';

export const POST: APIRoute = async ({ request }) => {
  try {
    const formData = await request.formData();

    // Extract and split name
    const fullName = formData.get('contactName') as string;
    const nameParts = fullName?.trim().split(' ') || ['', ''];
    const firstname = nameParts[0] || '';
    const lastname = nameParts.slice(1).join(' ') || '';

    // Extract other fields
    const email = formData.get('email') as string;
    const phone = formData.get('phone') as string;
    const company = formData.get('serviceName') as string;
    const jobtitle = formData.get('position') as string;
    const serviceType = formData.get('serviceType') as string;
    const studentCount = formData.get('studentCount') as string;
    const budgetRange = formData.get('indicativeBudget') as string;
    const ageGroup = formData.get('ageGroup') as string;
    const additionalInfo = formData.get('additional-info') as string;

    // Handle multi-select planning stage
    const planningStage = formData.getAll('phase[]').join(';');

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
    const photos = formData.getAll('photos');
    if (photos && photos.length > 0 && contactId) {
      // TODO: Upload photos to HubSpot Files API
      // For now, we'll just log that photos were received
      console.log(`Received ${photos.length} photos for contact ${contactId}`);
    }

    return new Response(JSON.stringify({
      success: true,
      contactId,
      message: 'Thank you! Please select a time below to speak with Flora.'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('Error processing discovery call form:', error);
    return new Response(JSON.stringify({
      success: false,
      message: 'An error occurred. Please try again or contact us directly.'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
};
