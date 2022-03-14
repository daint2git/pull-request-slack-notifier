# Pull Request Slack Notifier

[![ci](https://github.com/daint2git/pull-request-slack-notifier/actions/workflows/ci.yml/badge.svg)](https://github.com/daint2git/pull-request-slack-notifier/actions?query=workflow:ci)

A [GitHub Action](https://github.com/features/actions) to send a message to a Slack channel when an event (`opened`, `reopened`, `merged`, `closed`, `commented`, `review commented`, `review approved` or `review dismissed`) occurs on a pull request.

This package has two different techniques to send a message to Slack:

1. Send a message via a Slack app to post to a specific channel (use an existing custom app or create a new one).
1. Send a message via a Slack Incoming Webhook URL (use an existing custom app or create a new one).

The recommended way to use this action is with the Slack app.

## Techniques

### Technique 1: Slack App

By creating a new Slack app or using an existing one, this approach allows your GitHub Actions job to post a message in a Slack channel by utilizing the [Slack Web API](https://api.slack.com/messaging/sending).

### Setup

- [Create a Slack App][apps] for your workspace (alternatively use an existing app you have already created and installed).
- Add [`chat.write`](https://api.slack.com/scopes/chat:write) and [`reactions:write`](https://api.slack.com/scopes/reactions:write) (optional) bot scope under **OAuth & Permissions**.
- Install the app to your workspace.
- Copy the app's Bot User OAuth Token from the **OAuth & Permissions** page and [add it as a secret in your repo settings][repo-secret] named `SLACK_BOT_TOKEN`.
- Copy the channel ID is displayed in the browser URL and [add it as a secret in your repo settings][repo-secret] named `SLACK_CHANNEL_ID`. For example: `https://app.slack.com/client/TXXXXXXXXXX/DXXXXXXXXXX`, channel ID is `DXXXXXXXXXX`.
- Invite the bot user into the channel you wish to post messages to (you will type a message `/invite @bot_user_name`).

See more [details](https://api.slack.com/messaging/sending).

### Usage

You can use this action after any other action. Here is a simple example setup of this action:

1. Create a `.github/workflows/notify-pull-request-slack.yml` file in your GitHub repo.
1. Add the following code to the `notify-pull-request-slack.yml` file.

For a pull request is `opened`, `reopened`, `merged` or `closed`

```yml
name: Notify Pull Request Slack

on:
  pull_request:
    types:
      - opened
      - reopened
      - closed

jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - uses: daint2git/pull-request-slack-notifier@v1
        with:
          slack-bot-token: ${{ secrets.SLACK_BOT_TOKEN }}
          slack-channel-id: ${{ secrets.SLACK_CHANNEL_ID }}
          user-mapping: |
            {
              "GitHub username 1": "Slack member ID 1",
              "GitHub username 2": "Slack member ID 2"
            }
```

For a pull request is `commented`

```yml
name: Notify Pull Request Slack

on:
  issue_comment:
    types:
      - created
      - edited

jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - uses: daint2git/pull-request-slack-notifier@v1
        with:
          slack-bot-token: ${{ secrets.SLACK_BOT_TOKEN }}
          slack-channel-id: ${{ secrets.SLACK_CHANNEL_ID }}
          user-mapping: |
            {
              "GitHub username 1": "Slack member ID 1",
              "GitHub username 2": "Slack member ID 2"
            }
```

For a pull request is `review commented`, `review approved` or `review dismissed`

```yml
name: Notify Pull Request Slack

on:
  pull_request_review:
    types:
      - submitted
      - edited
      - dismissed

jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - uses: daint2git/pull-request-slack-notifier@v1
        with:
          slack-bot-token: ${{ secrets.SLACK_BOT_TOKEN }}
          slack-channel-id: ${{ secrets.SLACK_CHANNEL_ID }}
          user-mapping: |
            {
              "GitHub username 1": "Slack member ID 1",
              "GitHub username 2": "Slack member ID 2"
            }
```

Note that you can completely combine them together.

### Technique 2: Slack Incoming Webhook

By creating a new Slack app or using an existing one, this approach allows your GitHub Actions job to post a message to a Slack channel by utilizing [Slack Incoming Webhooks](https://api.slack.com/messaging/webhooks).

### Setup

- [Create a Slack App][apps] for your workspace (alternatively use an existing app you have already created and installed).
- Add the [`incoming-webhook`](https://api.slack.com/scopes/incoming-webhook) bot scope under **OAuth & Permissions**.
- Install the app to your workspace (you will select a channel to notify).
- Activate and create a new webhook under **Incoming Webhooks**.
- Copy the Webhook URL from the Webhook you just generated [add it as a secret in your repo settings][repo-secret] named `SLACK_WEBHOOK_URL`.

See more [details](https://api.slack.com/messaging/webhooks).

### Usage

You can use this action after any other action. Here is a simple example setup of this action:

1. Create a `.github/workflows/notify-pull-request-slack.yml` file in your GitHub repo.
1. Add the following code to the `notify-pull-request-slack.yml` file.

For a pull request is `opened`, `reopened`, `merged` or `closed`

```yml
name: Notify Pull Request Slack

on:
  pull_request:
    types:
      - opened
      - reopened
      - closed

jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - uses: daint2git/pull-request-slack-notifier@v1
        with:
          slack-webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
          user-mapping: |
            {
              "GitHub username 1": "Slack member ID 1",
              "GitHub username 2": "Slack member ID 2"
            }
```

For a pull request is `commented`

```yml
name: Notify Pull Request Slack

on:
  issue_comment:
    types:
      - created
      - edited

jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - uses: daint2git/pull-request-slack-notifier@v1
        with:
          slack-webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
          user-mapping: |
            {
              "GitHub username 1": "Slack member ID 1",
              "GitHub username 2": "Slack member ID 2"
            }
```

For a pull request is `review commented`, `review approved` or `review dismissed`

```yml
name: Notify Pull Request Slack

on:
  pull_request_review:
    types:
      - submitted
      - edited
      - dismissed

jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - uses: daint2git/pull-request-slack-notifier@v1
        with:
          slack-webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
          user-mapping: |
            {
              "GitHub username 1": "Slack member ID 1",
              "GitHub username 2": "Slack member ID 2"
            }
```

Note that you can completely combine them together.

## Inputs

| Name              | Required | Default        | Purpose                                                                                                                                                                                                                                              |
| ----------------- | -------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| github-token      | false    | `github.token` | The GitHub token used to create an authenticated client. By default, this action uses the [`github.token`](https://docs.github.com/en/actions/security-guides/automatic-token-authentication) input to get pull request information in your workflow |
| slack-bot-token   | false    |                | Slack bot user OAuth token generated by Slack                                                                                                                                                                                                        |
| slack-channel-id  | false    |                | Slack channel ID where the message will be posted. The `slack-channel-id` input is required when the `slack-bot-token` input is provided                                                                                                             |
| slack-webhook-url | false    |                | Slack Incoming Webhook URL generated by Slack                                                                                                                                                                                                        |
| user-mapping      | false    | `{}`           | Mapping between GitHub username and Slack member ID. [How to get a Slack Member ID from a workspace in Slack](https://moshfeu.medium.com/how-to-find-my-member-id-in-slack-workspace-d4bba942e38c). Note that the Member ID is workspace specific    |

Note that you need to provide at least one `slack-bot-token` input or `slack-webhook-url` input to run this action.

## Troubleshooting

To enable runner diagnostic logging set the `ACTIONS_RUNNER_DEBUG` secret to `true`.

To enable step debug logging set the `ACTIONS_STEP_DEBUG` secret to `true`.

See more [details](https://docs.github.com/en/actions/monitoring-and-troubleshooting-workflows/enabling-debug-logging)

## References

- https://github.com/marketplace/actions/slack-send
- https://github.com/marketplace/actions/slack-notify
- https://github.com/marketplace/actions/slack-github-actions-slack-integration
- https://api.slack.com/messaging/sending
- https://api.slack.com/messaging/webhooks
- https://api.slack.com/web
- https://github.com/hmcts/github-slack-user-mappings
- https://docs.github.com/en/actions/creating-actions/creating-a-javascript-action
- https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows
- https://docs.github.com/en/developers/webhooks-and-events/webhooks/webhook-events-and-payloads

## License

This Action is distributed under the terms of the MIT license, see [LICENSE](./LICENSE) for details.

[repo-secret]: https://docs.github.com/en/actions/security-guides/encrypted-secrets#creating-encrypted-secrets-for-a-repository
[apps]: https://api.slack.com/apps
