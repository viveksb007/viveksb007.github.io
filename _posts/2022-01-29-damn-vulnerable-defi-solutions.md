---
layout: post
title: "Damn Vulnerable DeFi Solutions"
date: 2022-01-29
tags: [Web3, DeFi, Security]
comments: true
---

I recently came across a post "**[How to become a Smart Contract Auditor](https://cmichel.io/how-to-become-a-smart-contract-auditor/)**" by [cmichel](https://twitter.com/cmichelio). The post breaks down the skills required and points to good resources to get started with Smart Contract security. Before this, I was exploring development on Ethereum using Solidity. Solving these challenges has given me better insights to look at code from a security perspective and improved overall Solidity skills.

Code solutions can be found on my fork of damn-vulnerable-defi repo. Feel free to suggest/comment some other ways to exploit the challenges or any gas optimizations (I didn't tried to optimize for gas while writing exploits)

Link - [viveksb007/damn-vulnerable-defi](https://github.com/viveksb007/damn-vulnerable-defi)

## [Unstoppable](https://www.damnvulnerabledefi.xyz/challenges/1.html)
In this challenge, you basically need to break the lending functionality of the pool. There is an assertion for `poolBalance` equal to tokenBalance. We can increase token balance without modifying the `poolBalance` state variable which will break the lending functionality.

## [Naive Receiver](https://www.damnvulnerabledefi.xyz/challenges/2.html)
There is a buggy receiver contract. In each `receiveEther()` call, 1 ETH is transferred from the user's contract to the pool. As the user has 10 ETH, to drain you can call `flashLoan()` with user address 10 times or write an exploit contract to do this in a single transaction.

## [Truster](https://www.damnvulnerabledefi.xyz/challenges/3.html)
Some info that you should go through before starting this challenge. ERC20 interface methods and how to make dynamic calls in solidity using abi encodings.

## [Side entrance](https://www.damnvulnerabledefi.xyz/challenges/4.html)
Take a flash loan, make a deposit in that pool which would map the loaned ETH to the attacker's address. This deposit is sufficient to complete the flash loan. Finally withdraw all ETH.

## [The Rewarder](https://www.damnvulnerabledefi.xyz/challenges/5.html)
Take a flash loan and deposit the loaned tokens in the Reward pool and get the rewards. Then transfer tokens back to the lender pool.  

## [Selfie](https://www.damnvulnerabledefi.xyz/challenges/6.html)
Take a flash loan. When you receive loaned tokens, queue `drainAllFunds()` action (as you have got a big governance token supply after loan). After queuing, return the loaned tokens. Execute the action that was queued in the previous step.

## [Compromised](https://www.damnvulnerabledefi.xyz/challenges/7.html)
The main observation here is that the hexa-decimal strings are actually oracle source private keys that are compromised. You use those private keys to manipulate oracle prices to buy low and sell high and take all ETH from exchange.

## [Puppet](https://www.damnvulnerabledefi.xyz/challenges/8.html)
Pre-read - [Constant product formula used in AMM](https://github.com/runtimeverification/verified-smart-contracts/blob/uniswap/uniswap/x-y-k.pdf)
Lending pool uses Uniswap as an oracle to get DVT-ETH price from Uniswap exchange pool. Deposit your DVT into a uniswap pool to skew the price. This would make DVT very cheap wrt ETH. Then, you can borrow all DVT tokens from the lending pool.

## [Puppet V2](https://www.damnvulnerabledefi.xyz/challenges/9.html)
This is kind of similar to Puppet V1. Same logic to exploit.

## [Free Rider](https://www.damnvulnerabledefi.xyz/challenges/10.html)
Implementation of `buyMany()` is buggy, you can send money for a single NFT and buy many NFTs as it's checking `msg.value` for each buy when buying many. Take flash loan for ETH, buy NFTs, send to buyer to get reward and payback the loaned ETH.

P.S - I referred to videos by [Smart Contract Programmer](https://www.youtube.com/channel/UCJWh7F3AFyQ_x01VKzr9eyA) whenever I was stuck for more than 1-2 days. 
