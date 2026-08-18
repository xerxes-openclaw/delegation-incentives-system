import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { createConfig } from "ponder";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const erc20MultiDelegateAbi = [
  {
    type: "event",
    name: "ProxyDeployed",
    inputs: [
      { name: "delegate", type: "address", indexed: true },
      { name: "proxyAddress", type: "address", indexed: false },
    ],
  },
  {
    type: "event",
    name: "DelegationProcessed",
    inputs: [
      { name: "owner", type: "address", indexed: true },
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "TransferSingle",
    inputs: [
      { name: "operator", type: "address", indexed: true },
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "id", type: "uint256", indexed: false },
      { name: "value", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "TransferBatch",
    inputs: [
      { name: "operator", type: "address", indexed: true },
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "ids", type: "uint256[]", indexed: false },
      { name: "values", type: "uint256[]", indexed: false },
    ],
  },
] as const;

const hedgeyVestingAbi = [
  {
    type: "event",
    name: "PlanCreated",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "recipient", type: "address", indexed: true },
      { name: "token", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "start", type: "uint256", indexed: false },
      { name: "cliff", type: "uint256", indexed: false },
      { name: "end", type: "uint256", indexed: false },
      { name: "rate", type: "uint256", indexed: false },
      { name: "period", type: "uint256", indexed: false },
      { name: "vestingAdmin", type: "address", indexed: false },
      { name: "adminTransferOBO", type: "bool", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PlanRedeemed",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "amountRedeemed", type: "uint256", indexed: false },
      { name: "planRemainder", type: "uint256", indexed: false },
      { name: "resetDate", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
    ],
  },
] as const;

const ensTokenAbi = [
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "DelegateChanged",
    inputs: [
      { name: "delegator", type: "address", indexed: true },
      { name: "fromDelegate", type: "address", indexed: true },
      { name: "toDelegate", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "DelegateVotesChanged",
    inputs: [
      { name: "delegate", type: "address", indexed: true },
      { name: "previousBalance", type: "uint256", indexed: false },
      { name: "newBalance", type: "uint256", indexed: false },
    ],
  },
] as const;

const ensGovernorAbi = [
  {
    name: "ProposalCreated",
    type: "event",
    inputs: [
      { name: "proposalId", type: "uint256", indexed: false },
      { name: "proposer", type: "address", indexed: false },
      { name: "targets", type: "address[]", indexed: false },
      { name: "values", type: "uint256[]", indexed: false },
      { name: "signatures", type: "string[]", indexed: false },
      { name: "calldatas", type: "bytes[]", indexed: false },
      { name: "startBlock", type: "uint256", indexed: false },
      { name: "endBlock", type: "uint256", indexed: false },
      { name: "description", type: "string", indexed: false },
    ],
  },
  {
    name: "VoteCast",
    type: "event",
    inputs: [
      { name: "voter", type: "address", indexed: true },
      { name: "proposalId", type: "uint256", indexed: false },
      { name: "support", type: "uint8", indexed: false },
      { name: "weight", type: "uint256", indexed: false },
      { name: "reason", type: "string", indexed: false },
    ],
  },
  {
    name: "ProposalExecuted",
    type: "event",
    inputs: [{ name: "proposalId", type: "uint256", indexed: false }],
  },
  {
    name: "ProposalCanceled",
    type: "event",
    inputs: [{ name: "proposalId", type: "uint256", indexed: false }],
  },
  {
    name: "ProposalQueued",
    type: "event",
    inputs: [
      { name: "proposalId", type: "uint256", indexed: false },
      { name: "eta", type: "uint256", indexed: false },
    ],
  },
] as const;

// RPC_URL accepts a comma-separated list. Ponder spreads load across every
// entry and takes one out of rotation when it starts failing, so a second
// provider is the cheapest insurance against a single endpoint stalling the
// backfill ("All JSON-RPC providers are inactive").
const rpcUrls = (process.env.RPC_URL ?? "")
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean);

/**
 * Upper bound on the eth_getLogs window.
 *
 * Left undefined, Ponder widens the range and narrows it again by reading
 * provider *error messages*. That auto-tuning cannot see a timeout: a provider
 * that simply takes too long returns no "range too large" hint, so Ponder keeps
 * retrying the same oversized window. Ponder's request timeout is a hardcoded
 * 10s and is not configurable, so the window is the only lever.
 *
 * The ENS token's first months are the worst case — the airdrop makes Transfer
 * logs extremely dense — so the default is deliberately conservative. Once the
 * backfill is past 2022 you can raise it and restart; completed ranges are
 * cached in Postgres, so a restart resumes rather than re-fetching.
 */
const ethGetLogsBlockRange =
  Number(process.env.ETH_GET_LOGS_BLOCK_RANGE) || 1_000;

export default createConfig({
  chains: {
    mainnet: {
      id: 1,
      rpc: rpcUrls.length > 1 ? rpcUrls : rpcUrls[0],
      ethGetLogsBlockRange,
    },
  },
  contracts: {
    ERC20MultiDelegate: {
      chain: "mainnet",
      abi: erc20MultiDelegateAbi,
      address: "0x3CA5CCC96648d016D41c5aF40eED82202BD019cc",
      startBlock: 22140079,
    },
    HedgeyVesting: {
      chain: "mainnet",
      abi: hedgeyVestingAbi,
      address: "0x2CDE9919e81b20B4B33DD562a48a84b54C48F00C",
      startBlock: 18466404,
    },
    ENSToken: {
      chain: "mainnet",
      abi: ensTokenAbi,
      address: "0xC18360217D8F7Ab5e7c516566761Ea12Ce7F9D72",
      startBlock: 13533418,
    },
    ENSGovernor: {
      chain: "mainnet",
      abi: ensGovernorAbi,
      address: "0x323a76393544d5ecca80cd6ef2a560c6a395b7e3",
      startBlock: 13533772,
    },
  },
});
