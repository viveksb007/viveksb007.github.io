---
author: ["Author Vivek Bhadauria"]
title: "Firewall Rule Conversion Problem"
date: 2026-08-09
tags: [firewall, leetcode, trie, merge-interval]
ShowToc: false
---

I was reviewing a teammate's PR that optimized how we convert user-space firewall rules to another format to program into eBPF dataplane, and it was a nice reminder that DSA isn't just interview trivia. It shows up in real infra code more often than you'd think. The change was small on the surface, but underneath it swapped a linear scan for a trie and turned a quadratic loop into linear complexity.

In this post, I will model it as a system programming/leetcode style problem. I'll write the problem, solve it the way the code used to work, and then show the optimized version the PR shipped.

## Problem: inheriting ports from CIDR ancestors

You're given a stream of operations that map CIDR blocks to ports. A CIDR block is a range of IPv4 addresses, and one block can contain another: a shorter prefix contains every longer prefix that falls inside its range. `192.0.2.0/24` contains `192.0.2.0/25`, which contains `192.0.2.0/26`, and so on.

Implement a class `PortRegistry` with two methods:

- `addRule(cidr, port)` registers that the CIDR block `cidr` (say `"192.0.2.0/24"`) exposes `port`. The same block can pick up more ports over time.
- `query(ip)` takes an IPv4 address and returns every port the address inherits. An address inherits a port if it falls inside a registered block. That includes ports from every ancestor block that contains the IP, from the widest prefix (`/0`) down to the most specific one.

Return the ports sorted, with duplicates removed.

A couple of definitions to keep things precise:

- A block `A.B.C.D/n` matches an IP when the first `n` bits of the IP equal the first `n` bits of `A.B.C.D`.
- Block `X` is an ancestor of block `Y` when `X` contains every address in `Y`, meaning `X` has a shorter prefix and still matches `Y`'s network address.

### Example

```
addRule("0.0.0.0/0",     80)
addRule("192.0.2.0/24",  443)
addRule("192.0.2.0/25",  8080)
addRule("192.0.2.0/25",  8443)

query("192.0.2.50")   -> [80, 443, 8080, 8443]
    // matches /0 (80), /24 (443), and /25 (8080, 8443)

query("192.0.2.200")  -> [80, 443]
    // in /24 but NOT in /25 (bit 25 is 1), so no 8080/8443

query("10.0.0.1")     -> [80]
    // only the default route matches
```

### Constraints

- Up to `10^5` calls total across `addRule` and `query`.
- Every IP and CIDR is valid IPv4.
- `0 <= port <= 65535`, `0 <= n <= 32`.

## The naive solution: scan every rule

The obvious approach, and the one the code actually started with, is to keep every rule in a map keyed by its CIDR string. On a query you walk the whole map and keep the rules whose network contains the IP.

```
addRule(cidr, port):
    rules[cidr].append(port)

query(ip):
    result = []
    for cidr, ports in rules:          // look at every rule
        if parse(cidr).contains(ip):   // compare the full mask
            result += ports
    return sorted(unique(result))
```

This is basically what the agent did. The real function was called `checkAndDeriveL4InfoFromAnyMatchingCIDRs`, and it ranged over the CIDR map calling `net.Contains` on each entry. Clear, easy to read, and correct.

It's also slow in the way that bites you later. `addRule` is `O(1)`, but `query` is `O(N * W)`: you touch all `N` rules, and each `contains` check costs up to `W` bits of work (32 for IPv4, 128 for IPv6). The part that stings is that the cost tracks the *total* number of rules, not the handful that actually match.

In the agent it was worse than one query in isolation. Every incoming CIDR gets checked against every other CIDR to figure out inheritance, so the whole pass is `O(N^2 * W)`. With a big rule set that's exactly the kind of thing that quietly eats CPU as a cluster grows.

## The trie solution

The fix is a binary trie keyed on the prefix bits of each CIDR. This is the same structure Linux uses for route lookup, and the mental model is short: a node's depth is the prefix length, and the path from the root spells out the prefix bit by bit. You hang the ports off the node that sits at the last prefix bit.

The nice property falls out of the shape. To find every ancestor of an IP, you walk down the trie following the IP's bits and grab the ports off every node you pass through. That path *is* the chain of containing prefixes, from widest to narrowest. No scanning, no comparing against rules that were never going to match.

```
addRule(cidr, port):
    node = root
    for i in 0 .. prefixLen(cidr) - 1:   // descend prefixLen bits
        bit = ith bit of network(cidr)
        node = node.child[bit]           // create if missing
    node.ports.append(port)

query(ip):
    result = []
    node = root
    result += node.ports                 // /0 catch-all, if present
    for i in 0 .. W - 1:
        bit = ith bit of ip
        node = node.child[bit]
        if node == null: break           // nothing deeper can match
        result += node.ports             // an ancestor matched here
    return sorted(unique(result))
```

Here's the walk in action. Pick an IP and step through it: the path lights up as it descends, and the ports pile on from each ancestor node.

{{< trie-walk >}}

Now the numbers. `addRule` is `O(W)`, since you descend at most `W` bits. `query` is `O(W + P)`, where `P` is the number of ports you collect along the way, and it doesn't depend on `N` at all. The lookup depth is capped at 32 or 128 bits, so for practical purposes a query is constant time no matter how many rules you've loaded. Memory is `O(N * W)` in the worst case, but shared prefixes collapse into shared nodes, so real rule sets use far less.

You pay a bit more memory and a few more lines of code. In return, a per-query scan of the entire rule set becomes a fixed-depth walk, and the `O(N^2)` pass drops to `O(N * W)`. That was the whole point of the PR.

## Follow up: port ranges

You can extend the single port to port ranges as an extension to the problem. 

Change `addRule` to take a start and end:

- `addRule(cidr, startPort, endPort)`. If `endPort` is empty, the rule is the single port `startPort`. Otherwise it covers every port in the inclusive range `[startPort, endPort]`.

And change `query(ip)` to return merged, non-overlapping ranges instead of a flat list of ports. Each range is a pair `[startPort, endPort]`:

- A single port comes back as a range where start equals end, so port `80` is `[80, 80]`.
- Contiguous or overlapping ports collapse into one range.

The ranges come back disjoint and sorted by start.

```
addRule("0.0.0.0/0",    80,   null)     // single port 80
addRule("192.0.2.0/24", 8000, 8002)     // range 8000..8002
addRule("192.0.2.0/25", 8001, 8003)     // range 8001..8003 (overlaps above)

query("192.0.2.50")  -> [[80, 80], [8000, 8003]]
    // [80,80] from /0, then 8000..8002 and 8001..8003 merge into 8000..8003
```

The lookup structure and the range merging are independent problems, which is the part I like about this problem. The extension in similar to [Merge Interval problem of Leetcode](https://leetcode.com/problems/merge-intervals/description).

Try this problem yourself or point your agent to one-shot it.
