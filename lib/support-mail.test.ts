import {
  SUPPORT_SUBJECT,
  buildSupportBody,
  buildSupportMailto,
  describeSystem,
  normalizeSupportEmail,
} from './support-mail';

const CONTEXT = { versionLabel: 'FairwayIQ 1.0.0 (12)', platform: 'ios', osVersion: '26.1' };

function parseMailto(url: string) {
  const [target, query = ''] = url.replace(/^mailto:/, '').split('?');
  const params = Object.fromEntries(
    query.split('&').map((pair) => {
      const [key, ...rest] = pair.split('=');
      return [key, decodeURIComponent(rest.join('='))];
    }),
  );

  return { address: decodeURIComponent(target), params };
}

describe('normalizeSupportEmail', () => {
  it('returns a trimmed valid address', () => {
    expect(normalizeSupportEmail('  aide@fairwayiq.app ')).toBe('aide@fairwayiq.app');
    expect(normalizeSupportEmail('prenom.nom+golf@mail.example.fr')).toBe('prenom.nom+golf@mail.example.fr');
  });

  it('treats empty, blank and missing values as unset', () => {
    expect(normalizeSupportEmail('')).toBeNull();
    expect(normalizeSupportEmail('   ')).toBeNull();
    expect(normalizeSupportEmail(undefined)).toBeNull();
    expect(normalizeSupportEmail(null)).toBeNull();
  });

  it.each([
    'aide',
    'aide@',
    '@fairwayiq.app',
    'aide@fairwayiq',
    'aide@fairwayiq..app',
    'ai de@fairwayiq.app',
    'a@b.app, c@d.app',
    'a@b.app;c@d.app',
    'aide@fairwayiq.app?cc=autre@example.com',
    'aide@fairwayiq.app&bcc=autre@example.com',
    'mailto:aide@fairwayiq.app',
    'Aide <aide@fairwayiq.app>',
  ])('rejects %s', (value) => {
    expect(normalizeSupportEmail(value)).toBeNull();
  });
});

describe('describeSystem', () => {
  it('names the platform and appends the OS version', () => {
    expect(describeSystem('ios', '26.1')).toBe('iOS 26.1');
    expect(describeSystem('android', 35)).toBe('Android 35');
  });

  it('falls back to the raw platform and drops a missing version', () => {
    expect(describeSystem('web', null)).toBe('web');
    expect(describeSystem('ios', undefined)).toBe('iOS');
    expect(describeSystem('ios', '  ')).toBe('iOS');
  });
});

describe('buildSupportBody', () => {
  it('carries only the app version, the platform and the OS version', () => {
    expect(buildSupportBody(CONTEXT)).toBe(
      '\n\n---\nInfos techniques, à garder dans ton message :\nApplication : FairwayIQ 1.0.0 (12)\nSystème : iOS 26.1',
    );
  });
});

describe('buildSupportMailto', () => {
  it('builds a mailto URL with an encoded subject and body', () => {
    const url = buildSupportMailto('aide@fairwayiq.app', CONTEXT);

    expect(url.startsWith('mailto:aide@fairwayiq.app?subject=')).toBe(true);
    expect(url).toContain('subject=FairwayIQ%20%E2%80%94%20aide&body=');
    expect(url).not.toMatch(/[ \n\r+]/);
  });

  it('round-trips the subject and the body, with CRLF line breaks', () => {
    const { address, params } = parseMailto(buildSupportMailto('aide@fairwayiq.app', CONTEXT));

    expect(address).toBe('aide@fairwayiq.app');
    expect(params.subject).toBe(SUPPORT_SUBJECT);
    expect(params.subject).toBe('FairwayIQ — aide');
    expect(params.body).toBe(buildSupportBody(CONTEXT).replace(/\n/g, '\r\n'));
    expect(params.body).toContain('FairwayIQ 1.0.0 (12)');
    expect(params.body).toContain('iOS 26.1');
  });

  it('keeps the at sign readable and escapes a plus sign in the address', () => {
    const url = buildSupportMailto('aide+app@fairwayiq.app', CONTEXT);

    expect(url.startsWith('mailto:aide%2Bapp@fairwayiq.app?')).toBe(true);
    expect(parseMailto(url).address).toBe('aide+app@fairwayiq.app');
  });

  it('escapes reserved characters coming from the context so they cannot add fields', () => {
    const { params } = parseMailto(
      buildSupportMailto('aide@fairwayiq.app', { ...CONTEXT, versionLabel: 'FairwayIQ 1.0.0 & cc=x@y.z #1' }),
    );

    expect(Object.keys(params).sort()).toEqual(['body', 'subject']);
    expect(params.body).toContain('FairwayIQ 1.0.0 & cc=x@y.z #1');
  });
});
