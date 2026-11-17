import * as OTPAuth from 'otpauth';

export const DEFAULTS = Object.freeze({ algorithm: 'SHA1', digits: 6, period: 30 });
export const MAX_ACCOUNTS = 200;
export const MAX_INPUT_LENGTH = 100_000;

export function normalizeSecret(value) {
  const text = value.replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z2-7]+=*$/.test(text)) {
    throw new Error('密钥格式不正确，只能包含字母 A–Z、数字 2–7 和末尾的 =。');
  }
  const unpadded = text.replace(/=+$/, '');
  const padding = text.length - unpadded.length;
  if (![0, 2, 4, 5, 7].includes(unpadded.length % 8)
      || (padding && (text.length % 8 !== 0 || padding !== (8 - unpadded.length % 8) % 8))) {
    throw new Error('密钥长度或 Base32 补位不正确，请检查是否复制完整。');
  }
  const decoded = OTPAuth.Secret.fromBase32(unpadded);
  if (!decoded.bytes.length || decoded.base32 !== unpadded) {
    throw new Error('密钥不是有效的 Base32 编码，请检查末尾字符。');
  }
  return unpadded;
}

function validateOptions(options) {
  const algorithm = String(options.algorithm).toUpperCase();
  const digits = Number(options.digits);
  const period = Number(options.period);
  if (!['SHA1', 'SHA256', 'SHA512'].includes(algorithm)) {
    throw new Error('暂不支持此算法，请使用 SHA1、SHA256 或 SHA512。');
  }
  if (![6, 8].includes(digits)) throw new Error('验证码位数须为 6 位或 8 位。');
  if (!Number.isInteger(period) || period < 1 || period > 300) {
    throw new Error('刷新周期须为 1–300 之间的整数秒。');
  }
  return { algorithm, digits, period };
}

export function parseAccount(value, index = 0, options = DEFAULTS) {
  const line = value.trim();
  let label = `账户 ${String(index + 1).padStart(2, '0')}`;
  let secret;
  let settings = { ...DEFAULTS, ...options };

  if (/^otpauth:\/\//i.test(line)) {
    let uri;
    try { uri = new URL(line); } catch { throw new Error('otpauth 链接格式不正确。'); }
    if (uri.hostname !== 'totp') throw new Error('仅支持 TOTP 时间验证码，不支持 HOTP 计数验证码。');
    for (const key of ['secret', 'algorithm', 'digits', 'period', 'issuer']) {
      if (uri.searchParams.getAll(key).length > 1) throw new Error('链接包含重复参数，请检查原始链接。');
    }
    const rawSecret = uri.searchParams.get('secret');
    if (!rawSecret?.trim()) throw new Error('otpauth 链接缺少 secret 密钥。');
    secret = normalizeSecret(rawSecret);
    try {
      label = decodeURIComponent(uri.pathname.slice(1)) || uri.searchParams.get('issuer') || label;
    } catch { throw new Error('链接中的账户名称编码不正确。'); }
    settings = {
      algorithm: uri.searchParams.get('algorithm') ?? DEFAULTS.algorithm,
      digits: uri.searchParams.get('digits') ?? DEFAULTS.digits,
      period: uri.searchParams.get('period') ?? DEFAULTS.period,
    };
  } else if (line.includes('|')) {
    const fields = line.split('|');
    if (fields.length < 3) throw new Error('账户格式应为 UID|密码|2FA密钥，可在后面追加邮箱等字段。');
    label = fields[0].trim() || label;
    secret = normalizeSecret(fields[2]);
  } else {
    secret = normalizeSecret(line);
  }

  settings = validateOptions(settings);
  return {
    id: index,
    line: index + 1,
    label: label.slice(0, 100),
    secret,
    ...settings,
    totp: new OTPAuth.TOTP({ ...settings, secret: OTPAuth.Secret.fromBase32(secret) }),
  };
}

export function parseAccounts(input, options = DEFAULTS) {
  if (input.length > MAX_INPUT_LENGTH) throw new Error('输入内容过长，请分批处理。');
  const lines = input.split(/\r?\n/).map((value, index) => ({ value, index })).filter(({ value }) => value.trim());
  if (!lines.length) throw new Error('请先输入 2FA 密钥或 otpauth 链接。');
  if (lines.length > MAX_ACCOUNTS) throw new Error(`每次最多处理 ${MAX_ACCOUNTS} 个账户，请分批生成。`);
  const entries = [];
  const errors = [];
  for (const { value, index } of lines) {
    try { entries.push(parseAccount(value, index, options)); }
    catch (error) { errors.push({ line: index + 1, message: error.message }); }
  }
  return { entries, errors };
}

export function readAccount(entry, timestamp = Date.now()) {
  const interval = entry.period * 1000;
  const milliseconds = interval - (timestamp % interval);
  return {
    code: entry.totp.generate({ timestamp }),
    remaining: Math.ceil(milliseconds / 1000),
    fraction: milliseconds / interval,
  };
}

export function maskSecret(secret) {
  return secret.length > 8 ? `${secret.slice(0, 4)} •••• •••• ${secret.slice(-4)}` : '•••• ••••';
}
