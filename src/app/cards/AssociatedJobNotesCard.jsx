import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  ButtonRow,
  Divider,
  EmptyState,
  Flex,
  Heading,
  LoadingSpinner,
  Select,
  Text,
  hubspot
} from '@hubspot/ui-extensions';

hubspot.extend(({ context, actions }) => (
  <AssociatedJobNotesCard
    context={context}
    addAlert={actions.addAlert}
    fetchCrmObjectProperties={actions.fetchCrmObjectProperties}
  />
));

const friendlyDate = (value) => {
  if (!value) {
    return 'Date unavailable';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
};

const stripHtml = (value = '') => value
  .replace(/<br\s*\/?\s*>/gi, '\n')
  .replace(/<\/p>/gi, '\n')
  .replace(/<[^>]*>/g, '')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .trim();

const getResponseBody = (response) => response && response.body ? response.body : response;

const getContactId = async (context, fetchCrmObjectProperties) => {
  if (context && context.crm && context.crm.objectId) {
    return String(context.crm.objectId);
  }

  if (fetchCrmObjectProperties) {
    const properties = await fetchCrmObjectProperties(['hs_object_id']);
    return properties && properties.hs_object_id ? String(properties.hs_object_id) : null;
  }

  return null;
};

const AssociatedJobNotesCard = ({ context, addAlert, fetchCrmObjectProperties }) => {
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [notes, setNotes] = useState([]);
  const [error, setError] = useState('');

  const portalId = context && context.portal ? context.portal.id : null;

  const selectedJob = useMemo(
    () => jobs.find((job) => String(job.id) === String(selectedJobId)),
    [jobs, selectedJobId]
  );

  const jobOptions = useMemo(
    () => jobs.map((job) => ({
      label: job.dealname || `Job ${job.id}`,
      value: String(job.id)
    })),
    [jobs]
  );

  const selectedJobUrl = useMemo(() => {
    if (!portalId || !selectedJobId) {
      return null;
    }

    // Deal ID is the DOS Job ID. HubSpot's native Deal object route opens the selected Job record.
    return `https://app.hubspot.com/contacts/${portalId}/deal/${selectedJobId}`;
  }, [portalId, selectedJobId]);

  const showError = useCallback((message) => {
    setError(message);

    if (addAlert) {
      addAlert({
        title: 'Associated Job Notes',
        message,
        type: 'danger'
      });
    }
  }, [addAlert]);

  const loadNotes = useCallback(async (dealId) => {
    if (!dealId) {
      setNotes([]);
      return;
    }

    setLoadingNotes(true);
    setError('');

    try {
      const response = await hubspot.serverless('getJobNotes', {
        parameters: { dealId }
      });
      const body = getResponseBody(response);

      if (!body || body.success === false) {
        throw new Error(body && body.error ? body.error : 'Unable to load notes for this job.');
      }

      setNotes(body.notes || []);
    } catch (loadNotesError) {
      setNotes([]);
      showError(loadNotesError.message || 'Unable to load notes for this job.');
    } finally {
      setLoadingNotes(false);
    }
  }, [showError]);

  const loadJobs = useCallback(async () => {
    setLoadingJobs(true);
    setError('');
    setNotes([]);

    try {
      const contactId = await getContactId(context, fetchCrmObjectProperties);

      if (!contactId) {
        throw new Error('Unable to determine the current Contact ID.');
      }

      const response = await hubspot.serverless('getAssociatedJobs', {
        parameters: { contactId }
      });
      const body = getResponseBody(response);

      if (!body || body.success === false) {
        throw new Error(body && body.error ? body.error : 'Unable to load associated jobs.');
      }

      const loadedJobs = body.jobs || [];
      setJobs(loadedJobs);

      if (loadedJobs.length === 1) {
        const onlyJobId = String(loadedJobs[0].id);
        setSelectedJobId(onlyJobId);
        await loadNotes(onlyJobId);
      } else if (loadedJobs.length > 1) {
        const nextSelectedJobId = String(loadedJobs[0].id);
        setSelectedJobId(nextSelectedJobId);
        await loadNotes(nextSelectedJobId);
      } else {
        setSelectedJobId('');
      }
    } catch (loadJobsError) {
      setJobs([]);
      setSelectedJobId('');
      showError(loadJobsError.message || 'Unable to load associated jobs.');
    } finally {
      setLoadingJobs(false);
    }
  }, [context, fetchCrmObjectProperties, loadNotes, showError]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const handleJobChange = async (value) => {
    setSelectedJobId(value);
    await loadNotes(value);
  };

  return (
    <Flex direction="column" gap="medium">
      <Flex direction="row" justify="between" align="center" gap="medium">
        <Heading>Associated Job Notes</Heading>
        <Button variant="secondary" onClick={loadJobs} disabled={loadingJobs || loadingNotes}>
          Refresh
        </Button>
      </Flex>

      <Text>
        View notes from Deals associated with this Contact. In the Distinctive Outdoor Structures portal, Jobs are native HubSpot Deals.
      </Text>

      {error ? <Text>{error}</Text> : null}

      {loadingJobs ? (
        <Flex direction="row" gap="small" align="center">
          <LoadingSpinner />
          <Text>Loading associated jobs...</Text>
        </Flex>
      ) : null}

      {!loadingJobs && jobs.length === 0 ? (
        <EmptyState title="No associated jobs found for this contact." />
      ) : null}

      {!loadingJobs && jobs.length > 1 ? (
        <Select
          label="Job"
          name="selectedJobId"
          options={jobOptions}
          value={selectedJobId}
          onChange={handleJobChange}
        />
      ) : null}

      {!loadingJobs && selectedJob ? (
        <Flex direction="column" gap="medium">
          <Divider />

          <Flex direction="column" gap="small">
            <Heading>{selectedJob.dealname || `Job ${selectedJob.id}`}</Heading>
            <Text>Job ID / Deal ID: {selectedJob.id}</Text>
            <ButtonRow>
              {selectedJobUrl ? (
                <Button
                  variant="secondary"
                  href={{
                    url: selectedJobUrl,
                    external: true
                  }}
                >
                  Open job record
                </Button>
              ) : null}
              <Button variant="secondary" onClick={() => loadNotes(selectedJob.id)} disabled={loadingNotes}>
                Refresh notes
              </Button>
            </ButtonRow>
          </Flex>

          {loadingNotes ? (
            <Flex direction="row" gap="small" align="center">
              <LoadingSpinner />
              <Text>Loading notes...</Text>
            </Flex>
          ) : null}

          {!loadingNotes && notes.length === 0 ? (
            <EmptyState title="No notes found for this job." />
          ) : null}

          {!loadingNotes && notes.length > 0 ? (
            <Flex direction="column" gap="medium">
              {notes.map((note) => (
                <Box key={note.id}>
                  <Flex direction="column" gap="small">
                    <Text>{friendlyDate(note.hs_timestamp || note.createdate)}</Text>
                    {note.ownerName ? <Text>Created by: {note.ownerName}</Text> : null}
                    <Text>{stripHtml(note.hs_note_body) || 'No note body available.'}</Text>
                  </Flex>
                </Box>
              ))}
            </Flex>
          ) : null}
        </Flex>
      ) : null}
    </Flex>
  );
};
