// Generic failure classification and recovery.
//
// A failure is classified, the class says whether a plain retry could work,
// and the recovery designs an alternative task using another capability from
// the registry. The hero mission's Discord failure is one scripted instance of
// the same idea; dynamic missions draw from this catalogue.

export const FAILURE_CLASSES = {
  access_blocked: {
    label: 'Access blocked',
    transient: false,
    error: (site) => `${site} blocked the automated session (HTTP 403).`,
    diagnosis: 'The site rejects automated access. Retrying the same way will fail again.',
    plan: 'Switch to a source that offers an export or an API, and cross-check it against a second source.',
    altTitle: (title) => `${title} (alternative source)`,
  },
  source_unavailable: {
    label: 'Source unavailable',
    transient: true,
    error: (site) => `${site} returned 503 Service Unavailable.`,
    diagnosis: 'The source is down, not blocking us. Waiting could take hours.',
    plan: 'Use the next two sources instead and cross-check what they say.',
    altTitle: (title) => `${title} (backup sources)`,
  },
  page_changed: {
    label: 'Page changed',
    transient: false,
    error: (site) => `The expected form field was not found on ${site}.`,
    diagnosis: 'The page was redesigned, so the steps recorded for it no longer match.',
    plan: 'Re-locate each field by its visible label, then retry once.',
    altTitle: (title) => `${title} (re-mapped page)`,
  },
  rate_limited: {
    label: 'Rate limited',
    transient: true,
    error: () => 'The mail service rejected the batch: too many messages at once (429).',
    diagnosis: 'Sending too fast. The content is fine; the pace is not.',
    plan: 'Send in smaller batches with a pause between each.',
    altTitle: (title) => `${title} (in smaller batches)`,
  },
  validation_error: {
    label: 'Validation error',
    transient: false,
    error: () => 'The form rejected the submission: a required field was empty.',
    diagnosis: 'One required field was missing from the prepared data.',
    plan: 'Fill the missing field from the profile and resubmit.',
    altTitle: (title) => `${title} (corrected)`,
  },
};
