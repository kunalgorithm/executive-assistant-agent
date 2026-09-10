import assert from 'node:assert/strict';
import { test } from 'node:test';

import { getOnboardingReply, isAccountConnectionRequest, omitConnectionLinks } from './connection-policy';
import { buildConnectionStatusBlock } from './prompts';

test('greetings do not mint a token or ask new users to connect', async () => {
  let issued = 0;
  const reply = await getOnboardingReply({
    text: 'Hi Sayla!',
    isNewUser: true,
    issueLink: async () => {
      issued++;
      return 'unused';
    },
  });
  assert.match(reply!, /sayla/);
  assert.doesNotMatch(reply!, /connect|accounts?|https?:/i);
  assert.equal(issued, 0);
});

test('ordinary first and later messages continue to the assistant without rotating connection tokens', async () => {
  for (const isNewUser of [true, false]) {
    for (const text of [
      'remind me tomorrow at 9 to call mum',
      'help me plan dinner',
      "what's on my calendar?",
      'summarize my inbox',
      'why do I need a connect link?',
      'thanks',
      'hi',
    ]) {
      if (isNewUser && text === 'hi') continue;
      const reply = await getOnboardingReply({
        text,
        isNewUser,
        issueLink: async () => {
          throw new Error('Must not issue or rotate a token');
        },
      });
      assert.equal(reply, null, text);
    }
  }
});

test('explicit connection requests work even on the first message', async () => {
  const link = 'https://api.example.com/connect?t=test-token';
  for (const text of [
    'connect',
    'LINK',
    'Reconnect!',
    'connect my calendar',
    'Can you please connect my Google account?',
    'link my email',
    'connect Microsoft',
    'send me a fresh connect link',
    "I'd like to connect another account",
    'how do I connect my gmail?',
  ]) {
    let issued = 0;
    const reply = await getOnboardingReply({
      text,
      isNewUser: true,
      issueLink: async () => {
        issued++;
        return link;
      },
    });
    assert.ok(reply?.includes(link), text);
    assert.equal(issued, 1, text);
  }
});

test('negated, deferred and unrelated link requests do not start account connection', () => {
  for (const text of [
    "don't connect my calendar",
    'please do not connect my google account',
    'connect my calendar later',
    'I might connect my calendar',
    'should I connect my Google account?',
    'connect me to a person',
    'send me a restaurant link',
    'reconnect with Priya',
    '"connect my calendar"',
    'what accounts are connected?',
  ]) {
    assert.equal(isAccountConnectionRequest(text), false, text);
  }
});

test('old account bearer links are omitted from AI history while ordinary links remain', () => {
  const text =
    'connect here https://old.example.com/connect?t=secret-one and https://api.example.com/api/auth/google/start?t=secret-two\nrestaurant: https://example.com/menu';
  const safe = omitConnectionLinks(text);
  assert.doesNotMatch(safe, /secret-one|secret-two/);
  assert.match(safe, /https:\/\/example.com\/menu/);
});

test('unconnected accounts leave reminders available and expose no generated link to the AI', () => {
  const block = buildConnectionStatusBlock({
    calendarConnected: false,
    contactsConnected: false,
    tasksConnected: false,
    gmailConnected: false,
    connectedAccounts: [],
    restaurantsAvailable: false,
  });
  assert.match(block, /Sayla reminders: ALWAYS AVAILABLE/);
  assert.match(block, /do not initiate setup/);
  assert.doesNotMatch(block, /tap the connect link|## Connect Link|\/connect\?t=/);
});
