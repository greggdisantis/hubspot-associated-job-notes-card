const axios = require('axios');

const BASE_URL = 'https://api.hubapi.com';

// HubSpot packages project serverless function entrypoints independently, so keep
// API helper logic in this file instead of requiring a sibling helper module.

function getAccessToken() {
  const accessToken = process.env.PRIVATE_APP_ACCESS_TOKEN;

  if (!accessToken) {
    throw new Error('Missing PRIVATE_APP_ACCESS_TOKEN. Install the project app or configure the HubSpot private app token secret.');
  }

  return accessToken;
}

function createHubSpotClient() {
  return axios.create({
    baseURL: BASE_URL,
    headers: {
      Authorization: `Bearer ${getAccessToken()}`,
      'Content-Type': 'application/json'
    },
    timeout: 10000
  });
}

function buildResponse(statusCode, body) {
  return {
    statusCode,
    body
  };
}

function buildErrorResponse(error, fallbackMessage = 'Unable to complete the HubSpot request.') {
  const statusCode = error.response && error.response.status ? error.response.status : 500;
  const message = error.response && error.response.data && error.response.data.message
    ? error.response.data.message
    : error.message || fallbackMessage;

  console.error(fallbackMessage, {
    statusCode,
    message,
    hubspotResponse: error.response && error.response.data ? error.response.data : undefined
  });

  return buildResponse(statusCode, {
    success: false,
    error: message
  });
}

function getProperty(properties = {}, propertyName) {
  return properties[propertyName] || null;
}

const DEAL_PROPERTIES = ['dealname', 'pipeline', 'dealstage', 'createdate', 'closedate'];

exports.main = async (context = {}) => {
  const { contactId } = context.parameters || {};

  if (!contactId) {
    return buildResponse(400, {
      success: false,
      error: 'Missing required parameter: contactId.'
    });
  }

  try {
    const hubspot = createHubSpotClient();

    // DOS uses HubSpot's native Deal object as the portal's "Job" record.
    // This call intentionally uses object type CONTACT -> DEALS, not a custom Job object.
    const associationResponse = await hubspot.get(
      `/crm/v4/objects/contacts/${encodeURIComponent(contactId)}/associations/deals`,
      { params: { limit: 500 } }
    );

    const associatedDealIds = (associationResponse.data.results || [])
      .map((association) => association.toObjectId || association.to && association.to.id)
      .filter(Boolean)
      .map(String);

    if (associatedDealIds.length === 0) {
      return buildResponse(200, {
        success: true,
        jobs: []
      });
    }

    const dealResponse = await hubspot.post('/crm/v3/objects/deals/batch/read', {
      properties: DEAL_PROPERTIES,
      inputs: associatedDealIds.map((id) => ({ id }))
    });

    const jobs = (dealResponse.data.results || [])
      .map((deal) => ({
        id: deal.id,
        // Deal name is displayed as the DOS Job name in the card UI.
        dealname: getProperty(deal.properties, 'dealname') || `Job ${deal.id}`,
        pipeline: getProperty(deal.properties, 'pipeline'),
        dealstage: getProperty(deal.properties, 'dealstage'),
        createdate: getProperty(deal.properties, 'createdate'),
        closedate: getProperty(deal.properties, 'closedate')
      }))
      .sort((a, b) => (a.dealname || '').localeCompare(b.dealname || ''));

    return buildResponse(200, {
      success: true,
      jobs
    });
  } catch (error) {
    return buildErrorResponse(error, 'Unable to load associated Deals/Jobs for this Contact.');
  }
};
