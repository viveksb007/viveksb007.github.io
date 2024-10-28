---
author: ["Vivek Bhadauria"]
title: "Gvisor - User space HTTP Server and Client"
date: 2024-10-26
tags: [gvisor, netstack]
ShowToc: false
---

This post is a follow-up from previous post [Gvisor - User space TCP Server and Client](https://viveksb007.github.io/2024/10/gvisor-userspace-tcp-server-client/). In this post, we are going to build user space HTTP server and client on top of TCP server and client that we created in previous post.

To take a look at complete code for this, refer - https://github.com/viveksb007/gvisor-experiment/blob/main/cmd/userspace-http/main.go

## Creating a Http Server
We are using GoLang standard `net/http` package to build the HTTP server. We can create the user space TCP listener and pass that to `http.Serve()` method. gvisor implementation adheres the GoLang std interfaces. 

```go
func startServer(s *stack.Stack, serverAddress tcpip.Address) {
	tcpListener, e := gonet.ListenTCP(s, tcpip.FullAddress{
		Addr: serverAddress,
		Port: 8080,
	}, ipv4.ProtocolNumber)
	if e != nil {
		log.Fatalf("NewListener() = %v", e)
	}

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		log.Printf("Received request from client %v\n", r.RemoteAddr)
		fmt.Fprintf(w, "yo man")
	})

	log.Println("Starting http server on port 8080")
	go func() {
		if err := http.Serve(tcpListener, nil); err != nil {
			log.Fatalf("Failed to serve: %v", err)
		}
	}()
}
```

## Creating a Http Client
For HTTP client also, we are simply using userspace TCP connection to implement the `RoundTripper` interface. 

> GoDoc: RoundTripper is an interface representing the ability to execute a single HTTP transaction, obtaining the [Response] for a given [Request].

We are making a `Get` request to above HTTP server created.

```go
func startClient(s *stack.Stack, serverAddress tcpip.Address) {
	remoteAddress := tcpip.FullAddress{Addr: serverAddress, Port: 8080}

	testConn, err := connect(s, remoteAddress)
	if err != nil {
		log.Fatal("Unable to connect: ", err)
	}

	conn := gonet.NewTCPConn(testConn.wq, testConn.ep)
	defer conn.Close()

	log.Printf("TCP connection to %v is successful\n", conn.RemoteAddr().String())

	client := &http.Client{
		Transport: &customRoundTripper{conn: conn},
	}

	resp, err1 := client.Get(fmt.Sprintf("http://%s:8080", serverAddress.WithPrefix().Address.String()))
	if err1 != nil {
		log.Fatalf("Failed to send HTTP request: %v", err1)
	}
	defer resp.Body.Close()

	body, err1 := io.ReadAll(resp.Body)
	if err1 != nil {
		log.Fatalf("Failed to read HTTP response: %v", err1)
	}

	log.Printf("Received response: %s\n", string(body))
}
```

## Communication b/w Http client and server
Running complete program to run HTTP server and making a few requests using HTTP client.

```
go run cmd/userspace-http/main.go

---- OUTPUT ----

2024/10/27 20:53:11 Starting http server on port 8080
2024/10/27 20:53:11 {0 192.168.1.1 35597 } <nil>
2024/10/27 20:53:11 {0 192.168.1.1 8080 } <nil>
2024/10/27 20:53:11 TCP connection to 192.168.1.1:8080 is successful
2024/10/27 20:53:11 Received request from client 192.168.1.1:35597
2024/10/27 20:53:11 Received response: yo man
2024/10/27 20:53:11 {0 192.168.1.1 35598 } <nil>
2024/10/27 20:53:11 {0 192.168.1.1 8080 } <nil>
2024/10/27 20:53:11 TCP connection to 192.168.1.1:8080 is successful
2024/10/27 20:53:11 Received request from client 192.168.1.1:35598
2024/10/27 20:53:11 Received response: yo man
2024/10/27 20:53:11 {0 192.168.1.1 35599 } <nil>
2024/10/27 20:53:11 {0 192.168.1.1 8080 } <nil>
2024/10/27 20:53:11 TCP connection to 192.168.1.1:8080 is successful
2024/10/27 20:53:11 Received request from client 192.168.1.1:35599
2024/10/27 20:53:11 Received response: yo man
```

Github Repo - https://github.com/viveksb007/gvisor-experiment