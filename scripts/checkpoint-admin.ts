// Small helpers for the checkpoint contract. Keys come from the environment and are never printed.
//   npx tsx scripts/checkpoint-admin.ts new-wallet                          make a fresh publisher wallet
//   OWNER_KEY=0x… npx tsx scripts/checkpoint-admin.ts transfer 0xNewOwner   hand ownership to it
//   npx tsx scripts/checkpoint-admin.ts status [0xAddress]                  owner, latest checkpoint and the wallet's balance
import { Contract, JsonRpcProvider, Network, Wallet, formatEther } from "ethers";

const RPC = process.env.EVM_RPC ?? "https://test-evm-rpc-v3.portaldot.dev";
const ADDRESS = process.env.CHECKPOINT_CONTRACT ?? "0x4DF57190DEbe09D922D1AfE9458AfF439bcd2Cb1";
const network = Network.from(420420777);
const provider = new JsonRpcProvider(RPC, network, { staticNetwork: network });
const ABI = [
  "function owner() view returns (address)",
  "function count() view returns (uint256)",
  "function latest() view returns (uint256, bytes32)",
  "function transferOwnership(address newOwner)",
];

async function main() {
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === "new-wallet") {
    const w = Wallet.createRandom();
    console.log(`address:     ${w.address}`);
    console.log(`private key: ${w.privateKey}`);
    console.log("\nSave the key somewhere safe and put it ONLY in the CHECKPOINT_PRIVATE_KEY secret on Render. Never commit it.");
    console.log("Next: fund this address with a little tPOT for gas, then run the transfer command.");
  } else if (cmd === "transfer") {
    if (!process.env.OWNER_KEY || !arg) throw new Error("Usage: OWNER_KEY=0x… npx tsx scripts/checkpoint-admin.ts transfer 0xNewOwner");
    const c = new Contract(ADDRESS, ABI, new Wallet(process.env.OWNER_KEY, provider));
    const tx = await c.transferOwnership(arg);
    console.log(`sent ${tx.hash}`); await tx.wait(1, 180_000);
    console.log(`ownership is now ${await c.owner()}`);
  } else if (cmd === "status") {
    const c = new Contract(ADDRESS, ABI, provider);
    const [b, h] = await c.latest();
    const owner = await c.owner();
    console.log(`contract: ${ADDRESS}\nowner:    ${owner}  (balance ${formatEther(await provider.getBalance(owner))} tPOT)\ncount:    ${await c.count()}\nlatest:   block ${b} hash ${h}`);
    if (arg) console.log(`${arg} balance: ${formatEther(await provider.getBalance(arg))} tPOT`);
  } else {
    console.log("Commands: new-wallet | transfer <newOwner> | status [address]");
  }
}
main().catch((e) => { console.error(String(e?.shortMessage ?? e?.message ?? e)); process.exit(1); });
