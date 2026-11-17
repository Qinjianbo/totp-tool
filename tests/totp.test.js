import test from 'node:test';
import assert from 'node:assert/strict';
import * as OTPAuth from 'otpauth';
import * as BrowserOTPAuth from 'otpauth/dist/otpauth.esm.min.js';
import { DEFAULTS, parseAccount, parseAccounts, readAccount, normalizeSecret, maskSecret } from '../src/totp.js';

// RFC 6238 Appendix B: independent, published expected values.
const vectors = [
  [59, '94287082', '46119246', '90693936'],
  [1111111109, '07081804', '68084774', '25091201'],
  [1111111111, '14050471', '67062674', '99943326'],
  [1234567890, '89005924', '91819424', '93441116'],
  [2000000000, '69279037', '90698825', '38618901'],
  [20000000000, '65353130', '77737706', '47863826'],
];
const keys = {
  SHA1: '12345678901234567890',
  SHA256: '12345678901234567890123456789012',
  SHA512: '1234567890123456789012345678901234567890123456789012345678901234',
};
for (const [index, algorithm] of ['SHA1', 'SHA256', 'SHA512'].entries()) {
  for (const [seconds, ...expected] of vectors) {
    test(`RFC 6238 ${algorithm} at ${seconds}`, () => {
      const secret = OTPAuth.Secret.fromUTF8(keys[algorithm]).base32;
      const entry = parseAccount(secret, 0, { algorithm, digits: 8, period: 30 });
      assert.equal(readAccount(entry, seconds * 1000).code, expected[index]);
    });
    test(`Browser bundle RFC 6238 ${algorithm} at ${seconds}`, () => {
      const totp = new BrowserOTPAuth.TOTP({
        secret: BrowserOTPAuth.Secret.fromUTF8(keys[algorithm]),
        algorithm, digits: 8, period: 30,
      });
      assert.equal(totp.generate({ timestamp: seconds * 1000 }), expected[index]);
    });
  }
}

test('six-digit tokens preserve leading zeros', () => {
  const entry = parseAccount(OTPAuth.Secret.fromUTF8(keys.SHA1).base32);
  assert.equal(readAccount(entry, 1111111109000).code, '081804');
});
test('clock rollover uses actual timestamp; background jumps recover immediately', () => {
  const entry = parseAccount(OTPAuth.Secret.fromUTF8(keys.SHA1).base32);
  assert.equal(readAccount(entry, 29999).remaining, 1);
  assert.equal(readAccount(entry, 30000).remaining, 30);
  assert.equal(readAccount(entry, 30000).fraction, 1);
  assert.equal(readAccount(entry, 59000).code, '287082');
  assert.equal(readAccount(entry, 1111111109000).code, '081804');
});
test('canonical Base32, spaces, lowercase and padding', () => {
  assert.equal(normalizeSecret(' jbsw y3dp ehpk 3pxp '), 'JBSWY3DPEHPK3PXP');
  assert.equal(normalizeSecret('MY======'), 'MY');
  for (const invalid of ['', 'ABC01', 'A', 'ABC', 'ABCDEF', 'MZ', 'MY=', 'MY=======', 'MY======AA']) {
    assert.throws(() => normalizeSecret(invalid), undefined, invalid);
  }
});
test('mixed batch isolates errors and preserves source line numbers without password fields', () => {
  const { entries, errors } = parseAccounts('JBSWY3DPEHPK3PXP\n\nalice|not-retained|JBSWY3DPEHPK3PXP|a@b.test|also-not-retained\nBAD01');
  assert.equal(entries.length, 2);
  assert.equal(entries[1].label, 'alice');
  assert.equal(entries[1].line, 3);
  assert.equal(errors[0].line, 4);
  assert.ok(!JSON.stringify(entries).includes('not-retained'));
  assert.ok(!errors[0].message.includes('BAD01'));
});
test('TOTP URI uses its own options and decoded label', () => {
  const entry = parseAccount('otpauth://totp/Example%3Aalice?secret=JBSWY3DPEHPK3PXP&algorithm=SHA256&digits=8&period=60');
  assert.equal(entry.label, 'Example:alice');
  assert.equal(entry.algorithm, 'SHA256');
  assert.equal(entry.digits, 8);
  assert.equal(entry.period, 60);
  assert.equal(readAccount(entry, 30000).remaining, 30);
  const standard = parseAccount('otpauth://totp/alice?secret=JBSWY3DPEHPK3PXP', 0, { algorithm: 'SHA512', digits: 8, period: 60 });
  for (const key of Object.keys(DEFAULTS)) assert.equal(standard[key], DEFAULTS[key]);
});
test('URI and manual option validation rejects unsupported or ambiguous inputs', () => {
  const base = 'otpauth://totp/alice?secret=JBSWY3DPEHPK3PXP';
  for (const uri of ['otpauth://hotp/alice?secret=JBSWY3DPEHPK3PXP', 'otpauth://totp/alice', `${base}&secret=MY`, `${base}&algorithm=MD5`, `${base}&digits=7`, `${base}&period=0`, `${base}&period=1.5`, `${base}&period=301`, 'otpauth://totp/%ZZ?secret=MY']) {
    assert.throws(() => parseAccount(uri), undefined, uri);
  }
  assert.throws(() => parseAccount('JBSWY3DPEHPK3PXP', 0, { period: '' }));
  assert.throws(() => parseAccount('alice|password'));
});
test('batch limits prevent empty or oversized input', () => {
  assert.throws(() => parseAccounts(' \n '));
  assert.throws(() => parseAccounts(Array(201).fill('JBSWY3DPEHPK3PXP').join('\n')));
  assert.equal(parseAccounts(Array(200).fill('JBSWY3DPEHPK3PXP').join('\n')).entries.length, 200);
  assert.throws(() => parseAccounts('A'.repeat(100001)));
});
test('secret display masks short and long secrets', () => {
  assert.equal(maskSecret('MY'), '•••• ••••');
  assert.equal(maskSecret('JBSWY3DPEHPK3PXP'), 'JBSW •••• •••• 3PXP');
});
