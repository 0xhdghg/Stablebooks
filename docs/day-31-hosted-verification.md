# Stablebooks Day 31 Hosted Verification

## Runtime

- API: `https://stablebooks-api-production.up.railway.app`
- Web: `https://stablebooks-web-production.up.railway.app`
- Environment: Railway `production`
- Date: `2026-04-25`

## Checks

Liveness:

```text
GET /api/v1/health/live -> ok
```

Arc readiness:

```text
GET /api/v1/arc/dev/readiness -> ready
sourceKind -> rpc_polling
missing -> []
```

Arc polling configuration:

```text
ARC_CHAIN_ID=5042002
ARC_SOURCE_KIND=rpc_polling
ARC_RPC_URL configured
ARC_START_BLOCK configured from a future block at enable time
ARC_CONFIRMATIONS_REQUIRED=1
ARC_EVENT_CONTRACT_ADDRESS=0x1800000000000000000000000000000000000000
ARC_EVENT_SIGNATURE=ArcNativeUSDCTransfer(address,address,uint256)
ARC_EVENT_TOKEN_SYMBOL=USDC
ARC_EVENT_TOKEN_DECIMALS=18
```

Log check:

```text
Railway warning logs after enabling the guarded forwarder: none observed
```

## Notes

Circle Contract monitoring remains useful for contract dashboards, but the MVP
no longer depends on Circle delivering native Arc system logs. The hosted API
now has a direct Arc RPC fallback for the native USDC transfer event shape.
