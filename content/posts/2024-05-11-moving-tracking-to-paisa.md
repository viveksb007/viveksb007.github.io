---
author: ["Vivek Bhadauria"]
title: "Moving My Personal Finance Tracking to Paisa"
date: 2024-05-11
tags: [Finance, Paisa]
ShowToc: false
---

## Introduction
I have been tracking my personal finances on an excel sheet on an ad-hoc basis. There was no specific system as such, I used to just dump my assets and their current value to calculate Net-Worth. I wanted more insights on how my investments in different asset classes are growing and see their performance over time (not point in time when I am checking it).

## Tools and Methods
I recently found [**_Paisa - Personal Finance Manager_**](https://github.com/ananthakumaran/paisa) and decided to give it a try. Mainly because your data stays on your system, it's not uploaded to any server. So this tool takes a privacy-first approach. This is a FOSS application, I didn't look any further.

{{< figure src="/img/Paisa.png" attr="Paisa Demo" align=center >}}

It's a great application built on top of ledger accounting. So I had to convert investment data from all avenues into ledger accounting format.

I invest on the following platforms:
- Zerodha Coin: Mutual Funds
- Zerodha Kite: Stocks
- PaytmMoney: Mutual Funds (discontinued)
- Robinhood: Stocks and Index Funds

Zerodha and Robinhood both have features to export transaction data in csv format. Unfortunately PaytmMoney doesn't allow exporting transactions in csv format instead gives a PDF file. PDF files are a bit complex to parse, so I took the average for each Mutual fund and added that as a ledger entry. Average is provided on the app itself so no effort there. 

I hacked together a few python scripts to transform transaction data into ledger accounting format and feed it into Paisa ledger editor.

For separation of concerns, I created separate ledger files for each platform and included individual ledgers on the main ledger, similar to ledger roll-up. For example

`file: coin-zerodha.ledger`
``` 
2024/03/15 Zerodha-Buy
    Assets:Equity:MF:NAVI_NIFTY             200.688 NAVI_NIFTY @ 14.159 INR
    Income:Salary:Genesis
```

`file: main.ledger`
``` 
include coin-zerodha.ledger

<MAIN LEDGER ENTRIES>
```

There is a one time effort to setup and configure accounts and symbols according to your investment style, after that adding investment data for next iterations is pretty easy. I can download transaction data for each month from different platforms and convert that data into ledger entries using scripts and update ledger with transformed data. This should take 5-10 mins at max. I don’t track minute expenses and mainly use this for investment tracking across different platforms/accounts.

I haven't explored all the features that this tool provides like adding different Goals, budget, etc.

[LedgerEntriesCreator](https://github.com/viveksb007/LedgerEntriesCreator) is the github repo which contains the scripts that I use to transform different investment platform data into ledger entries. You can use those as a reference if planning to move your tracking on this tool. 


## Conclusion
Overall I find this tool immensely useful in giving me `One-View` of my assets and updating current values by fetching market data. You can plug in other investment avenues like PF, Cred Money Lending, etc although they will not be updated automatically.
You can try out this tool to track your personal finances if you don't use any or want something more robust. 
