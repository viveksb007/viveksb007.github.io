---
author: ["Author Claude 3.7 | Prompter Vivek Bhadauria"]
title: "Life of a DNS Packet in K8s"
date: 2025-06-21
tags: [coredns, kubernetes]
ShowToc: true
---

In this post, we want to understand how a DNS request in K8s pod gets resolved. Let's create a mental model before we make a DNS request and see how packet moves through the cluster.

## Glossary
- **Client Pod**: This is going to be the pod which will make various kinds of DNS request.
- **CoreDNS**: This is the DNS server that we will use as DNS provider in our K8s cluster.
- **Service**: In K8s world, Service is a basically a ClusterIP backed by various Pods. 
- **Kube-Proxy**: This component is responsible to configuring service routing on the Node. It configures the IPTable rules which translates the ServiceIP to PodIPs.

## Kubernetes DNS Architecture

Before diving into the packet flow, let's understand the basic DNS architecture in Kubernetes:

1. **CoreDNS** runs as a deployment in the `kube-system` namespace
2. A **Kubernetes Service** (typically named `kube-dns`) exposes CoreDNS to the cluster
3. Every pod's `/etc/resolv.conf` is configured to use this DNS service
4. **kubelet** sets DNS configuration for each pod during creation

## DNS Resolution Flow

When a pod makes a DNS request, the following steps occur:

1. **DNS Query Initiation**: The application in the pod makes a DNS lookup call
2. **Local Resolution Attempt**: The query first checks the pod's `/etc/hosts` file
3. **DNS Server Query**: If not found locally, the query is sent to the nameserver specified in `/etc/resolv.conf`
4. **Network Traversal**: The packet leaves the pod's network namespace
5. **Service Resolution**: kube-proxy's iptables/ipvs rules redirect the packet to CoreDNS pods
6. **CoreDNS Processing**: CoreDNS receives the query and processes it based on its configuration
7. **Response Return**: The DNS response follows the reverse path back to the client pod

## Types of DNS Queries in Kubernetes

### 1. Service DNS Resolution

For services in the same namespace:
```
<service-name>
```

For services in different namespaces:
```
<service-name>.<namespace>
```

Fully qualified domain name (FQDN):
```
<service-name>.<namespace>.svc.cluster.local
```

**Example Query and Response:**

```bash
# Query for a service in the same namespace
$ nslookup my-service
Server:		10.100.0.10
Address:	10.100.0.10#53

Name:	my-service.default.svc.cluster.local
Address: 10.100.87.205

# Query for a kube-dns service in kube-system namespace
$ nslookup kube-dns.kube-system
Server:		10.100.0.10
Address:	10.100.0.10#53

Name:	kube-dns.kube-system.svc.cluster.local
Address: 10.100.0.10

# Query for a service in a different namespace
$ nslookup database-service.prod
Server:		10.100.0.10
Address:	10.100.0.10#53

Name:      database-service.prod.svc.cluster.local
Address:   10.100.12.45

# Query using FQDN
$ nslookup monitoring-service.observability.svc.cluster.local
Server:		10.100.0.10
Address:	10.100.0.10#53

Name:      monitoring-service.observability.svc.cluster.local
Address:   10.100.76.23
```

When you query a service, the DNS response contains the ClusterIP of the service, not the individual pod IPs. The kube-proxy then handles the translation from service IP to pod IP.

### 2. Pod DNS Resolution

Pods can be reached using the following format:
```
<pod-ip-with-dashes>.<namespace>.pod.cluster.local
```

For example, a pod with IP 10.244.1.4 in namespace "default" would be:
```
10-244-1-4.default.pod.cluster.local
```

**Example Query and Response:**

```bash
# Query for a specific pod by its IP
$ nslookup 10-244-1-4.default.pod.cluster.local
Server:		10.100.0.10
Address:	10.100.0.10#53

Name:      10-244-1-4.default.pod.cluster.local
Address:   10.244.1.4

# Query for a specific pod by its IP
$ nslookup 192-168-74-156.default.pod
Server:		10.100.0.10
Address:	10.100.0.10#53

Name:	192-168-74-156.default.pod.cluster.local
Address: 192.168.74.156
```

Pod DNS resolution is useful when you need to communicate directly with a specific pod, bypassing the service load balancing. This is less common but can be necessary for debugging or specific communication patterns.

### 3. External DNS Resolution

CoreDNS forwards external DNS queries to the upstream DNS servers configured in its Corefile or to the node's DNS resolver.

**Example Query and Response:**

```bash
# Query for an external domain
$ nslookup kubernetes.io
Server:		10.100.0.10
Address:	10.100.0.10#53

Non-authoritative answer:
Name:	kubernetes.io
Address: 3.33.186.135
Name:	kubernetes.io
Address: 15.197.167.90

# Query for another external domain
$ nslookup github.com
Server:		10.100.0.10
Address:	10.100.0.10#53

Non-authoritative answer:
Name:	github.com
Address: 140.82.116.3
```

For external domains, CoreDNS acts as a proxy, forwarding the request to the configured upstream DNS servers (typically the node's DNS resolver or a specified DNS server). The response is then relayed back to the client pod.

## IPTables Deep Dive: How kube-proxy Routes Service Traffic

Before we look at the packet flow diagram, let's understand how kube-proxy configures iptables to handle service traffic in Kubernetes.

### kube-proxy and IPTables Overview

kube-proxy is responsible for implementing the Kubernetes Service concept using iptables rules. When running in iptables mode (the default), kube-proxy watches the Kubernetes API server for changes to `Service` and `EndpointSlice` objects (in newer versions) or Endpoint objects (in older versions) and updates the node's iptables rules accordingly. EndpointSlice is the newer, more scalable API that replaced the original Endpoints API, especially for large clusters.

### IPTables Chains Created by kube-proxy

kube-proxy creates several custom chains in the iptables nat table:

1. **KUBE-SERVICES**: The entry point for service packet processing
2. **KUBE-SVC-XXX**: Chain for each service (one per service)
3. **KUBE-SEP-XXX**: Chain for each service endpoint (one per pod backing a service)
4. **KUBE-MARK-MASQ**: Used to mark packets for masquerading
5. **KUBE-POSTROUTING**: Handles masquerading for outgoing packets

### IPTables Resolution Flow

When a packet is destined for a Kubernetes service IP, it flows through these chains as follows:

```
PREROUTING/OUTPUT
      |
      v
KUBE-SERVICES
      |
      v
KUBE-SVC-XXX (Service-specific chain)
      |
      v
KUBE-SEP-XXX (Load balancing across endpoints)
      |
      v
DNAT (Destination NAT to pod IP)
```

### Detailed IPTables Rules for DNS Service

Let's examine the actual iptables rules created for the kube-dns service:

```bash
# Entry point: Match packets destined for kube-dns service IP
-A KUBE-SERVICES -d 10.100.0.10/32 -p udp -m udp --dport 53 -j KUBE-SVC-TCOU7JCQXEZGVUNU
-A KUBE-SERVICES -d 10.100.0.10/32 -p tcp -m tcp --dport 53 -j KUBE-SVC-ERIFXISQEP7F7OF4

# Service chain: Load balance across endpoints (for UDP DNS)
# This example assumes two CoreDNS pods for redundancy
-A KUBE-SVC-TCOU7JCQXEZGVUNU -m statistic --mode random --probability 0.50000000000 -j KUBE-SEP-IQRD2TFPVWMKOCND
-A KUBE-SVC-TCOU7JCQXEZGVUNU -j KUBE-SEP-X3P2623AGDH6CDF3

# Endpoint chains: DNAT to specific pod IPs
-A KUBE-SEP-IQRD2TFPVWMKOCND -p udp -m udp -j DNAT --to-destination 10.244.0.4:53
-A KUBE-SEP-X3P2623AGDH6CDF3 -p udp -m udp -j DNAT --to-destination 10.244.2.8:53

# For local pods accessing their own node's services
-A KUBE-MARK-MASQ -j MARK --set-xmark 0x4000/0x4000
```

### How Load Balancing Works

The `--mode random --probability 0.50000000000` in the KUBE-SVC chain implements a simple but effective load balancing strategy:

- For each packet, a random number between 0 and 1 is generated
- If the number is less than 0.5, the packet goes to the first endpoint
- Otherwise, it goes to the second endpoint
- With more endpoints, the probability is adjusted accordingly (e.g., 0.33 for three endpoints)

This ensures an even distribution of traffic across all CoreDNS pods.

### Handling Return Traffic

For the return path, conntrack (connection tracking) ensures that response packets are correctly routed back to the original client:

```bash
# Check connection tracking table
$ conntrack -L | grep 10.100.0.10
udp      17 29 src=10.244.1.5 dst=10.100.0.10 sport=56012 dport=53 [UNREPLIED] src=10.244.0.4 dst=10.244.1.5 sport=53 dport=56012 mark=0 use=1
```

The conntrack entry maps the original connection to the NAT'd connection, allowing return packets to be correctly translated back.

## Packet Flow Diagram

{{< mermaid >}}
flowchart TD
    A[Client Pod] -->|1. DNS Query| B[Pod Network Interface]
    B --> C[Node Network Stack]
    C -->|2. Packet| D[kube-dns Service IP]
    D -->|3. DNAT| E[kube-proxy iptables]
    E -->|4. Forward| F[CoreDNS Pod]
    F -->|5. Process Query| F
    F -->|6. Response| E
    E -->|7. Reverse NAT| D
    D -->|8. Response| C
    C --> B
    B -->|9. DNS Response| A
    
    classDef pod fill:#d1f0ff,stroke:#0078d4,stroke-width:2px
    classDef network fill:#ffe6cc,stroke:#d79b00,stroke-width:2px
    classDef service fill:#d5e8d4,stroke:#82b366,stroke-width:2px
    classDef component fill:#fff2cc,stroke:#d6b656,stroke-width:2px
    
    class A,F pod
    class B,C network
    class D,E component
{{< /mermaid >}}

For a more detailed view of the packet flow through the IPTables chains:

{{< mermaid >}}
flowchart TD
    A[DNS Packet] --> B[PREROUTING Chain]
    B --> C[KUBE-SERVICES Chain]
    C -->|Match kube-dns Service IP| D[KUBE-SVC-XXX Chain]
    D -->|Random Load Balancing| E1[KUBE-SEP-XXX Chain for Pod 1]
    D -->|Random Load Balancing| E2[KUBE-SEP-XXX Chain for Pod 2]
    E1 -->|DNAT to Pod 1 IP| F1[CoreDNS Pod 1]
    E2 -->|DNAT to Pod 2 IP| F2[CoreDNS Pod 2]
    F1 --> G[DNS Response]
    F2 --> G
    
    classDef chain fill:#f9f,stroke:#333,stroke-width:1px
    classDef pod fill:#d1f0ff,stroke:#0078d4,stroke-width:2px
    classDef packet fill:#ffe6cc,stroke:#d79b00,stroke-width:2px
    
    class B,C,D,E1,E2 chain
    class F1,F2 pod
    class A,G packet
{{< /mermaid >}}

## Detailed Packet Walk

Let's follow a DNS packet step by step:

1. **Application initiates DNS lookup**:
   ```bash
   # Inside the client pod
   nslookup web-service
   ```

2. **Pod's DNS configuration**:
   The pod's `/etc/resolv.conf` typically looks like:
   ```
   cat /etc/resolv.conf
   search default.svc.cluster.local svc.cluster.local cluster.local us-west-2.compute.internal
   nameserver 10.100.0.10
   options ndots:5
   ```

3. **Packet leaves pod network namespace**:
   The DNS query packet has:
   - Source IP: Pod's IP (e.g., 10.244.2.5)
   - Destination IP: kube-dns Service IP (e.g., 10.100.0.10)
   - Destination Port: 53 (DNS)

4. **IPTables PREROUTING chain**:
   When the packet reaches the node's network stack, it first enters the PREROUTING chain:
   ```bash
   # Packet flow through iptables chains
   PREROUTING -> KUBE-SERVICES -> KUBE-SVC-TCOU7JCQXEZGVUNU
   ```

5. **Service to endpoint translation**:
   In the KUBE-SVC-TCOU7JCQXEZGVUNU chain, the packet is randomly directed to one of the endpoint chains:
   ```bash
   # Load balancing between CoreDNS pods
   KUBE-SVC-TCOU7JCQXEZGVUNU -> KUBE-SEP-IQRD2TFPVWMKOCND (50% probability)
   KUBE-SVC-TCOU7JCQXEZGVUNU -> KUBE-SEP-X3P2623AGDH6CDF3 (50% probability)
   ```

6. **DNAT to CoreDNS pod**:
   The endpoint chain performs DNAT to route the packet to the actual CoreDNS pod:
   ```bash
   # DNAT rule in endpoint chain
   -A KUBE-SEP-IQRD2TFPVWMKOCND -p udp -m udp -j DNAT --to-destination 10.244.0.4:53
   ```
   
   After DNAT, the packet now has:
   - Source IP: Pod's IP (unchanged, e.g., 10.244.2.5)
   - Destination IP: CoreDNS Pod IP (e.g., 10.244.0.4)
   - Destination Port: 53 (unchanged)

6. **CoreDNS processing**:
   CoreDNS receives the packet and processes the query according to its Corefile configuration:
   ```
   .:53 {
      errors
      health {
         lameduck 5s
      }
      ready
      kubernetes cluster.local in-addr.arpa ip6.arpa {
         pods insecure
         fallthrough in-addr.arpa ip6.arpa
      }
      prometheus :9153
      forward . /etc/resolv.conf
      cache 30
      loop
      reload
      loadbalance
   }
   ```

7. **DNS response generation**:
   - For Kubernetes services/pods: CoreDNS uses the kubernetes plugin to look up the IP
   - For external domains: CoreDNS forwards to upstream DNS servers

8. **Response return path**:
   The response packet follows the reverse path:
   - Source IP is translated back to the kube-dns Service IP
   - The packet is routed back to the client pod
   - The application receives the resolved IP address

## Verifying IPTables Rules for DNS

You can inspect the iptables rules on a Kubernetes node to understand how DNS traffic is being handled:

```bash
# List all iptables rules related to kube-dns
sudo iptables -t nat -S | grep 10.100.0.10

# Trace a DNS packet through iptables
sudo iptables -t nat -v -L KUBE-SERVICES -n --line-numbers | grep 10.100.0.10

# View connection tracking entries for DNS
sudo conntrack -L | grep 53
```

## NodeLocal DNSCache

For clusters with high DNS query loads, Kubernetes offers NodeLocal DNSCache, which runs a DNS cache on each node to:

- Reduce latency by avoiding network hops
- Decrease conntrack entries for DNS connections
- Improve DNS availability

[Read more about NodeLocal DNSCache setup in my other post](/2024/06/how-to-setup-nodelocaldns-in-eks/)

## Conclusion

Understanding the journey of a DNS packet in Kubernetes helps troubleshoot DNS issues and optimize cluster networking. The DNS resolution process involves multiple components working together: the pod's networking configuration, kube-proxy's service routing, and CoreDNS's resolution logic.

By following the packet's path through the system, we can better appreciate the elegant design of Kubernetes networking and more effectively diagnose problems when they arise.
