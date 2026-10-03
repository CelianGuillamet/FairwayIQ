import { redactUrlForLogging } from './redact-url';

describe('redactUrlForLogging', () => {
  it('redacts sensitive query params and keeps the rest', () => {
    expect(
      redactUrlForLogging('https://example.com/auth/callback?access_token=abc.def.ghi&refresh_token=r123&type=signup'),
    ).toBe('https://example.com/auth/callback?access_token=[redacted]&refresh_token=[redacted]&type=signup');
  });

  it('redacts the PKCE code and token_hash in the query string', () => {
    expect(redactUrlForLogging('fairwayiq://auth-callback?code=1234-abcd')).toBe(
      'fairwayiq://auth-callback?code=[redacted]',
    );
    expect(redactUrlForLogging('https://example.com/verify?token_hash=th_999&type=recovery')).toBe(
      'https://example.com/verify?token_hash=[redacted]&type=recovery',
    );
  });

  it('redacts sensitive params in the hash fragment', () => {
    expect(
      redactUrlForLogging('https://example.com/cb#access_token=abc&refresh_token=def&expires_in=3600&token_type=bearer'),
    ).toBe('https://example.com/cb#access_token=[redacted]&refresh_token=[redacted]&expires_in=3600&token_type=[redacted]');
  });

  it('redacts every listed sensitive param', () => {
    const names = [
      'access_token',
      'refresh_token',
      'token',
      'token_hash',
      'code',
      'id_token',
      'provider_token',
      'provider_refresh_token',
    ];
    const url = `fairwayiq://auth-callback#${names.map((name) => `${name}=secret-${name}`).join('&')}`;
    const redacted = redactUrlForLogging(url);

    expect(redacted).not.toContain('secret-');
    names.forEach((name) => expect(redacted).toContain(`${name}=[redacted]`));
  });

  it('redacts any param whose name contains token or secret, case-insensitively', () => {
    expect(redactUrlForLogging('https://example.com/?My_Token=a&CLIENT_SECRET=b&Secret=c&plain=ok')).toBe(
      'https://example.com/?My_Token=[redacted]&CLIENT_SECRET=[redacted]&Secret=[redacted]&plain=ok',
    );
    expect(redactUrlForLogging('https://example.com/#ACCESS_TOKEN=a&Code=b')).toBe(
      'https://example.com/#ACCESS_TOKEN=[redacted]&Code=[redacted]',
    );
  });

  it('redacts params in both the query string and the hash fragment of the same url', () => {
    expect(redactUrlForLogging('https://example.com/cb?code=abc&keep=1#refresh_token=def&keep2=2')).toBe(
      'https://example.com/cb?code=[redacted]&keep=1#refresh_token=[redacted]&keep2=2',
    );
  });

  it('handles custom schemes with tokens in the fragment', () => {
    expect(
      redactUrlForLogging('fairwayiq://auth-callback#access_token=eyJhbGciOi.payload.sig&refresh_token=abc123&type=signup'),
    ).toBe('fairwayiq://auth-callback#access_token=[redacted]&refresh_token=[redacted]&type=signup');
  });

  it('handles dev client urls with a path prefix', () => {
    expect(redactUrlForLogging('exp://192.168.1.10:8081/--/auth-callback#access_token=abc&refresh_token=def')).toBe(
      'exp://192.168.1.10:8081/--/auth-callback#access_token=[redacted]&refresh_token=[redacted]',
    );
  });

  it('leaves urls without params unchanged', () => {
    expect(redactUrlForLogging('fairwayiq://auth-callback')).toBe('fairwayiq://auth-callback');
    expect(redactUrlForLogging('https://example.com/path/to/page')).toBe('https://example.com/path/to/page');
  });

  it('leaves non-sensitive params unchanged', () => {
    expect(redactUrlForLogging('https://example.com/?a=1&error_code=otp_expired#section=2')).toBe(
      'https://example.com/?a=1&error_code=otp_expired#section=2',
    );
  });

  it('does not redact params that merely end in code', () => {
    expect(redactUrlForLogging('https://example.com/?postcode=75001&barcode=x')).toBe(
      'https://example.com/?postcode=75001&barcode=x',
    );
  });

  it('redacts values nested in another param value', () => {
    expect(redactUrlForLogging('fairwayiq://x?redirect=https://example.com/cb?code=abc&ok=1')).toBe(
      'fairwayiq://x?redirect=https://example.com/cb?code=[redacted]&ok=1',
    );
  });

  it('redacts percent-encoded param names', () => {
    expect(redactUrlForLogging('fairwayiq://auth-callback?access%5Ftoken=abc')).toBe(
      'fairwayiq://auth-callback?access%5Ftoken=[redacted]',
    );
  });

  it('keeps values that contain = signs fully redacted', () => {
    expect(redactUrlForLogging('fairwayiq://auth-callback#access_token=abc==&type=signup')).toBe(
      'fairwayiq://auth-callback#access_token=[redacted]&type=signup',
    );
  });

  it('redacts best-effort on malformed urls without throwing', () => {
    expect(redactUrlForLogging('not a url?access_token=abc&refresh_token=def')).toBe(
      'not a url?access_token=[redacted]&refresh_token=[redacted]',
    );
    expect(redactUrlForLogging('http://[::1?code=abc')).toBe('http://[::1?code=[redacted]');
    expect(redactUrlForLogging('access_token=abc')).toBe('access_token=[redacted]');
    expect(redactUrlForLogging('://#%E0%A4%A=1&token=x&%E0%A4%A_token=y')).toBe(
      '://#%E0%A4%A=1&token=[redacted]&%E0%A4%A_token=[redacted]',
    );
    expect(redactUrlForLogging('???&&&###===')).toBe('???&&&###===');
  });

  it('redacts urls embedded in error messages', () => {
    expect(redactUrlForLogging('Invalid URL: fairwayiq://auth-callback#access_token=abc&refresh_token=def')).toBe(
      'Invalid URL: fairwayiq://auth-callback#access_token=[redacted]&refresh_token=[redacted]',
    );
  });

  it('returns the empty string for an empty input', () => {
    expect(redactUrlForLogging('')).toBe('');
  });

  it('returns a safe fallback for non-string input', () => {
    expect(redactUrlForLogging(undefined as unknown as string)).toBe('[unparseable url]');
    expect(redactUrlForLogging(null as unknown as string)).toBe('[unparseable url]');
    expect(redactUrlForLogging({ href: 'x?token=abc' } as unknown as string)).toBe('[unparseable url]');
  });
});
