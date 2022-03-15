import * as core from '@actions/core';
import * as github from '@actions/github';
import type { WebClient, KnownBlock, MessageAttachment } from '@slack/web-api';
import type { IncomingWebhook } from '@slack/webhook';

import type {
  TInput,
  TUser,
  TRequestedReviewers,
  TRepository,
  TPullRequestWebhookEventPayload,
  TPullRequestReviewWebhookEventPayload,
  TIssueCommentWebhookEventPayload,
  TPullRequestReviewSubmittedWebhookEventPayload,
} from './types';
import { stringify } from './utils';

const DEFAULT_TEXT = 'This is a message from a github pull request.';

/**
 * Generates full branch URL
 * @param {Object} repository - git repository information
 * @param {string} name - branch name
 * @returns {string}
 */
function generateBranchURL(repository: TRepository, name: string): string {
  return `${repository?.html_url}/tree/${name}`;
}

/**
 * Generates user information to display on slack application
 * @param {string} githubUser - GitHub username
 * @param {Object} mapping - object of {<GitHub username>: <Slack member ID>}
 * @returns {string}
 */
function generateUser(
  githubUser: string,
  mapping: TInput['userMapping']
): string {
  const slackMemberID = mapping[githubUser];
  return slackMemberID ? `<@${slackMemberID}> (${githubUser})` : githubUser;
}

/**
 * Checks if user is User type or not
 * @param {Object} reviewer
 * @returns {boolean}
 */
export const isUserReviewer = (
  reviewer: TRequestedReviewers[number]
): reviewer is TUser => (reviewer as TUser).login !== undefined;

/**
 * Gets a list of requested reviewers
 * @param {Object[]} requestedReviewers
 * @param {Object} mapping - object of {<GitHub username>: <Slack member ID>}
 * @returns {string[]}
 */
function getRequestedReviewers(
  requestedReviewers: TRequestedReviewers,
  mapping: TInput['userMapping']
): string[] {
  return requestedReviewers
    .map((reviewer) =>
      isUserReviewer(reviewer) ? generateUser(reviewer.login, mapping) : null
    )
    .filter(Boolean) as string[];
}

/**
 * Gets pull request detail
 * @param {Object} {token,owner,repo,pull_number}
 * @returns {Promise}
 */
async function getPullRequestDetail({
  token,
  owner,
  repo,
  pull_number,
}: {
  token: TInput['githubToken'];
  owner: string;
  repo: string;
  pull_number: number;
}): Promise<TPullRequestWebhookEventPayload['pull_request'] | null> {
  if (!token) return null;

  const octokit = github.getOctokit(token);
  const { data } = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number,
    mediaType: { format: 'json' },
  });

  return data as TPullRequestWebhookEventPayload['pull_request'];
}

/**
 * Builds message content
 * @param {Object} input - action inputs
 * @returns {Promise} promise represents object of {blocks, attachments}
 */
async function buildMessageContent(input: TInput): Promise<{
  blocks: KnownBlock[];
  attachments: MessageAttachment[];
}> {
  const { userMapping } = input;
  const {
    eventName,
    payload: { sender },
  } = github.context;
  let eventStatus: string | undefined;
  let title: string | undefined;
  let pullRequestNumber: number | undefined;
  let head: [url: string, name: string] | undefined;
  let base: [url: string, name: string] | undefined;
  let changedFiles: [url: string, count: number] | undefined;
  let createdBy: string | undefined;
  let color: string | undefined;
  let message: string | undefined;
  let messageURL: string | undefined;
  let labels: string[] = [];
  let requestedReviewers: string[] = [];

  switch (eventName) {
    case 'pull_request': {
      const { number, pull_request, action } = github.context
        .payload as TPullRequestWebhookEventPayload;
      const headBranchName = pull_request.head.ref;
      const baseBranchName = pull_request.base.ref;

      pullRequestNumber = number;
      title = pull_request.title;
      head = [
        generateBranchURL(pull_request.head.repo, headBranchName),
        headBranchName,
      ];
      base = [
        generateBranchURL(pull_request.base.repo, baseBranchName),
        baseBranchName,
      ];
      changedFiles = [
        `${pull_request.html_url}/files`,
        pull_request.changed_files,
      ];
      createdBy = pull_request.user.login;
      messageURL = pull_request.html_url;
      labels = pull_request.labels.map((label) => label.name);
      requestedReviewers = getRequestedReviewers(
        pull_request.requested_reviewers,
        input.userMapping
      );
      eventStatus = action;

      if (action === 'opened') {
        color = '#2DA44E';
        message = 'opened this pull request.';
        break;
      }

      if (action === 'reopened') {
        color = '#0D4C8C';
        message = 'reopened this pull request.';
        break;
      }

      if (action === 'closed') {
        if (pull_request.merged) {
          eventStatus = 'merged';
          color = '#8250DF';
          message = 'merged this pull request.';
        } else {
          color = '#CF222E';
          message = 'closed this pull request.';
        }
      }

      break;
    }

    case 'pull_request_review': {
      const { pull_request, action, review } = github.context
        .payload as TPullRequestReviewWebhookEventPayload;
      const headBranchName = pull_request.head.ref;
      const baseBranchName = pull_request.base.ref;

      pullRequestNumber = pull_request.number;
      title = pull_request.title;
      head = [
        generateBranchURL(pull_request.head.repo, headBranchName),
        headBranchName,
      ];
      base = [
        generateBranchURL(pull_request.base.repo, baseBranchName),
        baseBranchName,
      ];
      createdBy = pull_request.user.login;
      messageURL = review.html_url;
      labels = pull_request.labels.map((label) => label.name);
      requestedReviewers = getRequestedReviewers(
        pull_request.requested_reviewers,
        input.userMapping
      );
      eventStatus = 'review: ';

      const pullRequestDetail = await getPullRequestDetail({
        token: input.githubToken,
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        pull_number: pullRequestNumber,
      });

      if (pullRequestDetail) {
        changedFiles = [
          `${pullRequestDetail.html_url}/files`,
          pullRequestDetail.changed_files,
        ];
      }

      if (action === 'submitted') {
        const {
          review: { state },
        } = github.context
          .payload as TPullRequestReviewSubmittedWebhookEventPayload;
        // state: commented | approved | changes_requested
        eventStatus += state.replace('_', ' ');

        if (state === 'commented') {
          color = '#BBDFFF';
          message = 'reviewed this pull request.';
          break;
        }

        if (state === 'approved') {
          color = '#2DA44E';
          message = 'approved this pull request.';
          break;
        }

        if (state === 'changes_requested') {
          color = '#CF222E';
          message = 'requested changes on this pull request.';
        }

        break;
      }

      if (action === 'edited') {
        eventStatus += 'updated a comment';
        color = '#BBDFFF';
        message = 'updated a review comment on this pull request.';
        break;
      }

      if (action === 'dismissed') {
        eventStatus += 'dismissed';
        color = '#CF222E';
        message = 'dismissed the review changes on this pull request.';
      }

      break;
    }

    case 'issue_comment': {
      const { issue, action, comment } = github.context
        .payload as TIssueCommentWebhookEventPayload;
      pullRequestNumber = issue.number;
      title = issue.title;
      messageURL = comment.html_url;
      labels = issue.labels.map((label) => label.name);

      const pullRequestDetail = await getPullRequestDetail({
        token: input.githubToken,
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        pull_number: pullRequestNumber,
      });

      if (pullRequestDetail) {
        const headBranchName = pullRequestDetail.head.ref;
        const baseBranchName = pullRequestDetail.base.ref;

        head = [
          generateBranchURL(pullRequestDetail.head.repo, headBranchName),
          headBranchName,
        ];
        base = [
          generateBranchURL(pullRequestDetail.base.repo, baseBranchName),
          baseBranchName,
        ];
        createdBy = pullRequestDetail.user?.login;

        changedFiles = [
          `${pullRequestDetail.html_url}/files`,
          pullRequestDetail.changed_files,
        ];

        if (pullRequestDetail.requested_reviewers) {
          requestedReviewers = getRequestedReviewers(
            pullRequestDetail.requested_reviewers as TRequestedReviewers,
            input.userMapping
          );
        }
      }

      if (action === 'created') {
        eventStatus = 'commented';
        color = '#BBDFFF';
        message = 'commented on this pull request.';
        break;
      }

      if (action === 'edited') {
        eventStatus = 'updated a comment';
        message = 'updated a comment on this pull request.';
        color = '#BBDFFF';
      }

      break;
    }

    default: {
      core.info('Unsupported event type.');
      color = '#DDDDDD';
      break;
    }
  }

  const blocks: KnownBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `PULL REQUEST #${pullRequestNumber} - ${eventStatus?.toUpperCase()}`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:small_blue_diamond: *Title:  ${title}*`,
      },
    },
  ];

  if (head) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:small_blue_diamond: *Head branch:*  <${head.join('|')}>`,
      },
    });
  }

  if (base) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:small_blue_diamond: *Base branch:*  <${base.join('|')}>`,
      },
    });
  }

  if (changedFiles) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:small_blue_diamond: *Files changed:*  <${changedFiles.join(
          '|'
        )}>`,
      },
    });
  }

  if (labels.length > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:label: *Labels:*  ${labels
          .map((label) => `\`${label}\``)
          .join(' ')}`,
      },
    });
  }

  if (requestedReviewers.length > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:technologist: *Requested Reviewers:*  ${requestedReviewers.join(
          ', '
        )}`,
      },
    });
  }

  if (createdBy) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:technologist: *Created by:*  ${generateUser(
          createdBy,
          userMapping
        )}`,
      },
    });
  }

  blocks.push({ type: 'divider' });

  return {
    blocks,

    attachments: [
      {
        color,
        blocks: [
          {
            type: 'context',
            elements: [
              {
                type: 'image',
                image_url: sender?.avatar_url,
                alt_text: 'sender avatar image',
              },
              {
                type: 'mrkdwn',
                text: `${generateUser(sender?.login, userMapping)} ${
                  message ?? 'do nothing'
                }`,
              },
              {
                type: 'mrkdwn',
                text: `<${messageURL}|View it on GitHub>`,
              },
            ],
          },
          {
            type: 'context',
            elements: [
              {
                type: 'image',
                image_url: 'https://github.githubassets.com/favicon.ico',
                alt_text: 'github favicon',
              },
              {
                type: 'mrkdwn',
                text: 'From GitHub Action | Powered By <https://github.com/daint2git|daint2git>',
              },
            ],
          },
        ],
      },
    ],
  };
}

/**
 * Posts a message to slack
 * @param {Object} {web,input} - web: instance of Slack API, input: action inputs
 * @returns {Promise} promise represents object of {ts: Slack timestamp ID, metadata_scopes: app scopes}
 */
export async function postMessage({
  web,
  input,
}: {
  web: WebClient;
  input: TInput;
}): Promise<{
  ts: string | undefined;
  metadata_scopes: string[] | undefined;
}> {
  core.info('Action: slack.postMessage: sending a message.');

  const content = await buildMessageContent(input);
  const response = await web.chat.postMessage({
    channel: input.channelId,
    text: DEFAULT_TEXT,
    ...content,
  });

  core.info('Action: slack.postMessage: sent to Slack.');
  core.debug(
    `Action: slack.postMessage: http response received: ${stringify(response)}`
  );

  return {
    ts: response.ts,
    metadata_scopes: response.response_metadata?.scopes,
  };
}

/**
 * Posts a reaction to slack
 * @param {Object} {web,input,timestamp} - web: instance of Slack API, input: action inputs, timestamp: Slack timestamp ID
 * @returns {Promise}
 */
export async function addReaction({
  web,
  input,
  timestamp,
}: {
  web: WebClient;
  input: TInput;
  timestamp: string;
}): Promise<void> {
  const iconName = [
    'heart',
    'heart_eyes',
    'smiling_face_with_3_hearts',
    'medal',
    '100',
  ][Math.floor(Math.random() * 5)];

  core.info('Action: slack.addReaction: sending a message.');

  const response = await web.reactions.add({
    channel: input.channelId,
    name: iconName,
    timestamp,
  });

  core.info('Action: slack.addReaction: sent to Slack.');
  core.debug(
    `Action: slack.addReaction: http response received: ${stringify(response)}`
  );
}

/**
 * Posts a message to slack using Incoming Webhook
 * @param {Object} {web,input} - webhook: instance of Slack Incoming Webhook, input: action inputs
 * @returns {Promise}
 */
export async function postMessageWithWebhook({
  webhook,
  input,
}: {
  webhook: IncomingWebhook;
  input: TInput;
}): Promise<void> {
  core.info('Action: slack.postMessageWithWebhook: sending a message.');

  const content = await buildMessageContent(input);
  const response = await webhook.send({
    text: DEFAULT_TEXT,
    ...content,
  });

  core.info('Action: slack.postMessageWithWebhook: sent to Slack.');
  core.debug(
    `Action: slack.postMessageWithWebhook: http response received: ${stringify(
      response
    )}`
  );
}
