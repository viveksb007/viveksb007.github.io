---
author: ["Vivek Bhadauria"]
title: "Gvisor - User space TCP Server and Client"
date: 2024-10-15
tags: [gvisor, netstack]
ShowToc: false
---

In this post, we will see how to create a simple TCP Server and TCP Client in user space network stack. Both server and client will be in the same network.

To take a look at complete code for this, refer - https://github.com/viveksb007/gvisor-experiment/blob/main/cmd/userspace-tcpip/main.go

## Creating a Network stack
In this section, we are creating a Network stack specifying which protocols it needs to support, assigning addresses to the network and adding default route table.

> TIP - you can extend this by adding support for IPv6 and UDP as an exercise

``` go
s := stack.New(stack.Options{
    NetworkProtocols:   []stack.NetworkProtocolFactory{ipv4.NewProtocol},
    TransportProtocols: []stack.TransportProtocolFactory{tcp.NewProtocol},
})

if err := s.CreateNIC(1, loopback.New()); err != nil {
    log.Fatalf("Failed to create NIC: %v", err)
}

protocolAddr := tcpip.ProtocolAddress{
    Protocol: ipv4.ProtocolNumber,
    AddressWithPrefix: tcpip.AddressWithPrefix{
        Address:   tcpip.AddrFromSlice(net.IPv4(192, 168, 1, 1).To4()),
        PrefixLen: 32,
    },
}

if err := s.AddProtocolAddress(NICID, protocolAddr, stack.AddressProperties{}); err != nil {
    log.Fatalf("Failed to add protocol address: %v", err)
}

s.SetRouteTable([]tcpip.Route{
    {
        NIC:         NICID,
        Destination: header.IPv4EmptySubnet,
    },
})
```

## Creating a TCP Server
The stack that we created above has only 1 IPv4 address as we have specified prefix length as 32, so address is `192.168.1.1`. We are going to listen on port `8080` of this address. `tcpListener.Accept()` returns standard `net.Conn` object of Go `net` pkg, so from this point onwards it can be handled as regular Go TCP connection.

```go
tcpListener, e := gonet.ListenTCP(s, tcpip.FullAddress{
    Addr: serverAddress,
    Port: 8080,
}, ipv4.ProtocolNumber)
if e != nil {
    log.Fatalf("err in creating TCP listener = %v", e)
}

go func() {
    for {
        c, err := tcpListener.Accept()
        if err != nil {
            log.Fatalf("err in tcpListener Accept() = %v", err)
        }
        go handleConnection(c)
    }
}()
```

## Creating a TCP Client
At this point, we have a TCP server listening on `192.168.1.1:8080` in userspace network stack (this network can't be reached by kernel `tcp_connect` calls, you can validate this by using `nc` to try to connect to this address in separate terminal). Refer [Appendix](#appendix) to see how to use `nc` to validate this.

We can connect to this tcp server in the same `stack` we created in first section. 

```go
func startClient(s *stack.Stack, serverAddress tcpip.Address) {
	remoteAddress := tcpip.FullAddress{Addr: serverAddress, Port: 8080}

	testConn, err := connect(s, remoteAddress)
	if err != nil {
		log.Fatal("Unable to connect: ", err)
	}

	conn := gonet.NewTCPConn(testConn.wq, testConn.ep)
	defer conn.Close()

	message := "Hello, TCP Server!"
	_, err1 := conn.Write([]byte(message))
	if err1 != nil {
		log.Fatalf("Failed to write to connection: %v", err)
	}

	buf := make([]byte, 1024)
	n, err1 := conn.Read(buf)
	if err1 != nil {
		log.Fatalf("Failed to read from connection: %v", err)
	}

	log.Printf("Received response: %s\n", string(buf[:n]))
}

type testConnection struct {
	wq *waiter.Queue
	ep tcpip.Endpoint
}

func connect(s *stack.Stack, addr tcpip.FullAddress) (*testConnection, tcpip.Error) {
	wq := &waiter.Queue{}
	ep, err := s.NewEndpoint(tcp.ProtocolNumber, ipv4.ProtocolNumber, wq)
	if err != nil {
		return nil, err
	}

	entry, ch := waiter.NewChannelEntry(waiter.WritableEvents)
	wq.EventRegister(&entry)

	err = ep.Connect(addr)
	if _, ok := err.(*tcpip.ErrConnectStarted); ok {
		<-ch
		err = ep.LastError()
	}
	if err != nil {
		return nil, err
	}

	log.Println(ep.GetLocalAddress())
	log.Println(ep.GetRemoteAddress())

	return &testConnection{wq, ep}, nil
}
```

## Communication b/w TCP client and server
Running complete program to create TCP server and connect to it few times to exchange some data. TCP server is logging the remote and local addr for each connection its receiving. Both are on same IP `192.168.1.1` which we assigned to the stack above. We can assign a range to the stack like `192.168.1.1/24` and have server listen on other addresses like `192.168.1.2`.

```
go run cmd/userspace-tcpip/main.go

---- OUTPUT ----

2024/10/19 20:07:28 Starting TCP server
2024/10/19 20:07:28 {0 192.168.1.1 35076 } <nil>
2024/10/19 20:07:28 {0 192.168.1.1 8080 } <nil>
2024/10/19 20:07:28 Remote Addr 192.168.1.1:35076, Local Address 192.168.1.1:8080
2024/10/19 20:07:28 Received message on Server: Hello, TCP Server!
2024/10/19 20:07:28 Received response: Hey TCP Client
2024/10/19 20:07:28 {0 192.168.1.1 35077 } <nil>
2024/10/19 20:07:28 {0 192.168.1.1 8080 } <nil>
2024/10/19 20:07:28 Remote Addr 192.168.1.1:35077, Local Address 192.168.1.1:8080
2024/10/19 20:07:28 Received message on Server: Hello, TCP Server!
2024/10/19 20:07:28 Received response: Hey TCP Client
2024/10/19 20:07:28 {0 192.168.1.1 35078 } <nil>
2024/10/19 20:07:28 {0 192.168.1.1 8080 } <nil>
2024/10/19 20:07:28 Remote Addr 192.168.1.1:35078, Local Address 192.168.1.1:8080
2024/10/19 20:07:28 Received message on Server: Hello, TCP Server!
2024/10/19 20:07:28 Received response: Hey TCP Client
``` 

## Appendix
Using `nc` to do tcp handshake with server. We can do tcp handshake with google server and validate by looking at the packets.

1. find `google.com` IP using dig
```shell
viveksb007@Viveks-MacBook-Air-2  ~  dig google.com

; <<>> DiG 9.10.6 <<>> google.com
;; global options: +cmd
;; Got answer:
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 24451
;; flags: qr rd ra; QUERY: 1, ANSWER: 6, AUTHORITY: 0, ADDITIONAL: 1

;; OPT PSEUDOSECTION:
; EDNS: version: 0, flags:; udp: 512
;; QUESTION SECTION:
;google.com.			IN	A

;; ANSWER SECTION:
google.com.		188	IN	A	172.253.63.101
google.com.		188	IN	A	172.253.63.139
google.com.		188	IN	A	172.253.63.138
google.com.		188	IN	A	172.253.63.100
google.com.		188	IN	A	172.253.63.113
google.com.		188	IN	A	172.253.63.102

;; Query time: 21 msec
;; SERVER: 2001:558:feed::1#53(2001:558:feed::1)
;; WHEN: Sat Oct 19 19:47:40 EDT 2024
;; MSG SIZE  rcvd: 135
```
2. starting tcpdump to track tcp handshake packets using `sudo tcpdump -i any host 172.253.63.101 -nn -vv`
3. Using `nc` to connect to google server - `nc <IP> <PORT>`, you can see SYN `[S]`, SYN-ACK `[S.]` and ACK `[.]` packets in below logs

```
viveksb007@Viveks-MacBook-Air-2  ~  nc 172.253.63.101 80


viveksb007@Viveks-MacBook-Air-2  ~  sudo tcpdump -i any host 172.253.63.101 -nn -vv
tcpdump: data link type PKTAP
tcpdump: listening on any, link-type PKTAP (Apple DLT_PKTAP), snapshot length 524288 bytes
19:50:10.321331 IP (tos 0x0, ttl 64, id 0, offset 0, flags [DF], proto TCP (6), length 64)
    192.168.0.3.64320 > 172.253.63.101.80: Flags [S], cksum 0xe5ec (correct), seq 3558187080, win 65535, options [mss 1460,nop,wscale 6,nop,nop,TS val 2421662650 ecr 0,sackOK,eol], length 0
19:50:10.340818 IP (tos 0x0, ttl 119, id 0, offset 0, flags [DF], proto TCP (6), length 60)
    172.253.63.101.80 > 192.168.0.3.64320: Flags [S.], cksum 0x1ea9 (correct), seq 790977185, ack 3558187081, win 65535, options [mss 1412,sackOK,TS val 2539239237 ecr 2421662650,nop,wscale 8], length 0
19:50:10.340987 IP (tos 0x0, ttl 64, id 0, offset 0, flags [DF], proto TCP (6), length 52)
    192.168.0.3.64320 > 172.253.63.101.80: Flags [.], cksum 0x452a (correct), seq 1, ack 1, win 2056, options [nop,nop,TS val 2421662670 ecr 2539239237], length 0
```

Github Repo - https://github.com/viveksb007/gvisor-experiment
