---
author: ["Vivek Bhadauria"]
title: "Decoding Raydium Swaps"
date: 2021-06-17
tags: [Web3, DEX, Solana]
ShowToc: false
---

In this post, we are going to look into how raydium swap works using Serum CLOB (Central limit order book). Before diving into how swap works in raydium, let's have a brief look into **Solana blockchain** and **Serum DEX**.

## [Solana](https://solana.com/)
It's a layer 1 blockchain similar to ethereum but with improvements like supporting very high TPS, parallel smart contract runtime, etc. If you are interested in finding out what makes Solana great in comparison to other layer 1 solutions out there. Give [this](https://medium.com/solana-labs/7-innovations-that-make-solana-the-first-web-scale-blockchain-ddc50b1defda) post a read by Anatoly Yakovenko. 

## [Serum](https://dex.projectserum.com/)
Serum is a program deployed on the Solana blockchain which provides on-chain DEX trading functionalities. Serum is a complete permissionless on-chain DEX built on Solana. There is a great technical post by Serum team explaining how a order is placed using **Serum CLOB** 

Post link - <https://docs.google.com/document/d/1isGJES4jzQutI0GtQGuqtrBUqeHxl_xJNXdtOv4SdII/edit>


## [Raydium](https://dex.raydium.io/)
Raydium is another DEX on Solana. It provides trading along with other DeFi operations like LP (Liquidity provider), Farming, Staking, etc. 


Assuming you are aware of how an AMM (Automated Market Maker) works. If not, give a read to [this](https://academy.binance.com/en/articles/what-is-an-automated-market-maker-amm) post from binance academy. This should clarify what an AMM is and how it works.

## Brief overview of Raydium pools
You can have a look at Raydium Swap UI [here](https://raydium.io/swap/). Raydium pools also follow the constant product curve. Whenever you specify a pair of coins, if there exists a raydium pool for the pair, then swap goes through that raydium pool. For e.g - if you want to swap **_USDC_** to **_SOL_** and there is a raydium pool for **_USDC-SOL_**, then the swap goes through it.

If there is no pool, then the UI program looks for a serum market corresponding to the pair you selected, if a corresponding market is found then the swap goes through the **_Serum DEX_**, this is basically equivalent to placing order on the serum dex interface. 

If there is no serum market, then it shows as insufficient liquidity.

{{< figure src="/img/raydium_insufficient_liquidity.png" attr="Raydium Insufficient Liquidity" align=center alt="Raydium Insufficient Liquidity" >}}

{{< figure src="/img/raydium_pool_swap.png" attr="Raydium Pool Swap" align=center alt="Raydium Pool Swap" >}}

## Technical details
Let's take an example of **SOL -> USDC** swap and understand the process of swap.

> Mint address of SOL = “11111111111111111111111111111111”
> Mint address of USDC = “EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v”

AMM pool info of **SOL-USDC** pair
```
{
    name: 'SOL-USDC',
    coin: { ...NATIVE_SOL },
    pc: { ...TOKENS.USDC },
    lp: { ...LP_TOKENS['SOL-USDC-V4'] },

    version: 4,
    programId: LIQUIDITY_POOL_PROGRAM_ID_V4,

    ammId: '58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2',
    ammAuthority: '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1',
    ammOpenOrders: 'HRk9CMrpq7Jn9sh7mzxE8CChHG8dneX9p475QKz4Fsfc',
    ammTargetOrders: 'CZza3Ej4Mc58MnxWA385itCC9jCo3L1D7zc3LKy1bZMR',
    // no need
    ammQuantities: NATIVE_SOL.mintAddress,
    poolCoinTokenAccount: 'DQyrAcCrDXQ7NeoqGgDCZwBvWDcYmFCjSb9JtteuvPpz',
    poolPcTokenAccount: 'HLmqeL62xR1QoZ1HKKbXRrdN1p3phKpxRMb2VVopvBBz',
    poolWithdrawQueue: 'G7xeGGLevkRwB5f44QNgQtrPKBdMfkT6ZZwpS9xcC97n',
    poolTempLpTokenAccount: 'Awpt6N7ZYPBa4vG4BQNFhFxDj4sxExAA9rpBAoBw2uok',
    serumProgramId: SERUM_PROGRAM_ID_V3,
    serumMarket: '9wFFyRfZBsuAha4YcuxcXLKwMxJR43S7fPfQLusDBzvT',
    serumBids: '14ivtgssEBoBjuZJtSAPKYgpUK7DmnSwuPMqJoVTSgKJ',
    serumAsks: 'CEQdAFKdycHugujQg9k2wbmxjcpdYZyVLfV9WerTnafJ',
    serumEventQueue: '5KKsLVU6TcbVDK4BS6K1DGDxnh4Q9xjYJ8XaDCG5t8ht',
    serumCoinVaultAccount: '36c6YqAwyGKQG66XEp2dJc5JqjaBNv7sVghEtJv4c7u6',
    serumPcVaultAccount: '8CFo8bL8mZQK8abbFyypFMwEDd8tVJjHTTojMLgQTUSZ',
    serumVaultSigner: 'F8Vyqk3unwxkXukZFQeYyGmFfTG3CAX4v24iyrjEYBJV',
    official: true
  }
  ```
Pool info copied directly from <https://github.com/raydium-io/raydium-ui/blob/master/src/utils/pools.ts#L641>

Assuming the pool is **Token1-Token2**, you are doing a swap of some amount of Token1 to Token2. Token1 is **“From token”** and Token2 is **“To token”**.

Basically, a swap transaction is created by using the following details directly or indirectly:
- Pair of coins to swap
- Mint address of those coins
- Associated account address for those coins (Token1 and Token2 associated token accounts)
- Pool info
- Amount of Token1 you want to swap
- Private key of the owner account (This is basically the account which you are using for Swap)
- Slippage percentage

You can do a code walk of `swap()` function from raydium-ui repo to go through the exact code flow for the swap. Here I have pointed to a few code pointers which you can refer to dive deep.

Click [here](https://github.com/raydium-io/raydium-ui/blob/4c1c46bc70b9b8962900d1a0745019c34c588009/src/utils/swap.ts#L285) for `Swap()` function of raydium-UI repo.

For our example of SOL-USDC swap, you can have a look at the example transaction that I did. 

Transaction explorer link - <https://solscan.io/tx/4qxFLdpUx4NY4ehF6JC5v4DdZYcQum5j2JLo5zfxesofX9TS6b82sPCyShQ52ARYhs1nkQUJTQbrsrpqcUjdUY41>

This UI pretty much lists all instructions used in the swap transaction.

We created a project on similar lines for the Solana Seaszn hackathon. We basically created a simple mobile app that takes a pair of coins to swap and swaps using Raydium Pools. Attaching the video demo of the project.

{{< youtube gwTP-uugUa8 >}}

## Conclusion
Raydium pools source code is still closed. So we can't know for sure how the pools maintain its constant curve state. After reading through the raydium litepaper, it looks like raydium pools maintain their price invariant curve by placing order on serum DEX orderbooks to adjust its curve. General solution to maintain pool state is through arbitrage. Arbitrage plays an important role in bringing different markets to common prices.

MobileDEX app is my first project in this domain. You can read the raydium litepaper [here](https://raydium.io/Raydium-Litepaper.pdf) and if you have some ideas on how pool state is maintained, feel free to comment. Will be happy to enhance the post content.

## References
- <https://github.com/raydium-io/raydium-ui>
- <https://github.com/project-serum/serum-dex>
- <https://github.com/skynetcapital/solanaj>
