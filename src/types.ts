import type { EmitterWebhookEvent } from '@octokit/webhooks';

export type TInput = {
  githubToken: string;
  botToken: string;
  channelId: string;
  webhookUrl: string;
  userMapping: Record<string, string>;
};

export type TPullRequestWebhookEventPayload =
  EmitterWebhookEvent<'pull_request'>['payload'];

export type TIssueCommentWebhookEventPayload =
  EmitterWebhookEvent<'issue_comment'>['payload'];

export type TPullRequestReviewWebhookEventPayload =
  EmitterWebhookEvent<'pull_request_review'>['payload'];

export type TPullRequestReviewSubmittedWebhookEventPayload =
  EmitterWebhookEvent<'pull_request_review.submitted'>['payload'] & {
    review: {
      state: 'commented' | 'approved' | 'changes_requested';
    };
  };

export type TPullRequestReviewEditedWebhookEventPayload =
  EmitterWebhookEvent<'pull_request_review.edited'>['payload'];

export type TPullRequestReviewDismissedWebhookEventPayload =
  EmitterWebhookEvent<'pull_request_review.dismissed'>['payload'];

export type TUser = TPullRequestWebhookEventPayload['pull_request']['user'];
export type TRequestedReviewers =
  TPullRequestWebhookEventPayload['pull_request']['requested_reviewers'];

export type TRepository = TPullRequestWebhookEventPayload['repository'];
