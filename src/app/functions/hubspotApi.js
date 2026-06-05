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

module.exports = {
  createHubSpotClient,
  buildResponse,
  buildErrorResponse,
  getProperty
};
