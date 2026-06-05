const {
  createHubSpotClient,
  buildResponse,
  buildErrorResponse,
  getProperty
} = require('./hubspotApi');

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
