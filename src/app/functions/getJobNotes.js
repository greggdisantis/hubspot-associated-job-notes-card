const axios = require('axios');

const BASE_URL = 'https://api.hubapi.com';

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

const NOTE_PROPERTIES = ['hs_note_body', 'hs_timestamp', 'hubspot_owner_id', 'createdate', 'hs_created_by', 'hs_updated_by'];

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

async function getOwnerNames(hubspot, ownerIds) {
  if (ownerIds.length === 0) {
    return {};
  }

  const ownerEntries = await Promise.all(ownerIds.map(async (ownerId) => {
    try {
      const response = await hubspot.get(`/crm/v3/owners/${encodeURIComponent(ownerId)}`);
      const owner = response.data || {};
      const fullName = [owner.firstName, owner.lastName].filter(Boolean).join(' ');
      return [ownerId, fullName || owner.email || ownerId];
    } catch (error) {
      console.warn(`Unable to resolve HubSpot owner ${ownerId}.`, error.message);
      return [ownerId, ownerId];
    }
  }));

  return Object.fromEntries(ownerEntries);
}

exports.main = async (context = {}) => {
  const { dealId } = context.parameters || {};

  if (!dealId) {
    return buildResponse(400, {
      success: false,
      error: 'Missing required parameter: dealId.'
    });
  }

  try {
    const hubspot = createHubSpotClient();

    // DOS Jobs are native HubSpot Deals. This association lookup uses DEALS -> NOTES.
    const associationResponse = await hubspot.get(
      `/crm/v4/objects/deals/${encodeURIComponent(dealId)}/associations/notes`,
      { params: { limit: 500 } }
    );

    const associatedNoteIds = (associationResponse.data.results || [])
      .map((association) => association.toObjectId || association.to && association.to.id)
      .filter(Boolean)
      .map(String);

    if (associatedNoteIds.length === 0) {
      return buildResponse(200, {
        success: true,
        notes: []
      });
    }

    const notesResponse = await hubspot.post('/crm/v3/objects/notes/batch/read', {
      properties: NOTE_PROPERTIES,
      inputs: associatedNoteIds.map((id) => ({ id }))
    });

    const ownerIds = unique((notesResponse.data.results || []).map((note) => getProperty(note.properties, 'hubspot_owner_id')));
    const ownerNamesById = await getOwnerNames(hubspot, ownerIds);

    const notes = (notesResponse.data.results || [])
      .map((note) => {
        const ownerId = getProperty(note.properties, 'hubspot_owner_id');

        return {
          id: note.id,
          hs_note_body: getProperty(note.properties, 'hs_note_body') || '',
          hs_timestamp: getProperty(note.properties, 'hs_timestamp'),
          hubspot_owner_id: ownerId,
          ownerName: ownerId ? ownerNamesById[ownerId] || ownerId : null,
          createdate: getProperty(note.properties, 'createdate'),
          updatedate: note.updatedAt || null
        };
      })
      .sort((a, b) => {
        const aDate = new Date(a.hs_timestamp || a.createdate || 0).getTime();
        const bDate = new Date(b.hs_timestamp || b.createdate || 0).getTime();
        return bDate - aDate;
      });

    return buildResponse(200, {
      success: true,
      notes
    });
  } catch (error) {
    return buildErrorResponse(error, 'Unable to load notes for this Deal/Job.');
  }
};
