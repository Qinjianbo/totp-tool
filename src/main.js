import { parseAccounts, readAccount, maskSecret } from './totp.js';

const $ = (selector) => document.querySelector(selector);
const input = $('#secret-input');
const form = $('#auth-form');
const list = $('#results-list');
const empty = $('#empty-state');
const errorBox = $('#input-error');
const parseErrors = $('#parse-errors');
const copyAll = $('#copy-all');
const toast = $('#toast');
let accounts = [];
let toastTimeout;

function notify(message) {
  clearTimeout(toastTimeout);
  toast.textContent = message;
  toast.hidden = false;
  toastTimeout = setTimeout(() => { toast.hidden = true; }, 3500);
}

function updateInputCount() {
  const count = input.value.split(/\r?\n/).filter((line) => line.trim()).length;
  $('#line-count').textContent = `${count} / 200`;
  $('#line-count').classList.toggle('over-limit', count > 200);
  errorBox.hidden = true;
  input.removeAttribute('aria-invalid');
}

async function writeClipboard(text) {
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(text);
  } catch {
    // Fallback for browsers that deny the asynchronous clipboard API.
    const active = document.activeElement;
    const helper = document.createElement('textarea');
    helper.value = text;
    helper.className = 'clipboard-helper';
    helper.setAttribute('readonly', '');
    document.body.append(helper);
    helper.select();
    let success = false;
    try { success = document.execCommand('copy'); }
    finally { helper.remove(); active?.focus({ preventScroll: true }); }
    if (!success) throw new Error('复制未成功，请选中验证码手动复制。');
  }
}

function updateResultsStatus() {
  $('#result-count').textContent = accounts.length;
  $('#result-count').hidden = !accounts.length;
  copyAll.disabled = !accounts.length;
  empty.hidden = Boolean(accounts.length);
  $('#results-status').textContent = accounts.length
    ? `${accounts.length} 个账户 · 验证码自动刷新中`
    : '准备就绪，等待添加密钥';
}

function tick() {
  const timestamp = Date.now();
  for (const account of accounts) {
    const { code, remaining, fraction } = readAccount(account.entry, timestamp);
    if (account.token.textContent !== code) account.token.textContent = code;
    account.counter.textContent = remaining;
    account.countdown.style.setProperty('--progress', `${fraction * 360}deg`);
    account.countdown.classList.toggle('expiring', remaining <= 5);
    account.countdown.setAttribute('aria-label', `${remaining} 秒后更新`);
    account.countdown.title = `${remaining} 秒后更新`;
  }
}

function addAccount(entry) {
  const card = $('#account-template').content.firstElementChild.cloneNode(true);
  const name = card.querySelector('.account-name');
  name.textContent = entry.label;
  name.title = entry.label;
  card.querySelector('.account-settings').textContent = `${entry.algorithm} · ${entry.digits} 位 · ${entry.period} 秒`;
  const secret = card.querySelector('.secret-preview');
  secret.textContent = maskSecret(entry.secret);
  const reveal = card.querySelector('.reveal-button');
  reveal.setAttribute('aria-label', `显示 ${entry.label} 的密钥`);
  reveal.addEventListener('click', () => {
    const visible = reveal.getAttribute('aria-pressed') !== 'true';
    reveal.setAttribute('aria-pressed', String(visible));
    reveal.setAttribute('aria-label', `${visible ? '隐藏' : '显示'} ${entry.label} 的密钥`);
    reveal.title = visible ? '隐藏密钥' : '显示密钥';
    secret.textContent = visible ? entry.secret : maskSecret(entry.secret);
  });
  const copy = card.querySelector('.copy-button');
  copy.setAttribute('aria-label', `复制 ${entry.label} 的验证码`);
  copy.addEventListener('click', async () => {
    tick();
    try {
      await writeClipboard(readAccount(entry).code);
      notify(`已复制 ${entry.label} 的验证码`);
    } catch (error) { notify(error.message); }
  });
  const remove = card.querySelector('.remove-button');
  remove.setAttribute('aria-label', `移除 ${entry.label}`);
  remove.addEventListener('click', () => {
    const position = accounts.findIndex((account) => account.entry === entry);
    accounts = accounts.filter((account) => account.entry !== entry);
    card.remove();
    updateResultsStatus();
    (accounts[Math.min(position, accounts.length - 1)]?.card.querySelector('.remove-button') || input).focus();
    notify(`已移除 ${entry.label}`);
  });
  accounts.push({
    entry,
    card,
    token: card.querySelector('.token'),
    countdown: card.querySelector('.countdown'),
    counter: card.querySelector('.countdown span'),
  });
  list.append(card);
}

function renderErrors(errors) {
  parseErrors.replaceChildren();
  parseErrors.hidden = !errors.length;
  if (!errors.length) return;
  const heading = document.createElement('strong');
  heading.textContent = `${errors.length} 行未能识别，请检查后重新生成`;
  const messages = document.createElement('ul');
  for (const error of errors) {
    const item = document.createElement('li');
    item.textContent = `第 ${error.line} 行：${error.message}`;
    messages.append(item);
  }
  parseErrors.append(heading, messages);
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  try {
    const result = parseAccounts(input.value, {
      algorithm: $('#algorithm').value,
      digits: $('#digits').value,
      period: $('#period').value,
    });
    accounts = [];
    list.replaceChildren();
    result.entries.forEach(addAccount);
    renderErrors(result.errors);
    errorBox.hidden = true;
    input.removeAttribute('aria-invalid');
    updateResultsStatus();
    tick();
    notify(result.entries.length
      ? `已生成 ${result.entries.length} 个账户的验证码${result.errors.length ? `，${result.errors.length} 行需要检查` : ''}`
      : '未找到有效密钥，请检查输入内容');
  } catch (error) {
    errorBox.textContent = error.message;
    errorBox.hidden = false;
    input.setAttribute('aria-invalid', 'true');
    input.focus();
  }
});

input.addEventListener('input', updateInputCount);
input.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
    event.preventDefault();
    form.requestSubmit();
  }
});

$('#clear-button').addEventListener('click', () => {
  input.value = '';
  accounts = [];
  list.replaceChildren();
  renderErrors([]);
  updateResultsStatus();
  updateInputCount();
  notify('已清空输入和验证码');
  input.focus();
});

$('#demo-button').addEventListener('click', () => {
  input.value = 'otpauth://totp/示例账户:hello@example.com?secret=JBSWY3DPEHPK3PXP&issuer=示例账户\notpauth://totp/工作账户:work@example.com?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&issuer=工作账户';
  updateInputCount();
  input.focus();
  notify('已填入公开示例密钥，点击「获取验证码」体验');
});

copyAll.addEventListener('click', async () => {
  if (!accounts.length) return;
  const timestamp = Date.now();
  const content = accounts.map(({ entry }) => `${entry.label.replace(/[\r\n\t]/g, ' ')}\t${readAccount(entry, timestamp).code}`).join('\n');
  tick();
  try { await writeClipboard(content); notify('已复制全部账户名称和验证码'); }
  catch (error) { notify(error.message); }
});

const themeButton = $('#theme-button');
const systemTheme = matchMedia('(prefers-color-scheme: dark)');
let manualTheme = false;
function setTheme(dark) {
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  themeButton.setAttribute('aria-label', `切换到${dark ? '浅' : '深'}色模式`);
}
setTheme(systemTheme.matches);
themeButton.addEventListener('click', () => {
  manualTheme = true;
  setTheme(document.documentElement.dataset.theme !== 'dark');
});
systemTheme.addEventListener('change', (event) => { if (!manualTheme) setTheme(event.matches); });

// Recompute against the wall clock, including after tab suspension or system sleep.
let timer = setInterval(tick, 250);
document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
window.addEventListener('focus', tick);
window.addEventListener('pagehide', () => {
  clearInterval(timer);
  clearTimeout(toastTimeout);
  input.value = '';
  accounts = [];
  list.replaceChildren();
  renderErrors([]);
  updateInputCount();
  updateResultsStatus();
  toast.hidden = true;
});
window.addEventListener('pageshow', (event) => {
  if (event.persisted) { clearInterval(timer); timer = setInterval(tick, 250); tick(); }
});

// Avoid restoring secrets through form autofill/history restoration.
input.value = '';
updateInputCount();
updateResultsStatus();
