---
layout: post
title: "Tinkering with Xms in JVM"
date: 2020-05-09
tags: [JVM, Java]
comments: true
---

In this post, I am going to share my observation after playing with Xms parameter in JVM on different Operating Systems.

Initially, my understanding of Xms was that 
> Xms is the minimum heap space the JVM should get before starting the Java process, if this much main memory (RAM) isn't available then program should not start.

So I wrote a simple program and ran it with different Xms values:

```java
// Simple program that I ran with different Xms values
public class Test {

	public static void main(String[] args) {
		System.out.println("yo man");
	}

}
```
<figure>
    <img src="/assets/img/jvm_terminal_mac.png" alt="Terminal from MAC" style="display: block; margin-left: auto; margin-right: auto;"/>
    <figcaption style="text-align: center; font-style: italic;">Terminal from MAC</figcaption>
</figure>
<br>
<figure>
    <img src="/assets/img/jvm_terminal_win.png" alt="Terminal from Windows" style="display: block; margin-left: auto; margin-right: auto;"/>
    <figcaption style="text-align: center; font-style: italic;">Terminal from Windows</figcaption>
</figure>

## Outcome
In MacOS, the program was working fine with Xms values 2000G, (according to my understanding) that would mean that JVM is getting 2000G memory before starting (Thus my understanding is wrong). My Mac has 8GB main memory and 125GB SSD. 
Tried the same things on Windows, there the program was not running if Xms value more than 10G. Avaiable RAM in my windows system was around ~10G. Total RAM in Windows system is 16G.

## Result
Xms behaves differently w.r.t OS, when I ran with Xms value 20G on MacOS, it worked like a charm. But when the same thing was executed on Windows, it gave an error **_Could not reserve enough space for object heap_**.

> java -Xms20G Test

This means that the JVM wants 20G memory, what happens after this is OS dependent, Windows is reserving the virual memory and mapping that virual memory to the physical memory. In above case, I have 10G free RAM so the program runs, but when I set Xms value to 12G, it doesn't work because the system doesn't have 12G physical memory to provide to the JVM. However in case of Mac, it reserves the virtual memory for JVM without mapping it to physical memory.

To map virtual memory to physical memory, I found a JVM param **_AlwaysPreTouch_** 

From Oracle documentation:

> -XX:+AlwaysPreTouch => Pre-touch the Java heap during JVM initialization. Every page of the heap is thus demand-zeroed during initialization rather than incrementally during application execution.

> java -XX:+AlwaysPreTouch -Xms20G Test

This works in the same way with a caveat that the JVM touches all the pages in the initialization phase of application. Apparently, this works in Mac, somehow MacOS gives 20GB memory to JVM (See image below). But when I run this with -Xms200G, it stops working in MacOS too. Now the question is how does prefaulting 20G memory in MacOS works. [This](https://superuser.com/a/105474) might give you some idea. 

<figure>
    <img src="/assets/img/jvm_memory_mac.png" alt="Memory Info from MacOS" style="display: block; margin-left: auto; margin-right: auto;"/>
    <figcaption style="text-align: center; font-style: italic;">Memory Info from MacOS</figcaption>
</figure>

## References

* [https://stackoverflow.com/questions/43302720/do-the-xms-and-xmx-flags-reserve-the-machines-resources/43307880#43307880](https://stackoverflow.com/questions/43302720/do-the-xms-and-xmx-flags-reserve-the-machines-resources/43307880#43307880)
* [https://www.oracle.com/java/technologies/javase/vmoptions-jsp.html](https://www.oracle.com/java/technologies/javase/vmoptions-jsp.html)

### P.S
>I read Xms memory is limited by **RAM + Swap Memory**, but in some OS it can exceed that depending upon whether you are prefaulting the memory or not. If some part of post is inaccurate or if there is something I am missing. Please comment, I will be happy to update post.
