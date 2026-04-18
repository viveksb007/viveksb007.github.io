---
title: "Projects"
comments: false
ShowShareButtons: true
ShowBreadCrumbs: false
ShowReadingTime: false
---

<style>
.projects-intro {
  font-size: 1.05rem;
  line-height: 1.7;
  margin-bottom: 2rem;
}

.projects-section-title {
  font-size: 1.3rem;
  font-weight: 600;
  margin: 2.5rem 0 1.5rem 0;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid var(--border);
}

.project-item {
  padding: 1.25rem 0;
  border-bottom: 1px solid var(--border);
}

.project-item:last-child {
  border-bottom: none;
}

.project-header {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.4rem;
}

.project-name {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--primary);
  margin: 0;
}

.project-status {
  font-size: 0.8rem;
  font-weight: 500;
  padding: 2px 10px;
  border-radius: 9999px;
  background: #fef3c7;
  color: #92400e;
}

.dark .project-status {
  background: #78350f;
  color: #fef3c7;
}

.project-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 0.6rem;
}

.project-pill {
  display: inline-block;
  padding: 1px 10px;
  border-radius: 9999px;
  background: var(--code-bg);
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--secondary);
}

.project-desc {
  color: var(--secondary);
  font-size: 0.95rem;
  line-height: 1.6;
  margin-bottom: 0.5rem;
}

.project-links {
  display: flex;
  gap: 1rem;
  font-size: 0.9rem;
}

.project-links a {
  font-weight: 500;
  text-decoration: none;
  color: var(--primary);
  border-bottom: 1px dashed var(--secondary);
  transition: border-color 0.2s;
}

.project-links a:hover {
  border-bottom-style: solid;
}
</style>

<p class="projects-intro">
I believe the best way to learn is by building. This page tracks what I've built and what's on deck — things that push me to explore systems, networking and kernel programming. Feel free to steal any idea and build it yourself. If you do, tag me on <a href="https://x.com/viveksb007">X</a> or <a href="https://github.com/viveksb007">GitHub</a>!
</p>

<div class="projects-section-title">In Progress</div>

<div class="project-item">
  <div class="project-header">
    <span class="project-name">Black Jack</span>
    <span class="project-status">building</span>
  </div>
  <div class="project-pills">
    <span class="project-pill">Game</span>
    <span class="project-pill">Multiplayer</span>
  </div>
  <div class="project-desc">
    Casino game with UI similar to actual casino tables + multi-player support.
  </div>
</div>

<div class="projects-section-title">Built</div>

<div class="project-item">
  <div class="project-header">
    <span class="project-name">network-policy-assistant</span>
  </div>
  <div class="project-pills">
    <span class="project-pill">Go</span>
    <span class="project-pill">Kubernetes</span>
    <span class="project-pill">CLI</span>
  </div>
  <div class="project-desc">
    CLI linter for Kubernetes network policies — detects duplicate peers, redundant rules, and overlapping ports. Supports standard NetworkPolicy and AWS CRDs.
  </div>
  <div class="project-links">
    <a href="https://github.com/viveksb007/network-policy-assistant">GitHub</a>
  </div>
</div>

<div class="project-item">
  <div class="project-header">
    <span class="project-name">bpftui</span>
  </div>
  <div class="project-pills">
    <span class="project-pill">Go</span>
    <span class="project-pill">eBPF</span>
    <span class="project-pill">TUI</span>
  </div>
  <div class="project-desc">
    TUI for inspecting eBPF programs and maps, built on top of gobpftool CLI.
  </div>
  <div class="project-links">
    <a href="https://github.com/viveksb007/bpftui">GitHub</a>
  </div>
</div>

<div class="project-item">
  <div class="project-header">
    <span class="project-name">gobpftool</span>
  </div>
  <div class="project-pills">
    <span class="project-pill">Go</span>
    <span class="project-pill">eBPF</span>
    <span class="project-pill">cilium/ebpf</span>
  </div>
  <div class="project-desc">
    A read-only bpftool alternative written in Go using cilium/ebpf.
  </div>
  <div class="project-links">
    <a href="https://github.com/viveksb007/gobpftool">GitHub</a>
  </div>
</div>

<div class="project-item">
  <div class="project-header">
    <span class="project-name">go-bore</span>
  </div>
  <div class="project-pills">
    <span class="project-pill">Go</span>
    <span class="project-pill">Networking</span>
    <span class="project-pill">TCP Tunneling</span>
  </div>
  <div class="project-desc">
    TCP tunneling tool in Go, inspired by <a href="https://github.com/ekzhang/bore">bore</a>.
  </div>
  <div class="project-links">
    <a href="https://github.com/viveksb007/go-bore">GitHub</a>
  </div>
</div>

<div class="project-item">
  <div class="project-header">
    <span class="project-name">Gvisor Netstack Experiments</span>
  </div>
  <div class="project-pills">
    <span class="project-pill">Go</span>
    <span class="project-pill">Networking</span>
    <span class="project-pill">TCP/IP</span>
  </div>
  <div class="project-desc">
    Userspace TCP/IP stack exploration using Gvisor's netstack.
  </div>
  <div class="project-links">
    <a href="https://github.com/viveksb007/gvisor-experiment">GitHub</a>
    <a href="/2024/10/gvisor-userspace-tcp-server-client/">Blog Series</a>
  </div>
</div>

<div class="project-item">
  <div class="project-header">
    <span class="project-name">CDNS-Proxy</span>
  </div>
  <div class="project-pills">
    <span class="project-pill">Go</span>
    <span class="project-pill">DNS</span>
    <span class="project-pill">CoreDNS</span>
  </div>
  <div class="project-desc">
    DNS proxy built on CoreDNS using a custom plugin named <code>intercepter</code>.
  </div>
  <div class="project-links">
    <a href="https://github.com/viveksb007/cdns-proxy">GitHub</a>
  </div>
</div>

<div class="project-item">
  <div class="project-header">
    <span class="project-name">Solana Pool Monitor</span>
  </div>
  <div class="project-pills">
    <span class="project-pill">Go</span>
    <span class="project-pill">Solana</span>
    <span class="project-pill">DeFi</span>
  </div>
  <div class="project-desc">
    AMM pool price monitoring via account subscriptions on Solana.
  </div>
  <div class="project-links">
    <a href="https://github.com/viveksb007/solana-pool-monitor">GitHub</a>
    <a href="/2022/06/amm-reserve-monitoring">Blog</a>
  </div>
</div>

<div class="project-item">
  <div class="project-header">
    <span class="project-name">Damn Vulnerable DeFi</span>
  </div>
  <div class="project-pills">
    <span class="project-pill">Solidity</span>
    <span class="project-pill">Security</span>
    <span class="project-pill">DeFi</span>
  </div>
  <div class="project-desc">
    Solutions to DeFi security challenges — flash loans, oracles, governance, etc.
  </div>
  <div class="project-links">
    <a href="https://github.com/viveksb007/damn-vulnerable-defi">GitHub</a>
    <a href="/2022/01/damn-vulnerable-defi-solutions">Blog</a>
  </div>
</div>

<div class="project-item">
  <div class="project-header">
    <span class="project-name">LedgerEntriesCreator</span>
  </div>
  <div class="project-pills">
    <span class="project-pill">Python</span>
    <span class="project-pill">Finance</span>
    <span class="project-pill">ledger-cli</span>
  </div>
  <div class="project-desc">
    Scripts to transform investment platform data into ledger-cli entries.
  </div>
  <div class="project-links">
    <a href="https://github.com/viveksb007/LedgerEntriesCreator">GitHub</a>
    <a href="/2024/05/moving-tracking-to-paisa">Blog</a>
  </div>
</div>

---

## Backlog

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

1. Craps
2. Baccarat
3. Roulette
