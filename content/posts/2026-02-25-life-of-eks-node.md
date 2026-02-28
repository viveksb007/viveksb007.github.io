---
author: ["Author Claude Opus 4.6 | Prompter Vivek Bhadauria"]
title: "Life of an EKS Node: From Instance Boot to Ready"
date: 2026-02-25
tags: [EKS, Kubernetes, AWS]
ShowToc: true
---

If you've ever stared at `kubectl get nodes` waiting for a new node to appear and transition to `Ready`, you've probably wondered — what's actually happening behind the scenes? This post traces the complete lifecycle of an EKS worker node, from the moment an EC2 instance is triggered to the point it starts running your pods.

## The Big Picture

Before diving into details, here's a high-level overview of what happens:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        EKS Node Lifecycle                                │
│                                                                          │
│  1. Trigger       EC2 instance launched (ASG / Karpenter / Manual)       │
│       │                                                                  │
│  2. Boot          EC2 instance boots, cloud-init runs                    │
│       │                                                                  │
│  3. Bootstrap     nodeadm (AL2023) / bootstrap.sh (AL2) configures node │
│       │                                                                  │
│  4. TLS Bootstrap kubelet gets certificate from API server               │
│       │                                                                  │
│  5. Registration  kubelet registers Node object with API server          │
│       │                                                                  │
│  6. DaemonSets    kube-proxy, aws-node (VPC CNI) scheduled on node      │
│       │                                                                  │
│  7. Ready         All conditions met, node accepts pod scheduling        │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

Let's walk through each step.

## Step 1: Who Triggers the Instance?

An EKS worker node is just an EC2 instance. But something needs to launch it. There are three primary ways this happens:

### Managed Node Groups (Auto Scaling Groups)

This is the most common approach. When you create a **Managed Node Group**, EKS creates an Auto Scaling Group (ASG) behind the scenes. The ASG uses a **Launch Template** that specifies:

- **AMI** (Amazon Machine Image) — typically the EKS-optimized AMI
- **Instance type** (e.g., `m5.xlarge`)
- **Security groups** — must allow communication with the EKS control plane
- **IAM Instance Profile** — with the `AmazonEKSWorkerNodePolicy`, `AmazonEKS_CNI_Policy`, and `AmazonEC2ContainerRegistryReadOnly` policies
- **User data** — bootstrap script to join the cluster

A new instance gets launched when:
- The ASG's **desired capacity** increases (manually or via scaling policy)
- **Cluster Autoscaler** detects pending pods that can't be scheduled and increases desired capacity
- An existing instance is terminated and ASG replaces it to maintain desired count

{{< mermaid >}}
sequenceDiagram
    participant CA as Cluster Autoscaler
    participant ASG as Auto Scaling Group
    participant EC2 as EC2 Service
    participant Inst as EC2 Instance

    Note over CA: Detects pending unschedulable pods
    CA->>ASG: Increase desired capacity
    ASG->>EC2: RunInstances API call
    EC2->>Inst: Launch instance from Launch Template
    Note over Inst: Instance enters "pending" state
    Note over Inst: Instance enters "running" state
{{< /mermaid >}}

### Karpenter

Karpenter is an alternative to Cluster Autoscaler that talks directly to the EC2 Fleet API, bypassing ASGs entirely. When it detects unschedulable pods:

1. It evaluates its `NodePool` and `EC2NodeClass` CRDs to decide instance type, AMI, subnets, security groups
2. It calls the EC2 `CreateFleet` API directly
3. It creates a `NodeClaim` resource to track the lifecycle

Karpenter is faster because it skips the ASG abstraction layer — there's no ASG reconciliation delay.

### Self-Managed Node Groups

You manage the ASG and Launch Template yourself. The user data must include the bootstrap script invocation. This gives you full control but requires more operational overhead.

## Step 2: EC2 Instance Boot

Once the EC2 service receives the `RunInstances` (or `CreateFleet`) call, the following happens at the infrastructure level:

### Instance Placement and Hardware Allocation

1. EC2 selects a physical host in the specified Availability Zone
2. The EBS root volume is created from the AMI snapshot
3. The ENI (Elastic Network Interface) is created and attached — this gives the instance its primary private IP
4. The instance enters `pending` state

### What's in the EKS-Optimized AMI?

The EKS-optimized AMI is not a vanilla Amazon Linux image. It comes pre-baked with everything a Kubernetes worker node needs:

```
EKS-Optimized AMI Contents (AL2023)
├── Operating System
│   └── Amazon Linux 2023 (cgroupv2 by default)
├── Container Runtime
│   └── containerd
├── Kubernetes Binaries
│   ├── kubelet (matches cluster K8s version)
│   └── kubectl (for debugging)
├── Bootstrap Tool
│   └── /usr/bin/nodeadm (Go binary)
├── Systemd Services
│   ├── nodeadm-boot-hook.service
│   ├── nodeadm-config.service
│   └── nodeadm-run.service
├── AWS Components
│   ├── SSM Agent
│   ├── AWS CLI
│   └── ECR credential provider binary
├── Networking
│   ├── iptables / nftables
│   └── conntrack
└── Certificates
    └── AWS CA certificates
```

> **Note**: AL2 AMIs use `/etc/eks/bootstrap.sh` (a Bash script) instead of `nodeadm`. AL2023 is the recommended AMI family going forward.

### cloud-init and User Data

When the instance starts, `cloud-init` runs. This is the standard EC2 bootstrapping mechanism. It processes the **user data** attached to the instance.

On AL2023, user data contains a `NodeConfig` YAML document (the `nodeadm` configuration). For Managed Node Groups, EKS automatically injects the cluster metadata — you only need to provide customizations:

```yaml
---
apiVersion: node.eks.aws/v1alpha1
kind: NodeConfig
spec:
  cluster:
    name: my-cluster
    apiServerEndpoint: https://ABCDEF1234.gr7.us-west-2.eks.amazonaws.com
    certificateAuthority: Y2VydGlmaWNhdGVBdXRob3JpdHk=...
    cidr: 10.100.0.0/16
```

If you need to run custom shell scripts **and** provide NodeConfig, you use MIME multipart:

```
MIME-Version: 1.0
Content-Type: multipart/mixed; boundary="BOUNDARY"

--BOUNDARY
Content-Type: text/x-shellscript; charset="us-ascii"

#!/bin/bash
echo "Custom setup before nodeadm run phase..."
# Drop additional config for the run phase:
cat > /etc/eks/nodeadm.d/custom.yaml << EOF
apiVersion: node.eks.aws/v1alpha1
kind: NodeConfig
spec:
  kubelet:
    flags:
      - --node-labels=environment=production
EOF

--BOUNDARY
Content-Type: application/node.eks.aws

---
apiVersion: node.eks.aws/v1alpha1
kind: NodeConfig
spec:
  cluster:
    name: my-cluster
    apiServerEndpoint: https://ABCDEF1234.gr7.us-west-2.eks.amazonaws.com
    certificateAuthority: Y2VydGlmaWNhdGVBdXRob3JpdHk=...
    cidr: 10.100.0.0/16
  kubelet:
    config:
      maxPods: 110

--BOUNDARY--
```

Key points about the MIME format:
- `text/x-shellscript` parts are processed by **cloud-init** (not nodeadm)
- `application/node.eks.aws` parts are parsed by **nodeadm**
- Shell scripts run between nodeadm's config and run phases, so they can drop files into `/etc/eks/nodeadm.d/` that get picked up in the run phase

> **Important**: Do NOT explicitly call `nodeadm init` in your user data scripts. The systemd services handle execution ordering. Calling it manually can break the two-phase boot and cause misconfigured ENIs.

For **Managed Node Groups without a custom AMI**, EKS merges its own injected NodeConfig (with cluster metadata) with whatever you provide. You don't need to specify `cluster.name`, `apiServerEndpoint`, etc.

## Step 3: Node Bootstrap

The bootstrap process is where an EC2 instance gets configured as a Kubernetes worker node. AL2023 uses `nodeadm` (a Go binary), while the older AL2 uses `bootstrap.sh` (a Bash script). Since AL2023 is the recommended AMI going forward, we'll cover it in depth.

### nodeadm: The AL2023 Bootstrap Tool

`nodeadm` is a Go binary at `/usr/bin/nodeadm` that ships pre-installed on AL2023 EKS AMIs. Unlike the old `bootstrap.sh` which took CLI flags, nodeadm uses a **declarative YAML configuration** following Kubernetes API conventions — the `NodeConfig` resource.

#### The Two-Phase Systemd Architecture

This is the most important thing to understand about nodeadm. It doesn't run as a single script — it's orchestrated by **three systemd services** that execute in a carefully ordered sequence:

```
Boot Sequence (systemd ordering)
│
├── 1. nodeadm-boot-hook.service
│   ├── Runs: AFTER systemd-networkd, BEFORE nodeadm-config
│   ├── Executes: /usr/bin/nodeadm-internal boot-hook
│   └── Purpose: Foundational OS networking setup for IMDS access
│
├── 2. nodeadm-config.service    ◄── CONFIG PHASE
│   ├── Runs: BEFORE cloud-init (cloud-final.service)
│   ├── Executes: nodeadm init --skip run --config-source imds://user-data
│   └── Purpose: Read user data, write all config files, but do NOT start daemons
│
├── 3. cloud-init (cloud-final.service)
│   ├── Runs: BETWEEN config and run phases
│   └── Purpose: Execute user shell scripts from user data
│       └── Scripts can drop additional NodeConfig files into /etc/eks/nodeadm.d/
│
└── 4. nodeadm-run.service       ◄── RUN PHASE
    ├── Runs: AFTER cloud-final
    ├── Executes: nodeadm init --skip config --config-source imds://user-data
    │             --config-source file:///etc/eks/nodeadm.d/
    └── Purpose: Merge configs (including files dropped by cloud-init),
                 start containerd and kubelet
```

This two-phase design (`--skip run` then `--skip config`) is deliberate. It creates a window between the config and run phases where cloud-init executes your shell scripts. Those scripts can drop additional `NodeConfig` YAML files into `/etc/eks/nodeadm.d/`, which nodeadm picks up and merges in the run phase. This is how you inject dynamic configuration without breaking the boot order.

#### The NodeConfig API

The `NodeConfig` is nodeadm's declarative configuration format:

```yaml
apiVersion: node.eks.aws/v1alpha1
kind: NodeConfig
spec:
  cluster:
    name: my-cluster                        # EKS cluster name
    apiServerEndpoint: https://ABCDEF...    # API server URL
    certificateAuthority: Y2VydGlma...      # Base64-encoded CA cert
    cidr: 10.100.0.0/16                     # Service CIDR

  kubelet:
    config:                                 # KubeletConfiguration fields (merged with defaults)
      maxPods: 110
      shutdownGracePeriod: 30s
    flags:                                  # CLI flags (appended to defaults)
      - --node-labels=environment=production,team=platform

  containerd:
    config: |                               # Inline TOML (merged with defaults)
      [plugins."io.containerd.grpc.v1.cri".registry]
        config_path = "/etc/containerd/certs.d"

  instance:
    localStorage:                           # Instance store disk management
      strategy: RAID0                       # RAID0 | RAID10 | Mount
```

For **Managed Node Groups without a custom AMI**, you only need to provide customizations — EKS injects `cluster.*` fields automatically.

#### What `nodeadm init` Does Step-by-Step

Here's what happens inside `nodeadm init` when both phases run:

```
nodeadm init execution flow
│
├── PREFLIGHT
│   ├── Verify running as root
│   ├── Resolve config sources (IMDS user data, file paths, cached config)
│   └── Parse and merge all NodeConfig documents
│
├── ENRICHMENT
│   ├── Query IMDS for instance metadata
│   │   ├── Instance ID, type, AZ, region
│   │   ├── MAC address, private DNS name
│   │   └── Private IP address
│   ├── Fetch kubelet version from installed binary
│   ├── Set up proxy environment (if configured)
│   └── Validate merged NodeConfig against API schema
│
├── CONFIG PHASE (--skip run skips everything after this)
│   ├── Write containerd config
│   │   ├── Generate base config.toml from Go templates
│   │   ├── Merge user-provided TOML sections
│   │   └── Write to /etc/containerd/config.toml
│   ├── Write kubelet config
│   │   ├── Generate default KubeletConfiguration
│   │   ├── Apply instance-specific settings (max pods, resource reservations)
│   │   ├── Merge user-provided config overrides
│   │   ├── Write to /etc/kubernetes/kubelet/config.json
│   │   └── Write drop-in at /etc/kubernetes/kubelet/config.json.d/40-nodeadm.conf
│   ├── Write kubeconfig → /var/lib/kubelet/kubeconfig
│   ├── Write CA certificate to disk
│   ├── Configure ECR image credential provider
│   │   └── /etc/eks/image-credential-provider/config.json
│   ├── Write kubelet environment file
│   │   └── /etc/eks/kubelet/environment (contains NODEADM_KUBELET_ARGS)
│   └── Cache resolved config → /run/eks/nodeadm/config.json
│
└── RUN PHASE (--skip config skips everything before this)
    ├── Set up local disks (RAID, mount instance stores) if configured
    ├── Start containerd via systemd
    ├── Start kubelet via systemd
    └── Execute post-launch tasks
```

#### Max Pods Calculation

This is critical in EKS because the **VPC CNI** assigns real VPC IP addresses to every pod. The maximum number of pods is limited by how many IPs the instance's ENIs can hold.

The default formula:
```
Max Pods = (Number of ENIs × (IPv4 addresses per ENI - 1)) + 2
```

The `-1` accounts for the primary IP on each ENI (used by the ENI itself). The `+2` accounts for `kube-proxy` and `aws-node` pods that use host networking.

For example, an `m5.xlarge` has:
- 4 ENIs, 15 IPs per ENI
- Max pods = (4 × (15 - 1)) + 2 = **58**

nodeadm also supports a custom **CEL expression** via `kubelet.maxPodsExpression` for advanced overrides, with variables `default_enis`, `ips_per_eni`, and `max_pods` available.

> **Note**: With **prefix delegation** enabled, each ENI slot can hold a /28 prefix (16 IPs) instead of a single IP, significantly increasing the max pod count.

#### Kubelet Configuration Pipeline

nodeadm generates kubelet configuration through a multi-layered pipeline:

**1. Generate EKS-optimized defaults:**
- Webhook authentication and authorization
- Cgroup driver: `systemd` (matching AL2023's cgroupv2)
- Eviction thresholds: 100Mi memory, 10% disk, 5% inodes
- TLS cipher suites: 8 ECDHE cipher suites
- Feature gate: `RotateKubeletServerCertificate=true`

**2. Apply instance-specific settings:**
- Cluster DNS IP (derived from Service CIDR)
- Node IP based on cluster IP family (IPv4/IPv6)
- Cloud provider: external mode with `providerID`
- **Resource reservations** for CPU and memory (based on instance type)
- Max pods (from ENI calculation above)

**3. Merge user overrides:**
- `kubelet.config` fields are deep-merged (user values override defaults)
- `kubelet.flags` are appended (later flags override earlier ones)

**4. Write files:**

| File | Purpose |
|------|---------|
| `/etc/kubernetes/kubelet/config.json` | nodeadm-generated default config |
| `/etc/kubernetes/kubelet/config.json.d/40-nodeadm.conf` | User-provided overrides (drop-in) |
| `/var/lib/kubelet/kubeconfig` | API server connection config |
| `/etc/eks/kubelet/environment` | `NODEADM_KUBELET_ARGS` for systemd unit |
| `/etc/eks/image-credential-provider/config.json` | ECR credential provider config |

The kubelet systemd unit loads its environment from `/etc/eks/kubelet/environment` and starts with:
```
/usr/bin/kubelet $NODEADM_KUBELET_ARGS
```

#### Kubelet Kubeconfig

The generated kubeconfig tells kubelet how to authenticate with the EKS API server:

```yaml
apiVersion: v1
kind: Config
clusters:
- cluster:
    certificate-authority: /etc/kubernetes/pki/ca.crt
    server: https://ABCDEF1234.gr7.us-west-2.eks.amazonaws.com
  name: kubernetes
contexts:
- context:
    cluster: kubernetes
    user: kubelet
  name: kubelet
current-context: kubelet
users:
- name: kubelet
  user:
    exec:
      apiVersion: client.authentication.k8s.io/v1beta1
      command: /usr/bin/aws
      args:
        - eks
        - get-token
        - --cluster-name
        - my-cluster
        - --region
        - us-west-2
```

Kubelet uses `aws eks get-token` for authentication. This generates a short-lived token using the instance's **IAM Instance Profile** credentials — a pre-signed STS `GetCallerIdentity` URL that the EKS API server validates via the **AWS IAM Authenticator** in the control plane.

#### Config Merging

When multiple NodeConfig documents exist (injected by EKS + your user data + files in `/etc/eks/nodeadm.d/`), nodeadm merges them:

- **kubelet.flags**: Appended (later flags win)
- **kubelet.config**: Deep-merged as JSON (user values override)
- **containerd.config**: Deep-merged as TOML
- **All other fields**: Latter values override former

#### Key Files on an AL2023 Node

```
/usr/bin/nodeadm                                     # The nodeadm binary
/etc/eks/nodeadm.d/                                  # Drop-in dir for additional NodeConfig
/run/eks/nodeadm/config.json                         # Cached resolved config
/etc/containerd/config.toml                          # Generated containerd config
/etc/kubernetes/kubelet/config.json                  # Generated kubelet config
/etc/kubernetes/kubelet/config.json.d/40-nodeadm.conf  # User override drop-in
/var/lib/kubelet/kubeconfig                          # API server kubeconfig
/etc/eks/kubelet/environment                         # NODEADM_KUBELET_ARGS
/etc/eks/image-credential-provider/config.json       # ECR credential provider
```

> **Tip**: To inspect the final merged NodeConfig that nodeadm resolved during boot, read the cached config from the node:
> ```bash
> cat /run/eks/nodeadm/config.json
> ```
> This is useful for debugging — it shows the fully merged result of all NodeConfig sources (EKS-injected + your user data + any files in `/etc/eks/nodeadm.d/`).

### AL2 Bootstrap (Legacy): bootstrap.sh

For nodes running the older Amazon Linux 2 AMI, the bootstrap process uses `/etc/eks/bootstrap.sh` — a Bash script invoked via cloud-init user data:

```bash
/etc/eks/bootstrap.sh my-cluster \
  --b64-cluster-ca $B64_CLUSTER_CA \
  --apiserver-endpoint $API_SERVER_URL \
  --dns-cluster-ip $DNS_CLUSTER_IP \
  --kubelet-extra-args '--max-pods=110 --node-labels=env=prod'
```

The script does essentially the same thing as nodeadm but in a single-shot execution: query IMDS for instance metadata, calculate max pods from `/etc/eks/eni-max-pods.txt`, write the CA cert, generate kubeconfig and kubelet configuration, configure containerd, and start both daemons via systemd.

Key differences from nodeadm:

| Aspect | AL2 (bootstrap.sh) | AL2023 (nodeadm) |
|--------|---------------------|-------------------|
| Language | Bash script | Go binary |
| Config format | CLI flags | Declarative YAML (NodeConfig) |
| Kubelet customization | `--kubelet-extra-args` string | Structured `kubelet.config` + `kubelet.flags` |
| Containerd customization | Manual file edits | Inline TOML with merge semantics |
| Execution model | Single-shot script | Two-phase systemd services |
| Cluster discovery | Can auto-discover via `DescribeCluster` API | Requires explicit config (avoids API throttling at scale) |
| Config merging | Not supported | Multiple NodeConfig docs merged |
| Instance store setup | Manual | Built-in `localStorage` with RAID strategies |
| Cgroup version | cgroupv1 | cgroupv2 |

## Step 4: Kubelet Starts and TLS Bootstrap

When kubelet starts via systemd, it needs a way to authenticate with the API server. This is a chicken-and-egg problem — kubelet needs a certificate to talk to the API server, but it needs to talk to the API server to get a certificate.

### The TLS Bootstrap Flow

{{< mermaid >}}
sequenceDiagram
    participant K as Kubelet
    participant API as EKS API Server
    participant IAM as AWS IAM Authenticator
    participant CA as K8s Certificate Authority

    Note over K: Starts with bootstrap token (via aws eks get-token)
    K->>API: Authenticate with STS pre-signed URL token
    API->>IAM: Validate token
    IAM->>API: Map IAM Role to K8s identity via aws-auth ConfigMap
    API->>K: Authentication successful

    Note over K: Create Certificate Signing Request (CSR)
    K->>API: Submit CSR for kubelet client certificate
    API->>CA: Auto-approve CSR (EKS auto-approves node CSRs)
    CA->>API: Signed certificate
    API->>K: Return signed client certificate

    Note over K: Store certificate on disk
    Note over K: Subsequent requests use client certificate
{{< /mermaid >}}

### IAM Authentication Deep Dive

This is one of the most critical parts and a common source of issues. Here's how it works:

1. Kubelet calls `aws eks get-token`, which uses the EC2 instance's **IAM Instance Profile** credentials
2. This generates a **pre-signed STS GetCallerIdentity URL**, base64-encoded as a bearer token
3. Kubelet sends this token to the EKS API server
4. The **AWS IAM Authenticator** (running in the EKS control plane) decodes the token, calls STS, and gets back the IAM identity (ARN of the IAM Role)
5. The authenticator then looks up the **aws-auth ConfigMap** in `kube-system` to map the IAM Role to a Kubernetes identity

The `aws-auth` ConfigMap looks like this:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: aws-auth
  namespace: kube-system
data:
  mapRoles: |
    - rolearn: arn:aws:iam::123456789012:role/eks-node-role
      username: system:node:{{EC2PrivateDNSName}}
      groups:
        - system:bootstrappers
        - system:nodes
```

The `system:bootstrappers` group grants permission to create CSRs and the `system:nodes` group grants the standard kubelet permissions.

> **Note**: For Managed Node Groups, EKS automatically manages the `aws-auth` ConfigMap entry for the node IAM role. For self-managed nodes, you need to add this mapping manually. Newer EKS versions also support **EKS Access Entries** as an alternative to `aws-auth`.

### Certificate Signing

Once authenticated, kubelet creates a **CertificateSigningRequest** (CSR) object:

```
CSR Details:
  Common Name: system:node:<node-name>
  Organization: system:nodes
  Key Usage: Digital Signature, Key Encipherment
  Extended Key Usage: Client Authentication
```

In EKS, node CSRs are **auto-approved** by the control plane. The kubelet receives a signed client certificate, stores it at `/var/lib/kubelet/pki/`, and uses it for all subsequent API server communication. The kubelet also handles certificate rotation — it will request a new certificate before the current one expires.

## Step 5: Node Registration

Once kubelet has valid credentials, it registers itself with the API server by creating a `Node` object.

### What's in the Node Object?

```yaml
apiVersion: v1
kind: Node
metadata:
  name: ip-172-31-14-25.us-west-2.compute.internal
  labels:
    kubernetes.io/arch: amd64
    kubernetes.io/os: linux
    node.kubernetes.io/instance-type: m5.xlarge
    topology.kubernetes.io/zone: us-west-2a
    topology.kubernetes.io/region: us-west-2
    eks.amazonaws.com/nodegroup: my-node-group
    eks.amazonaws.com/capacityType: ON_DEMAND
  annotations:
    node.alpha.kubernetes.io/ttl: "0"
    volumes.kubernetes.io/controller-managed-attach-detach: "true"
spec:
  providerID: aws:///us-west-2a/i-0abc123def456
  taints:
    - key: node.kubernetes.io/not-ready
      effect: NoSchedule
status:
  capacity:
    cpu: "4"
    memory: 16384Mi
    pods: "58"
    ephemeral-storage: 20959212Ki
  allocatable:
    cpu: "3920m"
    memory: 15842Mi
    pods: "58"
    ephemeral-storage: 18242267924
  conditions:
    - type: Ready
      status: "False"
      reason: KubeletNotReady
      message: "container runtime network not ready: NetworkReady=false"
    - type: MemoryPressure
      status: "False"
    - type: DiskPressure
      status: "False"
    - type: PIDPressure
      status: "False"
  nodeInfo:
    kubeletVersion: v1.30.0-eks-036c24b
    containerRuntimeVersion: containerd://1.7.11
    osImage: Amazon Linux 2
    kernelVersion: 5.10.218-208.862.amzn2.x86_64
```

Key things to notice:

**Labels**: The kubelet populates labels with information from IMDS — instance type, AZ, region. EKS-specific labels like `eks.amazonaws.com/nodegroup` and `eks.amazonaws.com/capacityType` are also added.

**Capacity vs Allocatable**: Capacity is the total resource on the machine. Allocatable is what's available for pods after reserving resources for system daemons (kubelet, containerd, OS). 

**Taints**: The node starts with `node.kubernetes.io/not-ready:NoSchedule` taint. This prevents pods from being scheduled until the node is actually ready.

**Conditions**: The `Ready` condition is initially `False` with message `container runtime network not ready`. This is because the VPC CNI hasn't initialized yet.

### providerID

The `providerID` field (`aws:///us-west-2a/i-0abc123def456`) links the Kubernetes Node object to the actual EC2 instance. The **Cloud Controller Manager** (running in the EKS control plane) uses this to:

- Verify the instance exists
- Populate node addresses (internal IP, hostname)
- Detect when an instance is terminated and remove the node
- Add cloud-specific labels

## Step 6: DaemonSets Get Scheduled

Once the Node object exists in the API server, the Kubernetes scheduler notices and starts scheduling **DaemonSet** pods on it. The critical DaemonSets for EKS are:

### kube-proxy

`kube-proxy` runs as a DaemonSet in `kube-system`. It's responsible for implementing Kubernetes **Service** networking on the node.

When kube-proxy starts on the new node, it:

1. Watches the API server for Service and Endpoints/EndpointSlice objects
2. Programs **iptables rules** (or IPVS rules, depending on config) that translate ClusterIPs to actual pod IPs
3. These rules enable pods on this node to reach Services via their ClusterIPs

Without kube-proxy, pods on the node could not reach Services via their ClusterIPs.

```
kube-proxy iptables flow:

Pod → ClusterIP:Port
        │
        ▼
    KUBE-SERVICES chain (iptables)
        │
        ▼
    KUBE-SVC-XXXX chain (specific service)
        │
        ▼
    KUBE-SEP-YYYY chain (random endpoint selection via probability)
        │
        ▼
    DNAT to Pod IP:Port
```

For a deeper look at how kube-proxy programs iptables chains, see the [iptables deep dive in my DNS packet post](/2025/06/life-of-dns-packet-in-k8s/#iptables-deep-dive-how-kube-proxy-routes-service-traffic).

### aws-node (VPC CNI Plugin)

The `aws-node` DaemonSet runs the **Amazon VPC CNI** plugin. This is what makes EKS networking unique. Here's what happens when it starts on the new node:

#### IPAMD (IP Address Management Daemon) Initialization

1. **Discover existing ENIs**: The plugin queries IMDS and the EC2 API to find ENIs attached to the instance
2. **Warm pool setup**: It pre-allocates IPs by:
   - Attaching additional ENIs to the instance (via EC2 `AttachNetworkInterface` API)
   - Assigning secondary private IPs to each ENI (via EC2 `AssignPrivateIpAddresses` API)
3. **Write CNI config**: It writes the CNI configuration to `/etc/cni/net.d/10-aws.conflist`

```
VPC CNI IP Warm Pool:

Instance (m5.xlarge)
├── ENI-0 (Primary)
│   ├── 172.31.14.25 (primary - instance IP, not for pods)
│   ├── 172.31.14.30 (secondary - available for pods)
│   ├── 172.31.14.31 (secondary - available for pods)
│   └── ... (up to 14 secondary IPs)
├── ENI-1 (Secondary, attached by VPC CNI)
│   ├── 172.31.14.50 (primary - ENI IP, not for pods)
│   ├── 172.31.14.51 (secondary - available for pods)
│   └── ...
└── ENI-2 (Secondary)
    └── ...
```

The warm pool configuration is controlled by environment variables:
- `WARM_ENI_TARGET`: Number of warm ENIs to keep (default: 1)
- `WARM_IP_TARGET`: Number of warm IPs to keep
- `MINIMUM_IP_TARGET`: Minimum number of IPs to keep

#### CNI Binary

When a pod is scheduled on this node, kubelet calls the CNI binary (`/opt/cni/bin/aws-cni`) which:

1. Takes an IP from the warm pool
2. Creates a **veth pair** — one end in the pod's network namespace, one on the host
3. Configures the pod's network namespace with the IP, default route, etc.
4. Adds a host route on the node pointing to the pod IP via the veth interface

### Other DaemonSets

Depending on your cluster configuration, other DaemonSets may also be scheduled:

- **eks-pod-identity-agent**: Enables EKS Pod Identity (newer alternative to IRSA)
- **ebs-csi-node**: CSI driver for EBS volumes
- **amazon-cloudwatch-agent**: If you've enabled Container Insights
- **node-local-dns**: If you've set up NodeLocal DNSCache

## Step 7: Node Becomes Ready

The node transitions to `Ready` when **all** of the following conditions are met:

### The Ready Condition Check

Kubelet continuously evaluates node conditions and reports them to the API server (default every 10 seconds via `--node-status-update-frequency`):

{{< mermaid >}}
flowchart TD
    A[Kubelet starts] --> B{Container runtime\nrunning?}
    B -->|No| C[Ready=False\nreason: ContainerRuntimeNotReady]
    B -->|Yes| D{CNI plugin\nconfigured?}
    D -->|No| E[Ready=False\nreason: NetworkNotReady]
    D -->|Yes| F{Sufficient\nresources?}
    F -->|No| G[MemoryPressure/DiskPressure\nset to True]
    F -->|Yes| H[Ready=True]
    H --> I[Remove not-ready taint]
    I --> J[Node accepts pod scheduling]

    style H fill:#90EE90,stroke:#333,color:#000
    style J fill:#90EE90,stroke:#333,color:#000
{{< /mermaid >}}

The key transition is when the VPC CNI writes the CNI configuration file to `/etc/cni/net.d/`. Kubelet watches this directory — once a valid CNI config exists, it flips the network status to ready.

### Timeline of Events

Let's look at a typical timeline from instance launch to `Ready`:

```
T+0s     EC2 RunInstances API call
T+10-30s Instance enters "running" state
T+30-35s nodeadm-config phase: write configs (no daemons started yet)
T+35-40s cloud-init: user shell scripts execute
T+40-45s nodeadm-run phase: start containerd + kubelet
T+42-50s kubelet authenticates with API server
T+44-52s Node object created (Ready=False, NotReady taint)
T+45-55s kube-proxy pod scheduled and running
T+45-60s aws-node (VPC CNI) pod scheduled
T+50-65s VPC CNI attaches ENIs, allocates IPs
T+55-70s CNI config written → kubelet detects → Ready=True
T+55-70s NotReady taint removed
T+55-70s Regular pods can now be scheduled
```

Total time: roughly **55-70 seconds** from EC2 API call to accepting workloads. This can vary based on:
- Instance type (larger instances take longer to boot)
- AMI cache (first boot in an AZ may need to copy the AMI snapshot)
- API throttling (if many nodes are launching simultaneously)
- VPC CNI IP allocation (depends on subnet IP availability)

### What Can Go Wrong?

Here are common reasons a node gets stuck in `NotReady`:

| Symptom | Cause | Fix |
|---------|-------|-----|
| Node never appears | IAM role not in `aws-auth` ConfigMap | Add role mapping to `aws-auth` or create an EKS Access Entry |
| `NetworkNotReady` | VPC CNI can't allocate IPs | Check subnet has available IPs, check Security Group rules, check `aws-node` pod logs |
| `KubeletNotReady` | kubelet can't reach API server | Check Security Group allows 443 to EKS endpoint, check NACLs |
| Node appears then disappears | EC2 instance failing health checks | Check instance system log via EC2 console |
| `Unauthorized` in kubelet logs | Token authentication failed | Verify IAM Instance Profile is attached and has correct policies |
| Node stuck in `NotReady` | containerd not starting | SSH/SSM into node, check `systemctl status containerd` |


## Managed Node Groups vs Karpenter: Key Differences

Since these are the two primary ways to manage nodes, here's how their node lifecycle differs:

| Aspect | Managed Node Groups | Karpenter |
|---|---|---|
| Scaling trigger | Cluster Autoscaler increases ASG desired capacity | Karpenter controller calls EC2 Fleet directly |
| Instance selection | Mostly fixed by Launch Template / node group settings | Dynamic, chosen from NodePool + EC2NodeClass based on pod constraints |
| Speed | Typically slower due to ASG reconciliation overhead | Typically faster due to direct provisioning path |
| Node lifecycle | ASG handles replacement and rolling updates | Karpenter handles consolidation, drift, and disruption policies |
| Bootstrap | EKS-managed bootstrap/user data for MNG defaults | Bootstrap is driven by Karpenter config (NodeClass/userData) |

## Full Sequence Diagram

Putting it all together:

{{< mermaid >}}
sequenceDiagram
    participant CA as Scaling Trigger<br>(CA/Karpenter)
    participant EC2 as EC2 Service
    participant Inst as EC2 Instance
    participant API as EKS API Server
    participant Sched as Scheduler

    CA->>EC2: Launch instance
    EC2->>Inst: Boot instance with EKS AMI

    Note over Inst: nodeadm-config phase runs
    Note over Inst: cloud-init runs (user scripts)
    Note over Inst: nodeadm-run phase starts containerd + kubelet

    Inst->>API: Authenticate (IAM → aws-auth → K8s identity)
    API->>Inst: Auth OK + CSR signed

    Inst->>API: Create Node object (Ready=False)
    Note over API: Node exists with NotReady taint

    Sched->>Inst: Schedule kube-proxy DaemonSet pod
    Sched->>Inst: Schedule aws-node DaemonSet pod

    Note over Inst: kube-proxy programs iptables
    Note over Inst: VPC CNI attaches ENIs
    Note over Inst: VPC CNI allocates IPs
    Note over Inst: VPC CNI writes CNI config

    Inst->>API: Update Node status (Ready=True)
    Note over API: NotReady taint removed

    Sched->>Inst: Schedule regular workload pods
{{< /mermaid >}}

## Summary

The journey from EC2 API call to a `Ready` EKS node involves a coordinated dance between multiple AWS services and Kubernetes components:

1. **EC2** provisions the infrastructure (instance, ENI, EBS)
2. **nodeadm** (AL2023) or **bootstrap.sh** (AL2) configures the instance as a Kubernetes node
3. **IAM authentication** bridges the AWS and Kubernetes identity systems
4. **kubelet** registers the node and manages its lifecycle
5. **VPC CNI** brings up pod networking with real VPC IPs
6. **kube-proxy** enables Service networking
7. The node declares `Ready` and workloads flow in

Understanding this lifecycle helps when debugging node join failures, optimizing scale-up latency, or making architectural decisions about your EKS cluster.

## What's Next

This post covered the end-to-end journey but intentionally kept some topics at a high level. In future posts, we'll deep dive into:

- **Kubelet authentication to the API server** — the full flow of IAM Instance Profile → STS pre-signed URL → AWS IAM Authenticator → Kubernetes RBAC, and how certificate rotation works
- **EKS Access Entries** — the newer alternative to the `aws-auth` ConfigMap, how it works, and why AWS is moving away from ConfigMap-based identity mapping
- **Cloud Controller Manager (CCM)** — what exactly it updates on the Node object (addresses, labels, instance metadata), how it detects terminated instances, and its role in node lifecycle management
- **EKS Pod Identity Agent** — how it replaces IRSA (IAM Roles for Service Accounts), the token exchange mechanism, and why it's simpler to operate
- **EBS CSI Node Driver** — how it manages volume attach/detach on the node, the interaction with kubelet's volume manager, and how staging and publishing works for block storage
