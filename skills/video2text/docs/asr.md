# 语音识别选型

转写准确率取决于三层：**模型**、**术语/上下文**、**后处理**。只换模型不够，只做后处理也救不回听错的音。

## 一、模型：中文别用 Whisper 打主力

FireRedASR（小红书开源）README 里的公开基准，CER%（越低越好）：

| 模型 | 参数量 | aishell1 | aishell2 | ws_net | ws_meeting | 平均 |
|---|---|---|---|---|---|---|
| FireRedASR-LLM | 8.3B | 0.76 | 2.15 | 4.60 | 4.67 | **3.05** |
| FireRedASR-AED | 1.1B | 0.55 | 2.52 | 4.88 | 4.76 | **3.18** |
| Seed-ASR | 12B+ | 0.68 | 2.27 | 4.66 | 5.69 | 3.33 |
| SenseVoice-L | 1.6B | 2.09 | 3.04 | 6.01 | 6.73 | 4.47 |
| Paraformer-Large | 0.2B | 1.68 | 2.85 | 6.74 | 6.97 | 4.56 |
| Whisper-Large-v3 | 1.6B | 5.14 | 4.96 | 10.48 | 18.87 | **9.86** |

Whisper 在中文上的 CER 是专用模型的两三倍，原因是它的中文训练数据占比低、标点与断句靠猜。`turbo` 还是蒸馏版，比 `large-v3` 再弱一档。

### 本机可落地的排序

| 方案 | 中文准确率 | 速度（M 系列） | 成本 | 备注 |
|---|---|---|---|---|
| **FireRedASR-AED-L**（1.1B） | 最高 | 慢（CPU/MPS 可用，需 PyTorch） | 本地免费 | 需单独环境；长音频要自己切段 |
| **SenseVoice-L / Paraformer-Large**（FunASR） | 高 | 快 | 本地免费 | 自带标点与 VAD，热词支持好 |
| **mlx-whisper large-v3** | 中 | 快 | 本地免费 | 开箱即用，多语种混合场景稳 |
| mlx-whisper large-v3-**turbo** | 中偏低 | 最快 | 本地免费 | 当前默认；追求准确率应换 large-v3 |
| **Qwen3-ASR-Flash**（阿里云 API） | 很高 | 取决于网络 | 按量计费 | 零部署；支持上下文/热词 |
| 双模型交叉校验 | 最高（人工成本高） | 2× | 2× | 只对关键片段做 diff |

推荐组合：

- **日常**：mlx-whisper `large-v3`（不是 turbo）+ 术语表。
- **中文长视频/要发稿**：FunASR（Paraformer 或 SenseVoice-L）+ 热词，或 FireRedASR-AED。
- **不想折腾**：Qwen3-ASR-Flash API。

## 二、术语与上下文：把「猜」变成「知道」

同音错字靠模型本身无解，必须给上下文：

- **视频标题/简介/话题**：里面通常就有正确写法（`#DeepSeek`、`Remotion`、`Codex`）。
- **术语表**：`--glossary "Codex,Claude,Remotion,Astro"` 同时用于 ASR 后处理与 LLM 纠错。
- **热词偏置**：FunASR 原生支持热词；Whisper 的 `initial_prompt` 实测会导致开头整段被跳过，**不要用**，改用 `--fix` 做确定性替换。

实测案例：`扣带死` → 正确是 **Codex**（不是 Claude）。仅凭读音无法判断，但视频标题里有 `Claude`、正文又提到 `Codex`，上下文一给就能定。

## 三、后处理：LLM 只做「编辑」，不做「听写」

`--polish` 会把标题、简介、术语表和正文一起交给 LLM，要求：

1. 修正同音错字与专有名词，不确定的标 `[?]`；
2. 去口头禅、补标点、分段；
3. **不扩写、不编造**。

没有 API key 时，脚本会写出一份 `<标题>.prompt.md`，可以手动贴给任意模型。

> 不要让 LLM 直接「根据大意重写」——那会产出看似通顺、实则改内容的稿子。必须保留原文约束。

## 四、实测：云端 Omni 模型 vs 本地 Whisper

同一段 60 秒中文旁白（含人名、书名、专有名词）：

| 词 | Whisper large-v3-turbo | Qwen3-Omni（云端） |
|---|---|---|
| 飘扬 | 飘航 ❌ | 飘扬 ✅ |
| 声嘶力竭 | 生死历劫 ❌ | 声嘶力竭 ✅ |
| 日耳曼民族 | 日曼民族 ❌ | 日耳曼民族 ✅ |
| 东正教的牧首 | 东中央的牧手 ❌ | 东正教的牧首 ✅ |
| 茨威格 / 《昨日的世界》 | 茨维格 ❌ | 茨威格 ✅ |
| 标点 | 无 | 引号、书名号、句读齐全 ✅ |

速度：60 秒音频约 10 秒；4 分钟音频切片后约 41 秒（≈6× 实时）。结论：**中文场景优先走云端 Omni，本地 Whisper 只做离线兜底**。

## 五、云端 ASR 接入

`--backend api` 走云端转写，配置写在固定文件：

```json
{
  "asr_provider": "qwen",
  "asr_api_key": "sk-...",
  "asr_base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
  "asr_model": "qwen3-asr-flash"
}
```

- `provider=qwen`：调用 Qwen3-ASR-Flash 的 OpenAI 兼容接口（`/chat/completions` + `input_audio`，base64 内联）；
- `provider=omni`：同样走 `/chat/completions`，但额外给一句「逐字转写、保留标点」的指令；适配中转站里的 `qwen3-omni-flash` / `qwen3.5-omni-flash`；
- `provider=openai`：调用标准 `/audio/transcriptions`，可用 whisper-1 或任何兼容服务。

中转站（OpenAI 兼容）配置示例：

```json
{
  "asr_provider": "omni",
  "asr_api_key": "sk-...",
  "asr_base_url": "https://openapi.flowhub.com.cn/v1",
  "asr_model": "qwen3-omni-flash"
}
```

注意：中转站的 `/v1/models` 不一定列出 ASR 模型，但 chat + `input_audio` 可用；`/audio/transcriptions` 可能未开通（会返回「模型未定价」或超时）。

超过 120 秒的音频会自动切片并按时序拼接（时间戳精度降到分片级）。密钥申请：<https://bailian.console.aliyun.com/>。

## 五、LLM 纠错交给 agent

不需要给 skill 配 LLM key。`--polish` 只把「标题 + 简介 + 术语表 + 正文」拼成 prompt 写成 `<标题>.prompt.md`，由当前 agent 直接改稿；agent 有编辑能力，链路更短，也不会把整篇稿子发到第三方。

## 六、参考

- FireRedASR（小红书，SOTA 中文 ASR）：<https://github.com/FireRedTeam/FireRedASR>
- FireRedASR2S（ASR + VAD + LID + Punc 一体）：同仓库 README
- FunAudioLLM / SenseVoice：<https://github.com/FunAudioLLM/SenseVoice>
- FunASR（Paraformer、热词、标点）：<https://github.com/modelscope/FunASR>
- Qwen3-ASR-Flash：<https://help.aliyun.com/zh/model-studio/>
- Whisper / mlx-whisper：<https://github.com/openai/whisper>、<https://github.com/ml-explore/mlx-examples>
