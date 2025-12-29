---
title: "Learning Projects"
date: 2025-12-28
comments: false
ShowShareButtons: true
ShowBreadCrumbs: false
ShowReadingTime: false
---

I believe the best way to learn is by building. This is my running list of project ideas - things that push me to explore general systems, networking and kernel programming. Some of these might never come to reality; I've mostly picked them up from reading things on the internet. Feel free to steal any of these, build and learn for yourself. If you do, I'd love to hear about it - tag me on [X](https://x.com/viveksb007) or [GitHub](https://github.com/viveksb007)!

---

## 🚧 In Progress

1. **gobpftool** — A read-only bpftool alternative written in Go using [cilium/ebpf](https://github.com/cilium/ebpf). Focused on prog and map show utilities for monitoring and debugging.
2. **go-bore** — TCP tunneling tool in Go, inspired by [bore](https://github.com/ekzhang/bore).

---

## ✅ Completed

| Project | Links |
|---------|-------|
| Gvisor Netstack experiments — userspace TCP/IP stack exploration | [GitHub](https://github.com/viveksb007/gvisor-experiment), [Blog Series](/2024/10/gvisor-userspace-tcp-server-client/) |
| CDNS-Proxy — DNS proxy built on CoreDNS using custom plugin named `intercepter` | [GitHub](https://github.com/viveksb007/cdns-proxy) |
| Solana Pool Monitor — AMM pool price monitoring via account subscriptions on Solana | [GitHub](https://github.com/viveksb007/solana-pool-monitor), [Blog](/2022/06/amm-reserve-monitoring) |
| Damn Vulnerable DeFi — solutions to DeFi security challenges (flash loans, oracles, governance, etc.) | [GitHub](https://github.com/viveksb007/damn-vulnerable-defi), [Blog](/2022/01/damn-vulnerable-defi-solutions) |
| LedgerEntriesCreator: scripts to transform investment platform data into ledger-cli entries | [GitHub](https://github.com/viveksb007/LedgerEntriesCreator), [Blog](/2024/05/moving-tracking-to-paisa) |

---

## 📋 Backlog

### eBPF Exploration

Most of these use [Rust Aya](https://aya-rs.dev/) — eBPF development in Rust.

1. XDP firewall with web UI — [reference](https://mostlynerdless.de/blog/2024/08/27/hello-ebpf-building-a-lightning-fast-firewall-with-java-ebpf-14/)
2. Packet rate calculator - logic for packet rate calculation when ebpf prog is attached to networking hook.
3. TCP state monitor with filter capabilities (address, state updates)
4. XDP DNS cache
5. BPF map stats printer — print stats without iteration (total map size, current size). This could be used as a generic bpf metric emission solution.
6. UDP and TCP checksum calculation post IP/Port changes - https://github.com/vadorovsky/network-types or create a separate crate for IP/Port modification and checksum calculation.
7. Build Scheduler with eBPF in Rust aya and sched_ext — [reference](https://mostlynerdless.de/blog/2024/10/25/a-minimal-scheduler-with-ebpf-sched_ext-and-c/)
8. Rewrite [nat64](https://github.com/kubernetes-sigs/nat64) in Rust-Aya — [reference](https://github.com/kubernetes-sigs/blixt)
9. Explore Shared socket for TCP/UDP traffic for host local traffic — [reference](https://medium.com/@satyam012005/shared-socket-enhancing-kubernetes-pod-communication-with-ebpf-ed3e2fc401cf)


### Gvisor Netstack

1. Packet modification: Do TCP communication over UDP and use GENEVE header TLV to send TCP connection related information in the header itself. This is something like TCP Over UDP. It would need a custom UDP server to extract inner packet and pass it on to TCP listener.

### Cryptography

1. PKCS#11 server using [p11-kit](https://p11-glue.github.io/p11-glue/p11-kit.html), communicate with [crypto11](https://github.com/ThalesIgnite/crypto11) client. PKCS#11 server could be running inside the EC2 Nitro Enclave.

### Simple Casino Games

UI similar to actual casino tables + multi-player support. Building these for `research` — gotta understand the odds before next Vegas trip.

1. Black Jack
2. Craps
3. Baccarat
4. Roulette
