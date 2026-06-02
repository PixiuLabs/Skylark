# Kurento WebRTC Integration Guide

## 概述 (Overview)

本项目集成了 Kurento Media Server，实现基于 WebRTC 的 1v1 实时语音通话功能。当前实现采用混合模式：
1. **WebSocket**: 用于传输音频数据和对话消息，集成完整的 VAD-ASR-LLM-TTS 处理管道
2. **Kurento**: 用于建立 WebRTC 连接，提供实时音视频通信能力

本版本使用**原生 WebRTC API**实现，不再依赖 kurento-utils.js 库，提供更轻量、更可控的实现。

This project integrates Kurento Media Server to provide WebRTC-based 1v1 real-time voice communication. The current implementation uses a hybrid approach:
1. **WebSocket**: For audio data transmission and dialogue messages, integrating the complete VAD-ASR-LLM-TTS pipeline
2. **Kurento**: For establishing WebRTC connections and providing real-time audio/video communication capabilities

This version uses **native WebRTC API** and no longer depends on kurento-utils.js library, providing a lighter and more controllable implementation.

## 架构 (Architecture)

```
┌─────────────────────────────────────┐
│   Frontend (Browser)                │
│   - kurento-webrtc.js               │
│   - kurento-demo.html               │
└──────────────┬──────────────────────┘
               │ REST API
               ↓
┌─────────────────────────────────────┐
│   API Layer (RobotController)       │
│   - POST /api/webrtc/kurento/session│
│   - POST .../{id}/offer             │
│   - POST .../{id}/ice-candidate     │
│   - DELETE .../{id}                 │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│   Service Layer                      │
│   - WebRTCService                   │
│   - VADService / ASRService         │
│   - LLMService / TTSService         │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│   Infrastructure Layer               │
│   - KurentoClientAdapter            │
│   - WebRTCSession                   │
│   - AudioProcessor                  │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│   Kurento Media Server              │
│   ws://localhost:8888/kurento       │
└─────────────────────────────────────┘
```

## 前置条件 (Prerequisites)

### 1. 安装 Kurento Media Server

#### Docker 方式 (推荐)

```bash
# 拉取 Kurento Media Server 镜像
docker pull docker.1ms.run/kurento/kurento-media-server:6.18.0

# 运行 Kurento Media Server
docker run -d --name kms618 -p 8888:8888 -e KMS_MIN_PORT=45000 -e KMS_MAX_PORT=46000 -p 45000-46000:45000-46000/udp docker.1ms.run/kurento/kurento-media-server:6.18.0

# 查看日志
docker logs -f kms
```

#### Ubuntu/Debian 原生安装

```bash
# 添加 Kurento 仓库
sudo apt-get update
sudo apt-get install -y gnupg

DISTRO="focal"  # Ubuntu 20.04
echo "deb [arch=amd64] http://ubuntu.openvidu.io/${DISTRO} ${DISTRO} kms6" | \
  sudo tee /etc/apt/sources.list.d/kurento.list

wget -O - http://ubuntu.openvidu.io/kurento.gpg.key | sudo apt-key add -

# 安装 Kurento Media Server
sudo apt-get update
sudo apt-get install -y kurento-media-server

# 启动服务
sudo systemctl start kurento-media-server
sudo systemctl enable kurento-media-server

# 查看状态
sudo systemctl status kurento-media-server
```

### 2. 验证 Kurento 运行状态

```bash
# 检查 WebSocket 端口
netstat -tulpn | grep 8888

# 或使用 wscat 测试连接
npm install -g wscat
wscat -c ws://localhost:8888/kurento
```

## 配置 (Configuration)

### application.yaml

```yaml
# Kurento Configuration
kurento:
  ws:
    uri: ws://localhost:8888/kurento

# WebRTC Configuration
webrtc:
  stun:
    server: stun:stun.l.google.com:19302
  turn:
    server: ""          # 可选：配置 TURN 服务器
    username: ""
    password: ""
```

## API 文档 (API Documentation)

### 1. 创建 WebRTC 会话
**POST** `/api/webrtc/kurento/session`

**Request Body:**
```json
{
  "userId": "user-123456"
}
```

**Response:**
```json
{
  "sessionId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "created",
  "message": "Kurento WebRTC session created successfully"
}
```

### 2. 处理 SDP Offer
**POST** `/api/webrtc/kurento/session/{sessionId}/offer`

**Request Body:**
```json
{
  "sdpOffer": "v=0\r\no=- 123456789 2 IN IP4 127.0.0.1\r\n..."
}
```

**Response:**
```json
{
  "sdpAnswer": "v=0\r\no=- 987654321 2 IN IP4 127.0.0.1\r\n..."
}
```

### 3. 添加 ICE Candidate
**POST** `/api/webrtc/kurento/session/{sessionId}/ice-candidate`

**Request Body:**
```json
{
  "candidate": "candidate:1 1 UDP 2130706431 192.168.1.100 54321 typ host",
  "sdpMid": "audio",
  "sdpMLineIndex": 0
}
```

**Response:** `200 OK`

### 4. 关闭会话
**DELETE** `/api/webrtc/kurento/session/{sessionId}`

**Response:** `200 OK`

## 当前实现状态 (Current Implementation Status)

### 已实现功能
- ✅ Kurento WebRTC 连接建立和管理
- ✅ WebSocket 连接和消息处理
- ✅ 音频数据采集和 WebSocket 发送
- ✅ ASR、LLM、TTS 响应显示和播放
- ✅ 完整的对话 UI 界面

### 技术架构
```
Browser
├── kurento-webrtc.js  (Kurento WebRTC 连接)
└── WebSocket          (音频/消息传输)
    ↓
Backend
├── WebRTCSignalingHandler  (处理 WebSocket 消息)
├── OrchestrationService    (VAD-ASR-LLM-TTS 管道)
└── RobotController         (处理 Kurento 会话)
    ↓
Kurento Media Server
```

## 使用方法 (Usage)

### 1. 启动后端服务

```bash
cd /path/to/Skylark
mvn spring-boot:run
```

### 2. 启动 Kurento Media Server

```bash
# Docker 方式
docker run -d --name kms618 -p 8888:8888 -e KMS_MIN_PORT=45000 -e KMS_MAX_PORT=46000 -p 45000-46000:45000-46000/udp docker.1ms.run/kurento/kurento-media-server:6.18.0
```

### 3. 访问演示页面

打开浏览器访问：
```
http://localhost:8080/kurento-demo.html
```

### 4. 开始对话

1. 等待 WebSocket 自动连接（页面会显示连接状态）
2. 点击"📞 开始对话"按钮
3. 允许浏览器访问麦克风
4. 开始语音交互（音频同时通过 WebSocket 发送处理和通过 Kurento WebRTC 传输）
5. 查看识别文本、LLM 回复，收听 TTS 语音
6. 点击"⏸️ 结束对话"停止

### 文件结构

```
web/
├── kurento-demo.html     # 演示页面，包含完整的 UI 和交互逻辑
└── js/
    └── kurento-webrtc.js # Kurento WebRTC 客户端库（原生实现）
```

### 音频处理流程

1. **本地音频采集**: 浏览器通过 `getUserMedia` 采集麦克风音频
2. **双通道处理**:
   - **WebRTC 通道**: 通过 Kurento WebRTC 连接传输到媒体服务器
   - **WebSocket 通道**: 通过 `ScriptProcessorNode` 采集音频数据，转换为 PCM 格式发送到后端
3. **VAD-ASR-LLM-TTS 处理**: 后端处理音频并返回结果
4. **TTS 播放**: 页面接收 TTS 音频并通过 Audio 对象播放

## 前端集成 (Frontend Integration)

### 使用 KurentoWebRTCClient

```javascript
// 创建客户端实例
const client = new KurentoWebRTCClient();

// 设置状态回调
client.setStatusCallback((state, text) => {
    console.log(`Status: ${state} - ${text}`);
});

// 设置消息回调
client.setMessageCallback((type, data) => {
    console.log(`Message: ${type}`, data);
});

// 设置连接状态回调（可选）
client.setConnectionStateCallback((state) => {
    console.log(`ICE Connection State: ${state}`);
});

// 启动会话
await client.start();

// 检查会话是否活动
if (client.isActive()) {
    console.log('Session is active');
}

// 停止会话
await client.stop();
```

### KurentoWebRTCClient API

#### 构造函数
```javascript
new KurentoWebRTCClient()
```
创建新的 Kurento WebRTC 客户端实例。

#### 方法

##### `setStatusCallback(callback)`
设置状态更新回调
- **参数**: `callback(state, text)` - 回调函数，接收状态和文本信息

##### `setMessageCallback(callback)`
设置消息接收回调
- **参数**: `callback(type, data)` - 回调函数，接收消息类型和数据

##### `setConnectionStateCallback(callback)`
设置 ICE 连接状态变更回调（可选）
- **参数**: `callback(state)` - 回调函数，接收连接状态

##### `async start()`
启动 WebRTC 会话
- **返回**: Promise，在会话建立完成后 resolve
- **抛出**: 如果建立失败则抛出异常

##### `async stop()`
停止 WebRTC 会话
- **返回**: Promise，在会话关闭后 resolve

##### `isActive()`
检查会话是否活动
- **返回**: boolean - 会话是否处于活动状态

##### `cleanup()`
清理所有 WebRTC 资源（内部使用）

## SDP 处理兼容性说明

本实现包含一系列 SDP 处理逻辑，确保与 Kurento 6.x 兼容：

1. **音频-only SDP 提取**: 自动移除视频媒体行，只保留音频
2. **BUNDLE 移除**: 移除 `a=group:BUNDLE` 属性，Kurento 6.x 可能拒绝此类 SDP
3. **编解码器简化**: 只保留 Opus (111) 和 PCMU (0) 编解码器，减少兼容性问题
4. **MID 对齐**: 调整 answer SDP 的 mid 属性以匹配 offer
5. **SDP 标准化**: 处理换行符和尾随空行

这些处理逻辑是为了解决 Kurento 6.x 与现代浏览器 WebRTC 实现之间的兼容性问题。

## 故障排除 (Troubleshooting)

### Kurento 连接失败

**问题:** 无法连接到 Kurento Media Server

**解决方案:**
1. 检查 Kurento 是否运行：
   ```bash
   docker ps | grep kms
   # 或
   systemctl status kurento-media-server
   ```

2. 检查端口是否开放：
   ```bash
   telnet localhost 8888
   ```

3. 查看 Kurento 日志：
   ```bash
   docker logs -f kms
   # 或
   sudo journalctl -u kurento-media-server -f
   ```

### WebRTC 连接失败

**问题:** SDP 协商失败或 ICE 连接失败

**解决方案:**
1. 检查防火墙设置，确保 UDP 端口 40000-57000 开放
2. 配置 STUN/TURN 服务器（在 NAT 环境中必需）
3. 检查浏览器控制台的 WebRTC 错误信息

### 音频质量问题

**问题:** 音频延迟或质量差

**解决方案:**
1. 检查网络带宽和延迟
2. 调整音频编解码器设置
3. 优化 Kurento Media Server 配置

## 性能优化 (Performance Tuning)

### Kurento Media Server 配置

编辑 `/etc/kurento/kurento.conf.json`:

```json
{
  "mediaServer": {
    "resources": {
      "garbageCollectorPeriod": 240,
      "disableRequestCache": false
    },
    "net": {
      "websocket": {
        "port": 8888,
        "path": "kurento",
        "threads": 10
      }
    }
  }
}
```

### JVM 参数调优

```bash
export JAVA_OPTS="-Xmx2G -Xms1G -XX:+UseG1GC"
mvn spring-boot:run
```

## 安全注意事项 (Security Considerations)

1. **生产环境配置:**
   - 使用 HTTPS/WSS 加密通信
   - 配置 TURN 服务器的身份验证
   - 限制 CORS 源

2. **防火墙规则:**
   - 仅开放必要的端口
   - 使用安全组限制访问

3. **会话管理:**
   - 实现会话超时机制
   - 定期清理过期会话

## 监控和日志 (Monitoring and Logging)

### 应用日志

```yaml
# application.yaml
logging:
  level:
    org.skylark.infrastructure.adapter.webrtc: DEBUG
    org.skylark.application.service.WebRTCService: DEBUG
```

### Kurento 日志

```bash
# 查看 Kurento 日志
sudo tail -f /var/log/kurento-media-server/media-server.log
```

## 参考资料 (References)

- [Kurento 官方文档](https://doc-kurento.readthedocs.io/)
- [WebRTC 规范](https://www.w3.org/TR/webrtc/)
- [Kurento GitHub](https://github.com/Kurento)
- [Spring Boot WebRTC](https://spring.io/guides/gs/messaging-stomp-websocket/)
- [LiveKit 官方文档](https://docs.livekit.io/) — 云雀同时支持 LiveKit 作为替代 WebRTC 方案
- [WebRTC 双框架技术博客](./WEBRTC_FRAMEWORKS_BLOG.md) — Kurento + LiveKit 双框架技术分析

## 相关方案 (Alternative Solutions)

云雀通过可插拔的 `WebRTCChannelStrategy` 策略模式，支持多种 WebRTC 方案：

| 策略 | 配置值 | 说明 |
|------|--------|------|
| WebSocket | `websocket` | 基于 WebSocket 的基础方案 |
| **Kurento** | `kurento` | **本文档描述的专业媒体服务器方案** |
| LiveKit | `livekit` | 云原生实时通信方案 |

切换方式：修改 `application.yaml` 中的 `webrtc.strategy` 配置项。

## 许可证 (License)

本项目遵循与主项目相同的许可证。

---

**注意:** Kurento Media Server 需要独立运行，不包含在本项目中。请确保在使用前正确安装和配置 Kurento。
