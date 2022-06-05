---
layout: post
title: "AMM Reserve Monitoring"
date: 2022-06-01
tags: [Web3, DeFi]
youtubeId: a56XeddkOtA
youtubeId1: bppm8CjW3_o
comments: true
---

In this post, we are going to see how we can set up monitoring for AMM’s. This might be required for use-cases like
- Developing an API service which allows clients to query price of some asset in AMM
- Develop an arbitrage bot

I am referring to AMM's on the Solana blockchain. But the idea should be generally applicable to the AMMs of any blockchain.

We are going to look into simple CFMM based AMM for example Orca. There are few AMMs whose liquidity is distributed into a pool and orderbook like Serum and Raydium.

## CFMM based AMM
Assuming you are already aware of **_“Constant Function Market Maker (CFMM)”_**. There are great resources to understand it. Linking a few below:
- [Formal specification of CFMM](https://github.com/runtimeverification/verified-smart-contracts/blob/uniswap/uniswap/x-y-k.pdf)
- [Constant product AMM spot price](https://www.youtube.com/watch?v=a56XeddkOtA)
{% include youtubeplayer.html id=page.youtubeId %}

- [Constant product AMM spot price example](https://www.youtube.com/watch?v=bppm8CjW3_o)
{% include youtubeplayer.html id=page.youtubeId1 %}

To understand with a simple example, let's assume there is **_100 ETH_** and **_100 USDC_** in a pool. So the current price is **_1 ETH = 1 USDC_**. This doesn’t mean you can take all **_100 ETH_** for **_100 USDC_**, liquidity is distributed according to constant function **_X*Y = Constant_**

So if you want to take **_1 ETH_**, the amount of USDC required will be **_100*100 = (100-1) * (100+n)_**
Which gives **_“n = 1.0101”_**

We want to monitor the price of the **_SOL-USDC_** pool, so finding reserves of **_SOL_** and **_USDC_** in a pool is the first step.

## Code Snippets
In Solana, the programming model is different from Ethereum. For simplicity let's assume there are 2 token accounts, one account holds **_USDC_** and other holds **_SOL_**. Thus we need to monitor 2 addresses.

ORCA **SOL-USDC AMM** address - <https://solscan.io/account/EGZ7tiLeH62TPV1gL8WwbXGzEPa9zmcpVnnkPKKnrE2U> 

**SOL** token account - [ANP74VNsHwSrq9uUSjiSNyNWvf6ZPrKTmE4gHoNd13Lg](https://solscan.io/account/ANP74VNsHwSrq9uUSjiSNyNWvf6ZPrKTmE4gHoNd13Lg)
**USDC** token account - [75HgnSvXbWKZBpZHveX68ZzAhDqMzNDS29X6BGLtxMo1](https://solscan.io/account/75HgnSvXbWKZBpZHveX68ZzAhDqMzNDS29X6BGLtxMo1)

We are using [solana-go](https://github.com/gagliardetto/solana-go) library to interact with Solana blockchain and **_“genesysgo”_** validator.

### Creating a web-socket client
```go
client, err := ws.Connect(context.Background(), "wss://ssc-dao.genesysgo.net")
if err != nil {
    panic(err)
}
```

### Listen to data change of account
```go
func listenToAddress(publicKey solana.PublicKey, client *ws.Client, p *PoolUpdateEvent, id int) {
	sub, err := client.AccountSubscribe(
		publicKey,
		rpc.CommitmentConfirmed,
	)
	if err != nil {
		panic(err)
	}
	defer sub.Unsubscribe()
	for {
		got, err := sub.Recv()
		if err != nil {
			panic(err)
		}
		borshDec := bin.NewBorshDecoder(got.Value.Data.GetBinary())
		var meta token.Account
		err = borshDec.Decode(&meta)
		if err != nil {
			panic(err)
		}
		p.mu.Lock()
		if meta.Amount != p.amounts[id] {
			p.amounts[id] = meta.Amount
			p.slots[id] = got.Context.Slot
			fmt.Println(fmt.Sprintf("%s   %d  SLOT:%d", meta.Mint, p.amounts[id], p.slots[id]))
			if p.slots[0] == p.slots[1] {
				fmt.Println(fmt.Sprintf("Price %f", (float64(p.amounts[1])/USDC)/(float64(p.amounts[0])/SOL)))
			}
		}
		p.mu.Unlock()
	}
}
```
Data decoding example can be found in readme of [solana-go](https://github.com/gagliardetto/solana-go/blob/main/README.md).

You can see complete code in this repo - <https://github.com/viveksb007/solana-pool-monitor>. Repo has instructions to build and run the code.

Running the code should produce output similar to below image

<img src="/assets/img/amm_monitor_terminal.png" alt="AMM Monitor terminal" style="display: block; margin-left: auto; margin-right: auto;"/>

I have also written code to find price from Raydium pool. I adapted logic from their discord. Attaching the image below:

<img src="/assets/img/raydium_discord.png" alt="Raydium discord screenshot" style="display: block; margin-left: auto; margin-right: auto;"/>

**NOTE - This was just a POC project for me to understand how to monitor changes in blockchain state. So if you see any bug or in-correct explanation, feel free to comment or dm [@viveksb007](https://twitter.com/viveksb007)**

## Resources
- [Smart Contract Programmer YouTube](https://www.youtube.com/channel/UCJWh7F3AFyQ_x01VKzr9eyA) channel
- [solana-pool-monitor](https://github.com/viveksb007/solana-pool-monitor) github repo 

