---
author: ["Vivek Bhadauria"]
title: "How to setup NodeLocalDNS in EKS"
date: 2024-06-01
tags: [DNS, K8s]
ShowToc: false
---

In this post, we are going to setup NodeLocalDNS in our EKS cluster. There is a clear guide on [kubernetes.io](https://kubernetes.io/docs/tasks/administer-cluster/nodelocaldns/) on how to do so, I am writing this post for my reference with a bunch of k8s related commands to validate that its working as expected.

I am assuming that you have a EKS cluster running. Before setting up NodeLocalDNS, lets make a DNS query from a pod and see where its getting answered from

> Nodes in cluster
```
viveksb007@Viveks-MacBook-Air-2  ~  kubectl get nodes -o wide

NAME                                          STATUS   ROLES    AGE    VERSION               INTERNAL-IP     EXTERNAL-IP     OS-IMAGE         KERNEL-VERSION                  CONTAINER-RUNTIME
ip-172-31-14-25.us-west-2.compute.internal    Ready    <none>   101m   v1.30.0-eks-036c24b   172.31.14.25    <SOME_IP>   Amazon Linux 2   5.10.218-208.862.amzn2.x86_64   containerd://1.7.11
ip-172-31-28-132.us-west-2.compute.internal   Ready    <none>   101m   v1.30.0-eks-036c24b   172.31.28.132   <SOME_IP>   Amazon Linux 2   5.10.218-208.862.amzn2.x86_64   containerd://1.7.11
ip-172-31-53-182.us-west-2.compute.internal   Ready    <none>   101m   v1.30.0-eks-036c24b   172.31.53.182   <SOME_IP>    Amazon Linux 2   5.10.218-208.862.amzn2.x86_64   containerd://1.7.11
```

> Pods in Cluster
```
 viveksb007@Viveks-MacBook-Air-2  ~  kubectl get pods -A -o wide

NAMESPACE     NAME                           READY   STATUS    RESTARTS   AGE    IP              NODE                                          NOMINATED NODE   READINESS GATES
kube-system   aws-node-7wct6                 2/2     Running   0          97m    172.31.53.182   ip-172-31-53-182.us-west-2.compute.internal   <none>           <none>
kube-system   aws-node-djhfz                 2/2     Running   0          97m    172.31.28.132   ip-172-31-28-132.us-west-2.compute.internal   <none>           <none>
kube-system   aws-node-qgv2f                 2/2     Running   0          97m    172.31.14.25    ip-172-31-14-25.us-west-2.compute.internal    <none>           <none>
kube-system   coredns-787cb67946-95wvs       1/1     Running   0          106m   172.31.29.79    ip-172-31-28-132.us-west-2.compute.internal   <none>           <none>
kube-system   coredns-787cb67946-98688       1/1     Running   0          106m   172.31.51.70    ip-172-31-53-182.us-west-2.compute.internal   <none>           <none>
kube-system   eks-pod-identity-agent-4j9mr   1/1     Running   0          97m    172.31.14.25    ip-172-31-14-25.us-west-2.compute.internal    <none>           <none>
kube-system   eks-pod-identity-agent-jfncq   1/1     Running   0          97m    172.31.53.182   ip-172-31-53-182.us-west-2.compute.internal   <none>           <none>
kube-system   eks-pod-identity-agent-qbdn6   1/1     Running   0          97m    172.31.28.132   ip-172-31-28-132.us-west-2.compute.internal   <none>           <none>
kube-system   kube-proxy-5wxkx               1/1     Running   0          102m   172.31.28.132   ip-172-31-28-132.us-west-2.compute.internal   <none>           <none>
kube-system   kube-proxy-wx4ds               1/1     Running   0          102m   172.31.14.25    ip-172-31-14-25.us-west-2.compute.internal    <none>           <none>
kube-system   kube-proxy-zjcrl               1/1     Running   0          102m   172.31.53.182   ip-172-31-53-182.us-west-2.compute.internal   <none>           <none>
```

We can see that there are 2 coredns pods:
1. `coredns-787cb67946-95wvs` -> Has private ip `172.31.29.79` and running on node `ip-172-31-28-132.us-west-2.compute.internal`
2. `coredns-787cb67946-98688` -> Has private ip `172.31.51.70` and running on node `ip-172-31-53-182.us-west-2.compute.internal`

These coredns pods don't have `log` plugin enabled by default, so we need to add `log` plugin to `Corefile` to enable DNS request logging. Use following command to enable logging

```
kubectl -n kube-system edit configmap coredns

Add log plugin and save as shown below

Corefile: |
    .:53 {
        log    # Enabling CoreDNS Logging
        errors
        health
        kubernetes cluster.local in-addr.arpa ip6.arpa {
          pods insecure
          upstream
          fallthrough in-addr.arpa ip6.arpa
        }
    }

Ref - https://repost.aws/knowledge-center/eks-dns-failure
```

Once `Corefile` is updated, wait for updated file to be re-loaded or restart the pods.

Create a temporary pod to make `dig` requests

```
viveksb007@Viveks-MacBook-Air-2  ~  kubectl run tmp-shell --rm -i --tty --image nicolaka/netshoot

-------------

tmp-shell  ~  ifconfig
eth0      Link encap:Ethernet  HWaddr 72:89:C4:12:F1:E4
          inet addr:172.31.5.75  Bcast:0.0.0.0  Mask:255.255.255.255
          inet6 addr: fe80::7089:c4ff:fe12:f1e4/64 Scope:Link
          UP BROADCAST RUNNING MULTICAST  MTU:9001  Metric:1
          RX packets:6 errors:0 dropped:0 overruns:0 frame:0
          TX packets:10 errors:0 dropped:0 overruns:0 carrier:0
          collisions:0 txqueuelen:0
          RX bytes:521 (521.0 B)  TX bytes:791 (791.0 B)

lo        Link encap:Local Loopback
          inet addr:127.0.0.1  Mask:255.0.0.0
          inet6 addr: ::1/128 Scope:Host
          UP LOOPBACK RUNNING  MTU:65536  Metric:1
          RX packets:0 errors:0 dropped:0 overruns:0 frame:0
          TX packets:0 errors:0 dropped:0 overruns:0 carrier:0
          collisions:0 txqueuelen:1000
          RX bytes:0 (0.0 B)  TX bytes:0 (0.0 B)

-------------

tmp-shell  ~  dig google.com

; <<>> DiG 9.18.25 <<>> google.com
;; global options: +cmd
;; Got answer:
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 24105
;; flags: qr rd ra; QUERY: 1, ANSWER: 1, AUTHORITY: 0, ADDITIONAL: 1

;; OPT PSEUDOSECTION:
; EDNS: version: 0, flags:; udp: 1232
; COOKIE: 1c0a7f8e94acd850 (echoed)
;; QUESTION SECTION:
;google.com.			IN	A

;; ANSWER SECTION:
google.com.		30	IN	A	142.251.33.78

;; Query time: 4 msec
;; SERVER: 10.100.0.10#53(10.100.0.10) (UDP)
;; WHEN: Sat Jun 22 20:16:39 UTC 2024
;; MSG SIZE  rcvd: 77

```

See CoreDNS logs

```
kubectl logs --follow -n kube-system --selector 'k8s-app=kube-dns'

[INFO] 172.31.5.75:33661 - 34316 "A IN google.com. udp 51 false 1232" NOERROR qr,rd,ra 54 0.001122099s
[INFO] 172.31.5.75:54626 - 24105 "A IN google.com. udp 51 false 1232" NOERROR qr,rd,ra 54 0.001087393s
[INFO] 172.31.5.75:59855 - 64074 "A IN viveksb007.github.com. udp 62 false 1232" NOERROR qr,rd,ra 218 0.002982673s

```

You can check on which node your temp pod is running 
```
 viveksb007@Viveks-MacBook-Air-2  ~  kubectl get pods -A -o wide

NAMESPACE     NAME                           READY   STATUS    RESTARTS   AGE    IP              NODE                                          NOMINATED NODE   READINESS GATES
default       tmp-shell                      1/1     Running   0          39s    172.31.7.90     ip-172-31-14-25.us-west-2.compute.internal    <none>           <none>
```

`tmp-shell` -> Has private ip `172.31.5.75` and running on node `ip-172-31-14-25.us-west-2.compute.internal`

From above logs, we can see that all requests from `tmp-shell` pod IP `172.31.5.75` are coming to CoreDNS pods. This verifies that DNS requests from 1 Node is going to another Node for DNS resolution. Now we will setup NodeLocalDNS and verify again that DNS queries are going via the node-local-dns pod on the same node.


## Setting up NodeLocalDNS in EKS cluster

{{< figure src="/img/nodelocaldns.svg" alt="Node Local DNS" align="center" attr="DNS Query path with NodeLocalDNS enabled (credits: kubernetes.io)">}}

To set up NodeLocalDNS in your EKS cluster:

1. Create a yaml file named “nodelocaldns.yaml” and copy content from [github nodelocaldns.yaml](https://github.com/kubernetes/kubernetes/blob/master/cluster/addons/dns/nodelocaldns/nodelocaldns.yaml)
2. By default, there will be no logs, if you want dns logs add “log” plugin in CoreDNS Corefile config section. See example below
```
.:53 {
    errors
    cache 30
    reload
    log
    loop
    bind __PILLAR__LOCAL__DNS__ __PILLAR__DNS__SERVER__
    forward . __PILLAR__UPSTREAM__SERVERS__
    prometheus :9253
}
```
3. Figure out the values for below variables and substitute in the yaml file

```
kubedns=`kubectl get svc kube-dns -n kube-system -o jsonpath={.spec.clusterIP}`
domain=<cluster-domain> 
localdns=<node-local-address> 
```

```
__PILLAR__LOCAL__DNS__ => localdns (169.254.20.10)
__PILLAR__DNS__DOMAIN__ => domain (cluster.local by default)
__PILLAR__DNS__SERVER__ => kubedns 
```


> Difference of kube-proxy running in `IPTABLES` mode vs `IPVS` mode

You can refer K8s resource to understand the difference b/w running kube-proxy in `IPTABLES` or `IPVS` mode. https://github.com/kubernetes/kubernetes/blob/master/pkg/proxy/ipvs/README.md#ipvs-vs-iptables

Now apply `nodelocaldns.yaml` change to your cluster.

```
kubectl create -f nodelocaldns.yaml
```

Verify NodeLocalDNS pods are running on each node in kube-system namespace

```
kubectl get pods -A -o wide

NAMESPACE     NAME                           READY   STATUS    RESTARTS   AGE     IP              NODE                                          NOMINATED NODE   READINESS GATES
...
kube-system   node-local-dns-4z8zm           1/1     Running   0          14s     172.31.53.182   ip-172-31-53-182.us-west-2.compute.internal   <none>           <none>
kube-system   node-local-dns-dlvn8           1/1     Running   0          14s     172.31.14.25    ip-172-31-14-25.us-west-2.compute.internal    <none>           <none>
kube-system   node-local-dns-tsvw6           1/1     Running   0          14s     172.31.28.132   ip-172-31-28-132.us-west-2.compute.internal   <none>           <none>
```

Run temp shell and make a dig command (my `tmp-shell` pod was already running on node `ip-172-31-14-25.us-west-2.compute.internal`, so I should see DNS queries from tmp-shell pod in node-local-dns pod running on that same node which is `node-local-dns-dlvn8`)

```
 tmp-shell  ~  dig google.com

; <<>> DiG 9.18.25 <<>> google.com
;; global options: +cmd
;; Got answer:
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 6130
;; flags: qr rd ra; QUERY: 1, ANSWER: 1, AUTHORITY: 0, ADDITIONAL: 1

;; OPT PSEUDOSECTION:
; EDNS: version: 0, flags:; udp: 1232
; COOKIE: b3a9644cb8f3472c (echoed)
;; QUESTION SECTION:
;google.com.			IN	A

;; ANSWER SECTION:
google.com.		30	IN	A	142.250.217.110

;; Query time: 0 msec
;; SERVER: 10.100.0.10#53(10.100.0.10) (UDP)
;; WHEN: Sat Jun 22 21:42:45 UTC 2024
;; MSG SIZE  rcvd: 77
```

```
kubectl --namespace kube-system logs node-local-dns-dlvn8

...
[INFO] 172.31.5.75:58112 - 59886 "A IN viveksb007.github.com. udp 62 false 1232" NOERROR qr,rd,ra 218 0.003248656s
[INFO] 172.31.5.75:35665 - 64822 "A IN amazon.com. udp 51 false 1232" NOERROR qr,rd,ra 106 0.001616388s
[INFO] 172.31.5.75:34295 - 54596 "A IN amazonaws.com. udp 54 false 1232" NOERROR qr,rd,ra 118 0.001439416s
[INFO] 172.31.5.75:36807 - 6130 "A IN google.com. udp 51 false 1232" NOERROR qr,rd,ra 54 0.001548313s
```

Looking at client Ip `172.31.5.75` we can say that these DNS queries to `node-local-dns` pod are coming from  `tmp-shell` pod.

References

- https://kubernetes.io/docs/tasks/administer-cluster/nodelocaldns/
- https://cloud.google.com/kubernetes-engine/docs/how-to/nodelocal-dns-cache
