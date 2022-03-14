import * as core from '@actions/core';
import * as github from '@actions/github';
import { WebClient, retryPolicies } from '@slack/web-api';
import { IncomingWebhook } from '@slack/webhook';

import { postMessage, addReaction, postMessageWithWebhook } from './slack';
import type {
  TInput,
  TIssueCommentWebhookEventPayload,
  TPullRequestReviewEditedWebhookEventPayload,
} from './types';
import { stringify, normalizeError } from './utils';

/**
 * Converts a json string to object of {<GitHub username>: <Slack member ID>}
 * @param {string} mapping - json string map of {<GitHub username>: <Slack member ID>}
 * @returns {Object} object of {<GitHub username>: <Slack member ID>}
 */
function formatUserMapping(mapping: string): Record<string, string> {
  try {
    const data = JSON.parse(mapping) as Record<string, string>;
    return Object.keys(data).reduce((r, k) => {
      const value = data[k];
      return value ? { ...r, [k]: value } : r;
    }, {});
  } catch {
    throw new Error('Input "user-mapping" must be a json string.');
  }
}

/**
 * Parses all inputs
 * @returns {Object} object of inputs
 */
function parseInput(): TInput {
  const githubToken = core.getInput('github-token', { required: false });
  const botToken = core.getInput('slack-bot-token', { required: false });
  const channelId = core.getInput('slack-channel-id', { required: false });
  const webhookUrl = core.getInput('slack-webhook-url', { required: false });
  const userMapping = formatUserMapping(
    core.getInput('user-mapping', { required: false }) || '{}'
  );

  return {
    githubToken,
    botToken,
    channelId,
    webhookUrl,
    userMapping,
  };
}

/**
 * Checks if event is valid or not
 * @returns {boolean}
 */
function isValidEvent(): boolean {
  const {
    context: {
      eventName,
      payload,
      payload: { action },
    },
  } = github;

  if (!action) return false;

  if (eventName === 'pull_request') {
    return ['opened', 'reopened', 'closed'].includes(action);
  }

  if (eventName === 'pull_request_review') {
    if (!['submitted', 'edited', 'dismissed'].includes(action)) return false;

    const { changes } = payload as TPullRequestReviewEditedWebhookEventPayload;

    // 'pull_request_review' event is edited with no body changes
    if (action === 'edited' && !changes?.body) return false;

    return true;
  }

  if (eventName === 'issue_comment') {
    if (!['created', 'edited'].includes(action)) return false;

    const { issue } = payload as TIssueCommentWebhookEventPayload;

    // comments on pull requests
    if (issue.pull_request) return true;
  }

  return false;
}

(async function run(): Promise<void> {
  core.debug(`GitHub context: ${stringify(github.context)}`);

  if (!isValidEvent()) {
    core.debug('Invalid Event.');
    core.info('Skipped Action.');
    return;
  }

  try {
    const input = parseInput();

    if (input.botToken.length === 0 && input.webhookUrl.length === 0) {
      throw new Error(
        'Need to provide at least one input "slack-bot-token" or "slack-webhook-url".'
      );
    }

    if (input.botToken.length > 0) {
      if (input.channelId.length === 0) {
        throw new Error(
          'Input "slack-channel-id" is required to run this action. An empty one has been provided.'
        );
      }

      const web = new WebClient(input.botToken, {
        retryConfig: retryPolicies.fiveRetriesInFiveMinutes,
      });
      const response = await postMessage({ web, input });

      if (
        response.ts &&
        response.metadata_scopes?.includes('reactions:write')
      ) {
        await addReaction({
          web,
          input,
          timestamp: response.ts,
        });
      }

      return;
    }

    if (input.webhookUrl.length > 0) {
      const webhook = new IncomingWebhook(input.webhookUrl);

      await postMessageWithWebhook({
        webhook,
        input,
      });
    }
  } catch (error) {
    core.setFailed(normalizeError(error));
  }
})();
