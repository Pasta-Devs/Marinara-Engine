# iOS / iPadOS PWA 指南

本指南介绍如何在 iPhone 或 iPad 上使用 Marinara Engine。iOS 和 iPadOS 自身跑不了 Marinara 服务器，所以要连到另一台设备上的服务器，再把它保存到主屏幕，当成网页应用来用。

## iOS 需要把服务器跑在别的设备上

Marinara Engine 由两部分组成：一个负责实际工作的服务器，以及一个在浏览器里打开的网页应用。在 iPhone 和 iPad 上，Apple 不允许服务器在本机运行。所以服务器要跑在别处，然后在 iPhone 或 iPad 的 Safari 里打开。

服务器可以跑在下面任何一种环境上：

- 一台 Windows 电脑（见 [Windows 安装指南](windows.md)）。
- 一台 Mac 或 Linux 机器（见 [macOS / Linux 安装指南](macos-linux.md)）。
- 一部装了 Termux 的 Android 手机（见 [Android (Termux) 安装指南](android-termux.md)）。
- 一个 Docker 或 Podman 容器（见[通过容器运行](containers.md)）。

iPhone 或 iPad 通过网络访问那台服务器。这和打开任何一个网站是一回事，只不过这个网站是自己的 Marinara 服务器。

## 从 Safari 连接

服务器在宿主设备上跑起来之后，按下面的步骤操作。

1. 确认宿主设备和 iPhone 或 iPad 处在同一个网络里，或者同时接入了同一个 Tailscale 网络。LAN 指的是本地网络，比如家里的 Wi-Fi。Tailscale 是一个免费工具，能通过互联网把设备连成一个私有网络。
2. 找到宿主服务器的地址，格式见下面的示例。把 `<host-ip>` 换成宿主设备的 LAN 或 Tailscale IP 地址。默认端口是 `7860`。

```
http://<host-ip>:7860
```

3. 在 iPhone 或 iPad 上打开 **Safari**。
4. 在 Safari 地址栏里输入这个地址并访问。
5. 浏览器里应该会加载出 Marinara 的主页。

如果页面打不开，或者弹出密码提示，参见下面的故障排查一节。网络访问权限和密码由服务器管理者控制，这些服务器设置写在[远程访问](../REMOTE_ACCESS.md)指南里，不在 iPhone 或 iPad 上。

## 添加到主屏幕

可以把 Marinara 保存成 PWA，这样打开起来就跟普通应用一样。PWA 是 Progressive Web App(渐进式网页应用) 的缩写，指在自己的窗口里运行、并且有独立主屏幕图标的网站。

1. 在 **Safari** 里打开自己的 Marinara 服务器（见上面的步骤）。
2. 点按分享按钮，就是那个带向上箭头的方块图标。
3. 在分享面板里向下滚动，点按 **Add to Home Screen**(添加到主屏幕)。
4. 需要的话改一下名字，然后点按 **Add**(添加)。
5. 这时主屏幕上应该出现了 Marinara 图标。

点按这个图标，Marinara 就会在独立窗口里打开，没有 Safari 的地址栏。

## 关于 HTTPS

PWA 在 HTTPS 下运行最稳定。HTTPS 指的是安全加密的网页连接，地址开头是 `https://`。

在局域网里用普通 HTTP 访问，Safari 日常使用也没问题。但某些 iOS 或 iPadOS 版本会限制普通 `http://` 地址下的独立 PWA 行为。遇到这种情况，就给 Marinara 配上 HTTPS。

Tailscale 会给每台设备分配一个固定的私有地址，可达性也更好，但光靠 Tailscale 并不能把 `http://` 地址变成 HTTPS。要用明确提供 HTTPS 的 Tailscale 方案，或者请服务器管理者把 Marinara 放到 HTTPS 后面。

这些做法在[远程访问](../REMOTE_ACCESS.md)指南里有说明。如果普通 HTTP 地址当作主屏幕应用老出问题，那就退一步，把它存成 Safari 书签。

## 清除并重装 PWA

有时候 Safari 一直显示旧版本的应用，或者保存下来的网页应用卡住不动。把主屏幕上的应用重装一遍，通常就能解决。

1. 按住主屏幕上的 Marinara 图标。
2. 点按移除或删除应用的选项，然后确认。
3. 在 iPhone 或 iPad 上打开 **Settings**(设置) 应用。
4. 点按 **Safari**。在较新的 iOS 和 iPadOS 版本里，它可能藏在 **Apps**(应用) 下面，再进 **Safari**。
5. 点按 **Advanced**(高级)，再点按 **Website Data**(网站数据)。
6. 找到自己 Marinara 宿主地址对应的条目。如果没看到，点按 **Show All Sites**(显示所有站点)。
7. 在那个条目上向左滑动，然后点按 **Delete**(删除)。这样就删掉了那台服务器留下的旧文件。
8. 按“从 Safari 连接”里的步骤，重新在 **Safari** 里打开 Marinara。
9. 按“添加到主屏幕”里的步骤，再把它添加到主屏幕。

聊天、角色和设置都存在服务器上，不在 iPhone 或 iPad 上。重装主屏幕应用不会把它们删掉。

## 故障排查

**Safari 里页面打不开。** 检查服务器在宿主设备上是否还在运行。检查两台设备是否处在同一个网络或同一个 Tailscale 网络里。确认 IP 地址和端口 `7860` 都填对了。需要更深入的网络排查，参见[远程访问](../REMOTE_ACCESS.md)指南和 [Marinara Engine 故障排查](../TROUBLESHOOTING.md)。

**Safari 要求输入用户名和密码。** 服务器管理者为远程设备开启了密码保护。找运行服务器的人要用户名和密码。设置方法在[远程访问](../REMOTE_ACCESS.md)指南里有介绍。

**Safari 一直显示旧版本。** 先刷新页面。如果还是旧的，按上面“清除并重装 PWA”的步骤操作。

**生成期间，主屏幕应用关闭或变成空白。** 重新打开并返回聊天即可，无须重启正常的服务器。浏览器断开后，自动聊天回复以及仅使用 Illustrator 的手动或重试图像请求仍会在服务器运行。重新打开的聊天会检查未完成工作，完成后刷新已保存消息和图库图片。**Stop**(停止) 仍可取消所选聊天的生成。如果空白屏幕反复出现，请报告 Support Diagnostics，并说明重新打开是否恢复聊天；此恢复机制并不能诊断或预防所有 iOS 浏览器故障。

**出现红色横幅，提示保存会静默失败。** 这是服务器发出的网络信任警告，不是 iPhone 或 iPad 的问题。需要服务器管理者把你的地址加入信任。参见[远程访问](../REMOTE_ACCESS.md)指南和 [Marinara Engine 故障排查](../TROUBLESHOOTING.md)。

**特权操作被拦住。** 有些维护操作需要服务器管理者提供的管理员密钥。在 iPhone 或 iPad 上，这个值保存在 **Settings**，然后 **Advanced**，再进 **Admin Access**(管理员访问)。[远程访问](../REMOTE_ACCESS.md)指南说明了管理员密钥是什么、怎么拿到。

## 相关指南

- [远程访问：Basic Auth 与 IP 允许列表](../REMOTE_ACCESS.md)
- [常见问题](../FAQ.md)
- [Marinara Engine 故障排查](../TROUBLESHOOTING.md)
- [Android (Termux) 安装指南](android-termux.md)
