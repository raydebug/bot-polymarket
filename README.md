# Polymarket 低价扫货机器人（复刻版）

这个项目复刻你图里的核心逻辑:
- 不做预测
- 不做分析
- 只扫价格低于阈值（默认 5 美分）的 outcome
- 自动分批买入（默认纸面交易）

## 1. 快速开始

```bash
cp .env.example .env
npm run scan
```

或持续运行:

```bash
npm start
```

## 2. 策略参数（`.env`）

- `MAX_PRICE=0.05`: 最大买入价（5 美分）
- `MIN_PRICE=0.005`: 最小买入价（过滤极端脏数据）
- `MIN_DAYS_TO_END=0`: 距离市场结束最少天数
- `MAX_DAYS_TO_END=365`: 距离市场结束最多天数
- `INCLUDE_KEYWORDS=`: 关键词白名单（逗号分隔）
- `EXCLUDE_KEYWORDS=`: 关键词黑名单（逗号分隔）
- `ORDER_FRACTION=0.001`: 每笔金额 = 账户总额 * 该比例（即 1/1000）
- `PAPER_ACCOUNT_USD=10000`: 仅 paper 模式使用；live 模式始终读取真实账户总额
- `MAX_ORDERS_PER_SCAN=10`: 每轮最多买入笔数
- `MAX_EXPOSURE_USD=500`: 总投入上限（风控）
- `MAX_EXPOSURE_PER_MARKET_USD=100`: 单市场投入上限
- `MIN_LIQUIDITY=500`: 只做最低流动性以上市场
- `ALLOW_REPEAT_BUYS=false`: 同一 token 是否允许重复加仓
- `GAMMA_PAGE_SIZE=50`: 行情分页大小（建议 50，避免响应过大）
- `GAMMA_TRANSPORT=auto`: 行情拉取通道（`auto`/`fetch`/`curl`）
- `GAMMA_CURL_PROXY=`: 仅 `curl` 通道使用的代理地址（如 `http://127.0.0.1:7890`）

## 3. 数据与账本

- 状态文件: `data/paper-state.json`
- 记录内容:
  - 每笔模拟成交
  - 持仓均价和数量
  - 当前 mark-to-market 浮盈亏

## 4. 运行模式

- `BOT_MODE=paper`（默认）: 真正可跑，做纸面交易
- `BOT_MODE=live`: 实盘签名下单模式（需要 CLOB 依赖 + 私钥配置）

### live 模式准备

1. 安装依赖:
```bash
npm i @polymarket/clob-client ethers
```
2. 在 `.env` 填:
```bash
BOT_MODE=live
POLYMARKET_PRIVATE_KEY=0x...
POLYMARKET_FUNDER=0x...
```
3. 启动:
```bash
npm start
```

> 注意: live 模式会真实发单。建议先把 `ORDER_FRACTION` 设得更小（如 `0.0002`），并先跑几轮 `paper` 验证过滤条件。

## 5. 风险提示

该策略本质是“超低价尾部事件采样”，收益分布极端偏态，长期表现高度依赖市场结构变化和手续费/滑点。请先长期 paper，再考虑小额实盘。

## 6. 行情 API 网络排查

如果你本机 `curl` 能通但 `node` 里 `fetch` 不通，可直接改:

```env
GAMMA_TRANSPORT=curl
```

如果还需要代理:

```env
GAMMA_TRANSPORT=curl
GAMMA_CURL_PROXY=http://127.0.0.1:7890
```
