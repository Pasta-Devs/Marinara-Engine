# iOS / iPadOS PWA 指南

在 iPhone 或 iPad 上使用 Marinara Engine。Apple 不允许 Marinara 服务器在这些设备上运行，所以要在 Safari 里打开运行在另一台设备上的服务器。然后可以把它作为 PWA 保存到主屏幕。PWA(Progressive Web App，渐进式网页应用) 是在自己的窗口里打开、用起来像应用的网站。

## 快速上手

1. 在电脑、家庭服务器或 Android 手机上安装并启动 Marinara(见下面的列表)，让它保持运行。
2. 在那台电脑上设置登录。见[远程访问](../REMOTE_ACCESS.md#option-1-login-recommended)。
3. 找到那台电脑的 IP 地址（见下文）。
4. 在 iPhone 或 iPad 上打开 **Safari**，访问 `http://` 加上那个 IP 地址再加 `:7860`。

不要在 iPhone 或 iPad 上用 `127.0.0.1`。这个地址指的是 iPhone 本身。

## 服务器运行在哪里

服务器可以运行在：

- Windows 电脑：[Windows 安装指南](windows.md)。
- Mac 或 Linux 电脑：[macOS / Linux 安装指南](macos-linux.md)。
- 装了 Termux 的 Android 手机：[Android (Termux) 安装指南](android-termux.md)。
- Docker 或 Podman 容器：[通过容器运行](containers.md)。

## 从 Safari 连接

开始之前：服务器必须正在运行，并且允许你的设备进入，通常要设置登录。见[远程访问](../REMOTE_ACCESS.md)。

1. 让服务器设备和 iPhone 或 iPad 连在同一个网络里，比如家里的 Wi-Fi。想从别处连接，就用 Tailscale，一个能通过互联网把设备连成私有网络的免费工具。
2. 找到服务器设备的 IP 地址。在服务器电脑的终端（输入命令的窗口）里运行一条命令，读出地址，它看起来像 `192.168.1.42`。

   - Windows(命令提示符)：`ipconfig`。读 **IPv4 Address**(IPv4 地址)。
   - Linux：`hostname -I`。
   - macOS：`ipconfig getifaddr en0`。

3. 打开 **Safari**，访问这个地址。把 `<host-ip>` 换成那个 IP 地址。默认端口是 `7860`。

```text
http://<host-ip>:7860
```

4. Marinara 的主页会加载出来。

如果看到登录页，就用服务器的用户名和密码登录。如果看到设置页，就输入服务器日志里的一次性设置码，并设定用户名和密码。见[远程访问](../REMOTE_ACCESS.md)。

如果没有成功：检查服务器是否还在运行，两台设备是否在同一个网络或同一个 Tailscale 网络里。检查 IP 地址和端口。见 [Marinara Engine 故障排查](../TROUBLESHOOTING.md)。

## 添加到主屏幕

1. 在 **Safari** 里打开你的 Marinara 服务器。
2. 点按分享按钮，就是那个带向上箭头的方块图标。
3. 在分享面板里向下滚动，点按 **Add to Home Screen**(添加到主屏幕)。
4. 需要的话改一下名字，然后点按 **Add**(添加)。

主屏幕上会出现 Marinara 图标。点按它，Marinara 就会在独立窗口里打开，没有 Safari 的地址栏。

## 应用不正常时改用 HTTPS

PWA 在 HTTPS 下运行最好。HTTPS 是一种安全连接，地址以 `https://` 开头。普通的 `http://` 地址在 Safari 里可以用，但某些 iOS 和 iPadOS 版本会限制普通 `http://` 地址下的主屏幕应用。遇到这种情况，就让 Marinara 通过 HTTPS 提供服务，或者把它留作 Safari 书签。

光靠 Tailscale 并不能让地址变成 HTTPS。要用能提供 HTTPS 的 Tailscale 设置，或者请服务器所有者把 Marinara 放到 HTTPS 后面。见[远程访问](../REMOTE_ACCESS.md#serving-over-https)。

<a id="clearing-and-reinstalling-the-pwa"></a>

## 清除并重装 PWA

Safari 有时会一直保留旧版本的应用，或者保存下来的应用卡住不动。重装一遍通常就能解决。聊天、角色和设置都存在服务器上，所以重装不会删掉它们。

1. 按住主屏幕上的 Marinara 图标。
2. 点按移除应用的选项，然后确认。
3. 在 iPhone 或 iPad 上打开 **Settings**(设置) 应用。
4. 点按 **Safari**。在较新的 iOS 和 iPadOS 版本里，它可能在 **Apps**(应用) 下面，再进 **Safari**。
5. 点按 **Advanced**(高级)，再点按 **Website Data**(网站数据)。
6. 找到你的 Marinara 地址对应的条目。如果没看到，点按 **Show All Sites**(显示所有站点)。
7. 在那个条目上向左滑动，然后点按 **Delete**(删除)。
8. 在 **Safari** 里重新打开 Marinara，按上面的步骤再次添加到主屏幕。

## 故障排查

**Safari 里页面打不开。** 检查服务器是否在运行，两台设备是否在同一个网络或同一个 Tailscale 网络里，以及 IP 地址和端口 `7860` 是否正确。见[远程访问](../REMOTE_ACCESS.md)和 [Marinara Engine 故障排查](../TROUBLESHOOTING.md)。

**更新后 Safari 显示登录页或设置页。**

- 在 `/login` 用服务器的用户名和密码登录。
- 如果还没有登录，就在设置页输入服务器日志里的一次性设置码。
- 如果服务器没有打印设置码，就在服务器设备上到 **Settings → Advanced → Access**(设置 → 高级 → 访问) 设置登录。
- 出现 **403** 可能是因为 iPhone 不在 `IP_ALLOWLIST` 里。这个列表由服务器所有者修改。
- PWA 无法重置服务器登录。服务器所有者需要在服务器上的 Marinara 文件夹里运行 `node scripts/reset-login.mjs`(在 Docker 里：`docker exec <container> node scripts/reset-login.mjs`)，或者修改 `.env` 里设置的登录。

见[更新后被锁在外面](../REMOTE_ACCESS.md#locked-out-after-updating)。

**Safari 一直显示旧版本。** 刷新页面。如果还是旧的，按上面的步骤重装 PWA。

**生成期间，主屏幕应用关闭或变成空白。** 重新打开并返回聊天即可。正常的服务器会继续工作：聊天回复和 Illustrator 的图像请求仍在服务器上运行，完成后，重新打开的聊天会刷新。**Stop**(停止) 仍可取消所选聊天里的生成。如果空白屏幕反复出现，请附上 Support Diagnostics(支持诊断信息) 报告这个问题。

**出现红色横幅，提示保存会静默失败。** 这是服务器发出的网络信任警告，不是 iPhone 或 iPad 的问题。需要服务器所有者信任你的地址。见[远程访问](../REMOTE_ACCESS.md#why-is-my-save-blocked-csrf)。

**高权限操作被拦住。** 有些维护操作需要服务器所有者提供的管理员密钥（第二个密码）。在 iPhone 或 iPad 上把它保存到 **Settings → Advanced → Admin Access**(设置 → 高级 → 管理员访问)。见[远程访问](../REMOTE_ACCESS.md#admin-access-and-privileged-actions)。

## 相关指南

- [远程访问：登录与 IP 允许列表](../REMOTE_ACCESS.md)
- [常见问题](../FAQ.md)
- [Marinara Engine 故障排查](../TROUBLESHOOTING.md)
- [Android (Termux) 安装指南](android-termux.md)
