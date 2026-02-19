---
title: "Kube-proxy network_programming_duration_seconds Metric"
date: 2026-02-18
draft: false
---

The `network_programming_duration_seconds` metric tracks how long it takes for a Pod or Service change to show up in the actual network rules (iptables/ipvs/nftables) on each node.

## Component Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ Control Plane                                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  1. Pod becomes Ready (or Service changes)                       │
│     └─> Timestamp: T0                                            │
│                                                                   │
│  2. Endpoints Controller detects change                          │
│     └─> Calculates trigger time from Pod condition               │
│     └─> Sets annotation on EndpointSlice:                        │
│         endpoints.kubernetes.io/last-change-trigger-time = T0    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ watch/update
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Worker Node                                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  3. kube-proxy receives updated EndpointSlice                    │
│     └─> Extracts annotation timestamp: T0                        │
│     └─> (EndpointsChangeTracker filters if T0 < trackerStartTime)│
│                                                                   │
│  4. kube-proxy programs iptables/ipvs/nftables rules             │
│     └─> Completes at timestamp: T1                               │
│                                                                   │
│  5. kube-proxy calculates and emits metric                       │
│     └─> network_programming_duration_seconds = T1 - T0           │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

**Key Points:**
- **Endpoints Controller** (control plane) adds the `last-change-trigger-time` annotation
- **kube-proxy** (worker node) calculates the delta and emits the metric

## How It Works

Simple math: `current_time - last_change_trigger_time`

The `endpoints.kubernetes.io/last-change-trigger-time` annotation on EndpointSlice objects stores when the Pod or Service change happened (RFC 3339 format). The endpoints controller sets this on the control plane. When kube-proxy sees an updated EndpointSlice, it grabs that timestamp, programs the rules, and records how long the whole thing took.

## Handling Restarts

Here's where it gets interesting. When kube-proxy restarts on an existing node, or when a new node joins the cluster (starting kube-proxy for the first time), it sees EndpointSlice objects with timestamps from before it started. Calculate latency naively and you'd get massive numbers that include the entire downtime.

Instead, kube-proxy's `EndpointsChangeTracker` stores a `trackerStartTime` at startup and ignores any trigger times before that. Only changes that happened after startup get tracked, which filters out the stale stuff.

## Code Pointers

- [`/pkg/proxy/metrics/metrics.go`](https://github.com/kubernetes/kubernetes/blob/master/pkg/proxy/metrics/metrics.go) - metric definition and histogram buckets
- [`/pkg/proxy/endpointschangetracker.go`](https://github.com/kubernetes/kubernetes/blob/master/pkg/proxy/endpointschangetracker.go) - timestamp tracking and filtering logic
- [`/pkg/controller/endpoint/endpoints_controller.go`](https://github.com/kubernetes/kubernetes/blob/master/pkg/controller/endpoint/endpoints_controller.go) - annotation setting by endpoints controller

**Note**: Clock skew between control plane and nodes throws this off, since one timestamp comes from the control plane and the other from the node.
