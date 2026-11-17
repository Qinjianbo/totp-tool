# 2FA 验证器

中文 TOTP 动态验证码工具。原生 HTML / CSS / JavaScript，使用固定版本的 OTPAuth 9.6.0，运行时无需后端或第三方 CDN。

## 本地运行

需要 Node.js 20.19 或以上版本（建议 Node.js 22）。

```bash
npm install
npm run dev
```

打开 http://127.0.0.1:5173 。开发服务不带热更新，修改源文件后刷新页面即可。端口被占用时运行 `npm run dev -- --port 5174`。

## 功能

- 单个或批量生成验证码，每次最多 200 个账户；无效行单独报错。
- 按真实时间自动刷新；页面从后台或休眠恢复后立即同步。
- 单个复制、全部复制（账户名与验证码，以制表符分隔）、移除账户、清空。
- 密钥默认遮挡，可手动显示；深浅主题与手机屏幕适配。
- SHA1 / SHA256 / SHA512、6 / 8 位、1–300 秒周期。默认 SHA1 / 6 位 / 30 秒。
- 支持 Ctrl+Enter / Command+Enter 生成。

每行一种输入，可混合使用：

```text
JBSWY3DPEHPK3PXP
alice|密码|JBSWY3DPEHPK3PXP|邮箱|邮箱密码
otpauth://totp/Example:alice?secret=JBSWY3DPEHPK3PXP&issuer=Example
```

以上是公开示例密钥。账户组合格式只读取第 1 项名称和第 3 项密钥，不使用密码及邮箱字段。链接自身的 `algorithm`、`digits` 和 `period` 优先，缺省时使用 TOTP 默认值，不受页面高级设置影响；仅支持 TOTP，不支持 HOTP。

## 数据处理

计算发生在浏览器，密钥与输入不会上传，不使用 Cookie、localStorage 或 IndexedDB，不加载远程脚本、字体或统计服务。刷新、离开页面会清空页面数据；复制操作会按用户点击写入系统剪贴板。设备时间应保持准确。

## 验证与静态部署

```bash
npm test
npm run build
npm run preview
```

测试包含 RFC 6238 附录 B 的全部 18 个 SHA1 / SHA256 / SHA512 标准向量，分别核对 Node 和浏览器算法包，以及周期切换、前导零、格式解析和批量边界。

`dist/` 包含全部运行资源，可上传到 Nginx、Cloudflare Pages 或其他静态服务。支持部署于子目录。线上使用 HTTPS 以便浏览器正常提供复制功能。请通过 HTTP(S) 访问，直接双击 HTML 的 file:// 模式不受支持。内置 Node 服务仅用于开发和预览，默认只监听 127.0.0.1。

## 项目结构

```text
index.html             页面与账户卡片模板
src/main.js            页面状态、复制、主题与计时更新
src/totp.js            输入解析、TOTP 与计时逻辑
src/styles.css         桌面 / 手机 / 深色样式
scripts/serve.mjs      仅暴露白名单静态文件的本地服务
scripts/build.mjs      复制资源与依赖到 dist/
tests/totp.test.js     算法标准向量及输入边界测试
```

算法规范：[RFC 6238](https://www.rfc-editor.org/rfc/rfc6238.html)。依赖：[OTPAuth](https://github.com/hectorm/otpauth)（MIT）及其内置的 @noble/hashes（MIT）；构建保留第三方许可证。
