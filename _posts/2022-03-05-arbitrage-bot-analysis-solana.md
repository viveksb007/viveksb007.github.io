---
layout: post
title: "Arbitrage Bot Analysis on Solana"
date: 2022-03-05
tags: [Web3, DeFi, DEX, Solana]
youtubeId: cizLhxSKrAc
comments: true
---

Recently, I came across bots doing arbitrage on Solana. Was reading about wormhole hack and how it created great opportunities for bots to make free money. Note that the wormhole hack was a long tail event. In general, arbitrage is a very competitive space and needs constant improvements in strategy.

[Misaka](https://twitter.com/0xMisaka) wrote a detailed analysis on bots which made money in the **"Golden 30 mins"** just after the hacker dumped stolen ETH into Solana AMM pools. Quoting from the post 
> There was $13 million arbitrage profit in 30 mins.

In this post, we are going to look at a few bots that made money that day and try to figure out how they work.

> Transaction fees on Solana => 0.000005 SOL, at time time of writing this post 1 SOL = 88$

Let's look at some basic terminology which will be used in later analysis

## Cyclic Arbitrage
Cyclic arbitrage is a trade combination in which you end up with the same currency with which you started. For example: you bought SOL with USDC from a pool and sold the same SOL in another pool for USDC such that you ended up with more USDC than you started with (This scenario is profitable cyclic arbitrage, you can also end up with same or less). Trade path => USDC -> SOL -> USDC.
## AMM Pools
Automated Market Makers (AMM) allows digital assets to be traded in permissionless manner by using liquidity pools. Liquidity pool is a smart contract in which people lock their tokens and get LP fees in return. That LP pool is used to facilitate trade in Decentralized exchange. Most of the AMM pools follow the CPMM (Constant Product Market Maker) curve.
CPMM curve is represented by function x*y = c, where x and y are assets in the pool and c is a constant. Refer [formal specification of CPMM](https://github.com/runtimeverification/verified-smart-contracts/blob/uniswap/uniswap/x-y-k.pdf) for more details.

Simple diagram that shows arbitrage between **USDC->SOL->USDC**

<img src="/assets/img/arbitrage_solana.png" alt="Arbitrage in Solana" style="display: block; margin-left: auto; margin-right: auto;"/>

## BOT 1
Program account - [MEV1HDn99aybER3U3oa9MySSXqoEZNDEQ4miAimTjaW](https://solscan.io/account/MEV1HDn99aybER3U3oa9MySSXqoEZNDEQ4miAimTjaW)
This is a program(Smart Contract) which is deployed on the Solana blockchain.

This program typically receives transactions from 2 accounts.
> Account 1 - Gv7oiSP2784zpapUDEgsXUmMW8Z62q465FVAeS4DVifE
  Account 2 - FDzoKvsArP2LjPYFrP6KNTxn45trxwpu5WMQUYu3kboR

### Account 1
[Gv7oiSP2784zpapUDEgsXUmMW8Z62q465FVAeS4DVifE](https://solscan.io/account/Gv7oiSP2784zpapUDEgsXUmMW8Z62q465FVAeS4DVifE)
The arb trade arising from this account comprises the base token as USDC. We can assume that some bot would be monitoring profitable cyclic arb opportunities starting from USDC and whenever found, makes the transaction using this account.
Sample trades:
- <https://solscan.io/tx/3xgDywnVQ6Np5YbUsk9Hpw4bjYt2erzPRZJiyg2fTdJeqG65PvXT7mShP5wFTWEyuCKzakRqK4SE1mJnrAcz2jbS>
This trade is b/w Serum DEX (USDC->SOL), Mercurial Stable Swap (SOL->mSOL) and Aldrin AMM (mSOL->USDC). 
- <https://solscan.io/tx/4tinkZ2v7wEFvB2k5uoJCq5GEVSSwKZ9GH9eGXVDqf85iFrxhqNNPYh6MzWDqSZorBNGLyoxvJc6gPzVyHrpv9mW>
This trade is b/w 3 pools of Orca. Pool_1 (USDC->wstETH), Pool_2(wstETH->stSOL), Pool_3(stSOL->USDC)

### Account 2
[FDzoKvsArP2LjPYFrP6KNTxn45trxwpu5WMQUYu3kboR](https://solscan.io/account/FDzoKvsArP2LjPYFrP6KNTxn45trxwpu5WMQUYu3kboR)
The arb trade arising from this account comprises the base token as SOL. 
Sample trades:
- <https://solscan.io/tx/2oFhx7h7YLLPNfvL49M8PXbhzkkHPAkvv8iWXzrcSy6mgtXct6cYhPeUSCWcyNbF7u766nmNYfvtCMvS7eEufWno>
This trade is b/w Mercurial Stable Swap (SOL->stSOL), Orca (stSOL->USDC) and Serum DEX (USDC->SOL).
- <https://solscan.io/tx/4EdhyYVp3WScQ9YNzrwosYjujQs2QuzwXJwkUKULyx9WCoXi3FzN5w9zHLzpkdNbNHMPxAXiY6qyimnbAearbeh8>
This trade is b/w Mercurial Stable Swap (SOL->mSOL), Orca (mSOL->ETH) and Serum DEX (ETH->SOL).

## BOT 2
Program account - [EwZxwieySEeMCCf5E2459CbQyEiAdMTH5ioz9F7VoZ7W](https://solscan.io/account/EwZxwieySEeMCCf5E2459CbQyEiAdMTH5ioz9F7VoZ7W)
This is similar to bot 1. A program deployed on blockchain does the arbitrage transaction. 
Sample trade:
- <https://solscan.io/tx/6389r5CLF5MzUrgvAdr72QikcZPLPnPRVHNrSpJjDLwVayVjyMC2fi3CFzjnKStwnLyf7KA2LFuNH5WTHiFQ3JNd>
This trade is between Raydium (USDC->AURY) and Orca (AURY->USDC). Have a look at program logs of the transaction, you can see `amount_in = “281593608”` and `amount_out = “288648732”`.

## BOT 3
Account - [Gn35xm6fr3ByUJt9aC6ZSzSqzb15AyryhKQmZVoP56Z1](https://solscan.io/account/Gn35xm6fr3ByUJt9aC6ZSzSqzb15AyryhKQmZVoP56Z1)
The transactions coming from this account interact with the Jupiter aggregator program with instructions. Instructions have route related info according to which the swap needs to be done. Refer [Jupiter Core](https://docs.jup.ag/jupiter-core/using-jupiter-core) to understand how to use Jupiter to swap across pools.
Sample trades:
- <https://solscan.io/tx/ryT51W4SAVA6xNZic1U3h6Dq83Bof2E4fzeFTeXiY2bEjvFpapbX2z3tR5MwLhtqXsLkYm4KKQXNESXEr444CPw>
This trade is using Jupiter aggregator which trades b/w Serum DEX (USDC->SOL) and Raydium (SOL->USDC).
- <https://solscan.io/tx/3w7DHoc3aVsp3J9wcavFEYBp3Rpg9WKjuzARZAXRQJgf6MDUzBWVAUNE4HToN5EgzAwkJ5Ni7bPaJnJJqXgudVZU>
This trade is using Jupiter aggregator which trades b/w Serum DEX (USDC->SOL) and Raydium (SOL->USDC).

## BOT 4
Account - [J3xKkSUowia5q483zwQmijSfnVocGsWg6duFzQYHL9Nn](https://solscan.io/account/J3xKkSUowia5q483zwQmijSfnVocGsWg6duFzQYHL9Nn)
This bot is similar to Bot 3 and calls the Jupiter aggregator program with instructions to swap.
Sample trades:
- <https://solscan.io/tx/4a54LJjZLiA1w27KzMY82AFNuJRevWDtTBPRsezTg2wD7KiJBmC5HYEdk94pZKnk69Yk86GprgEjXD5uS75JxRGT>
Using Jupiter trades b/w Serum DEX (USDC->SOL) and Lifinity Token Swap (SOL->USDC).
- <https://solscan.io/tx/4nSvRBbaiDkuKQGAw3vztVwgzVv1qmMFoo1XpV71tpUHR9KmhgxQCwNFCHhrBLqLMxqKNmh3TGMmqZkPPeoCBHLw>
Using Jupiter trades b/w Serum DEX (USDC->SOL) and Lifinity Token Swap (SOL->USDC).

## Other Bots
Attached below are the account addresses which [Misaka](https://twitter.com/0xMisaka) pointed out in the analysis. These are in text format, so you can copy and search on explorer easily.

>   Gn35xm6fr3ByUJt9aC6ZSzSqzb15AyryhKQmZVoP56Z1
    J3xKkSUowia5q483zwQmijSfnVocGsWg6duFzQYHL9Nn 
    7aMFk2CEo33Sb9R1a1W6q2HxZ1Z97hbLedDy3ZgHJ4i6 
    6tW8VxosufrSQBhADuGjjB45BKiMCFuYS63YR7LoizK7 
    EDMGEpKKGKS7nxpu1gjLmuHHWAmvLNy3BZWDxNC3nhAt 
    9uAxqcxgGSn9Sft9FmshVoM8CZjmtY5K8d2TSGb75bsn 
    44PJ3JyrkUvJPDrauYzNAyKV2CB4FHQLKdxf4xX9HyQu 
    Ai5ZrhuwvDiLubv7gNpVS1v9qrKo5kxfARZGtKagkvH9 
    FDzoKvsArP2LjPYFrP6KNTxn45trxwpu5WMQUYu3kboR 
    AasQTQH9oroodW5vi3uEoDuLyJDVfMz7GWehvisdGmDX 
    J82JTFdFq1frsS7xmvMbN9d7B4t5DSrGSYQqvexMyaNa 
    BFBvSCGA5i83oq9c2R4hGJ5DPcP1HLr8LiRVYvskhYRC 
    FhuJfyiM3hH32qA3NYz1NADnZhu3GzSw4pL1pcfFNW5Y 
    3pfNpRNu31FBzx84TnefG6iBkSqQxGtuL5G5v9aaxyv8 
    6hyuGqKQyhAEipjtaquiNHfd1dVjrNT3FzzanXurbK4W 
    Gv7oiSP2784zpapUDEgsXUmMW8Z62q465FVAeS4DVifE 
    4qfMyvVxAUMWLceyaiWrXxD9mXhZCZ32d16cArQ5MmfX 
    FrJZ4DP12Tg7r8rpjMqknkpCbJihqbEhfEBBQkpFimaS 
    EDEG8c7wqLkyvGVLzHmckZcUFUjxkcHCUvGo58CzH6QR 
    Fsb16JMXAWLML5PTLKVh5Lg1xviVB6ah5p7YYcJEw3g2 
    3b3zfYBQ61sEicY4bhQMKUvRo9bAxPYAz32uyAP9Cj9u 
    3heTLmaYyWpQhvfYztMWBhzB9wqRqVgZofYtdw8778gf 
    E6rRQBgWFxJZ1T6Rs66VwkArz6EeTqhX2ULEfCvSeb4o 
    Lion6QppZ6x5VZaawuYUxdhJ7T8J8Hjf56v.7B4G2EGh 
    A4gG7n7aFaBonYgggiF9Ubi4pNLwu4MCG8dWxSdwxUm5 
    BossNYX1ELRTYZmxb6h2086ktgrXTExdDymEDim65Nq3 
    CsBGFujsus6Q1K7Leu7tprZcVVMSRDCFH1L6mxGqME3k 
    BFWgBMPyYVT8.71E3HLytUKF9KBgBwBFjni92AiixPC7t 
    4nHVM1NF5LRptEZWiQn888za51r38dFAsZKCHkuyq1Fx 

## Misc
Bots on solana do a lot of transactions and most of them fail as they don’t end up with profit. They can afford it due to transaction fees being very less i.e **0.000005 SOL**. New folks can enter the arb scenario to test the waters as transaction fees are very less. For new folks with very little capital to spare, it is not possible on Ethereum due to very high tx fees. I did some fee calculation for a bot account **_(Gn35xm6fr3ByUJt9aC6ZSzSqzb15AyryhKQmZVoP56Z1)_** this bot spent ~4.8 SOL as transaction fees for ~961_400 transactions. Haven’t calculated the profit but it would easily be in millions. You can use [fees.solar](https://fees.solar/) to find fee stats of any solana account.

<img src="/assets/img/fees.solar.png" alt="Fees Solar stats" style="display: block; margin-left: auto; margin-right: auto;"/>

## FAQs
- How to start development on Solana blockchain?
There are a lot of twitter threads which point to getting started in Solana. 
  - Thread by ayushmenon_ <https://twitter.com/ayushmenon_/status/1476294409205526534>
  - Thread by pencilflip <https://twitter.com/pencilflip/status/1451949960065335302>
  - Thread by dabit3 on Web3 learning <https://twitter.com/dabit3/status/1477463655491031045>

- How do Liquidity Pools work?
{% include youtubeplayer.html id=page.youtubeId %}

- How to find the optimal input for arb trade?
Refer the math explained in the README file of this repo [amm-arbitrageur](https://github.com/paco0x/amm-arbitrageur)

## References
- MEV research during Wormhole incident - <https://misaka.substack.com/p/mev-research-during-wormhole-incident>
- <https://www.gemini.com/cryptopedia/amm-what-are-automated-market-makers>
- <https://www.gemini.com/cryptopedia/glossary>
- Research paper on [**Cyclic Arbitrage on Decentralized Exchange**](https://arxiv.org/pdf/2105.02784.pdf)


