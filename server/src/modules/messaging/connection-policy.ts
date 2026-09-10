import { CONNECT_LINK_REFRESH_MESSAGE, WELCOME_MESSAGE } from './prompts';

// Conservative, explicit requests only. Mentioning calendar/email or asking why
// connection exists does not opt someone in to account setup.
export function isAccountConnectionRequest(text: string): boolean {
  const request = text
    .trim()
    .toLowerCase()
    .replace(/’/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/[.!?]+$/, '')
    .replace(/^(?:can you |could you |would you |i(?:'d| would) like to |i want to |help me |how do i )/, '')
    .replace(/^please /, '')
    .replace(/,? please$/, '');
  if (/^(connect|link|reconnect)$/.test(request)) return true;
  if (
    /^(?:send|give|show)(?: me)? (?:(?:a|the|another) )?(?:(?:new|fresh) )?(?:connect|connection|reconnect|account connection) link$/.test(
      request,
    )
  )
    return true;
  return /^(?:connect|reconnect|link) (?:(?:my|an?|another|the) )?(?:(?:google|microsoft|gmail|outlook)(?: (?:accounts?|calendar|email|tasks|contacts))?|accounts?|calendar|email|tasks|contacts)$/.test(
    request,
  );
}

export async function getOnboardingReply(opts: {
  text: string;
  isNewUser: boolean;
  issueLink: () => Promise<string>;
}): Promise<string | null> {
  if (isAccountConnectionRequest(opts.text)) return CONNECT_LINK_REFRESH_MESSAGE(await opts.issueLink());
  if (
    opts.isNewUser &&
    /^(hi|hello|hey|hiya|yo|good morning|good afternoon|good evening)(?: sayla)?[!.\s]*$/i.test(opts.text.trim())
  ) {
    return WELCOME_MESSAGE;
  }
  return null;
}

// Old assistant replies can contain bearer links. They are issued deterministically
// above, never copied from conversation history or regenerated on unrelated turns.
export function omitConnectionLinks(text: string): string {
  return text.replace(
    /https?:\/\/[^\s]+\/(?:connect\?t=|api\/auth\/(?:google|microsoft)\/start\?t=)[^\s]+/g,
    '[account connection link omitted]',
  );
}
