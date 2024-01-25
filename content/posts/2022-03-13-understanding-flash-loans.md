---
author: ["Vivek Bhadauria"]
title: "Understanding Flash Loans"
date: 2022-03-13
tags: [Web3, DeFi]
ShowToc: false
---

I was always wondering how Flash loans actually work, how can we get uncollateralized loan on blockchain. I got better understanding of Flash loans while solving [Free Rider problem](https://www.damnvulnerabledefi.xyz/challenges/10.html). In this post, I tried to explain how Flash loans actually work using pseudo code. If you want to have a look at actual solidity code. See [Reference](#references) section.

## What are Flash Loans?
Flash loans are uncollateralized loans in DeFi. They enable users to borrow liquidity instantly without any collateral. There is a catch, the borrowed amount needs to be paid back in the same transaction, along with some fees which can vary for different protocols. It’s a bit difficult to understand how this actually happens, so we will look at some code examples to understand how this is achieved.

## Atomic nature of blockchain transactions
In the blockchain paradigm, transactions are atomic. Either the state change corresponding to the transaction happens entirely or no change is done to the blockchain state. Let’s understand this with a pseudo code example-

```
contract Counter {

    counter_var = 0;	

    function add(number) {
        counter_var+=number;
    }

    function subtract(number) {
        counter_var-=number;
        // Any other of intermediate operations
        revert(“this will cancel the transaction”)
    }

}
```

If you call `contract.add(10)`, `counter_var` will become 10
If you call `contract.subtract(10)`, `counter_var` will be the same as in the last line of `subtract()` we are calling `revert(“”)` which reverts the state changes done by transaction till that point.

## Code examples of flash loans using Uniswap
Lets try to understand by looking at some code examples on how this type of uncollateralized loan is possible. We are creating some simple contracts and using pseudo code for explanation purposes. You can follow the numbers to see the execution flow starting from `ArbitrageBot.takeFlashLoan()`.

```
// Assuming 1 ETH=2500 USDC
contract LiquidityPool {

    ETH = 200
    USDC = 500_000

    function flashLoan(amount, currency) {
        Check if pool has enough liquidity to loan amount of currency // 2

        Transfer amount of currency to address calling this function // 3

        Callback address which called this function to let it do something with loan // 4
        Sample call - address.amountLoaned()

        Check if liquidity in pool >= initial balance else revert the transaction // 8
    }
}

contract ArbitrageBot {
	

    function takeFlashLoan() {
        LiquidityPool.flashLoan(200_000, USDC) // 1
        log(“Flash loan completed successfully”) // 9
    }

    function amountLoaned() {
        At this point, this address has 200_000 USDC // 5

        Do arbitrage using 200_000 USDC // 6

        Payback the 200_000 USDC along with Fees // 7
    }

}

```

## Usage of Flash Loans
From what I can see, the major utility of flash loans is doing arbitrage. Flash loans allow you to leverage large pool liquidity to do arbitrage without you having to use your own assets except paying for transaction fees and flash loan fees.
There are many bots on blockchain that use Flash loans to do arbitrage. Hacker’s also use Flash loans to manipulate oracle prices if that’s required in their hack execution. There have been previous instances in which flash loan was an intermediate step in performing some hack.
Attaching report of one of many hacks which was executed using Flash Loan - <https://github.com/yearn/yearn-security/blob/master/disclosures/2021-02-04.md>

## References
- Flash loan code pointer - <https://github.com/viveksb007/damn-vulnerable-defi/blob/master/contracts/free-rider/FreeRiderNFTMarketplace.sol#L118>
In this code, I am taking a flash loan from Uniswap pool. 
- Related Uniswap doc - <https://docs.uniswap.org/protocol/V2/guides/smart-contract-integration/using-flash-swaps>

 