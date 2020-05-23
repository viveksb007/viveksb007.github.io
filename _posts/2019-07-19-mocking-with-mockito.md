---
layout: post
title: "Mocking with Mockito"
date: 2019-07-19
tags: [Java, Mockito]
comments: true
---

This is going to be a short post about an issue that I faced in my office project.

**Context:** I was working on a project that generates an output file based on the data that is read by some input files. Now the size of the input files can vary and in my case, it went up to 50GB. So when the program was executing on the cloud environment (will call ENV further in post), there wasn't enough space left in the **PVC (Persistant Volume Claim)** for this file and the program crashed due to full PVC. As output file delivery was a priority thing, so I pulled the file locally and tried to generate the file using Integration test. For local generation, I wrote a test, that stubs the file paths that my batchClient downloads.  
  
```java
BatchClient client = mock(BatchClient.class);  
when(client.getFirstFile()).thenReturn(firstFileLocalPath());
```
  
This handles stubbing main file, while processing the main file some constant data is required, thus a data provider was stubbed which reads constant data files and exposes methods to provide that constant data.  
  
```java
ConstantDataProvider dp = mock(ConstantDataProvider.class);  
when(dp.getData(anyString(), anyString())).thenAnswer(  
// getting data from some map prepared by reading local files.  
String param1 = invocation.getArgumentAt(0,String.class);  
String param2 = invocation.getArgumentAt(1,String.class);  
localMap.get(param1, param2);  
);
```  
  
This isolated my test from all network related tasks, now my test had everything to generate the file locally.  
Some numbers to gauge the scenario :  


> System RAM = 12GB total (~10GB available to JVM) 
> Main file size = 50GB (line count ~780K)  
> Constant files cumulative size ~ 500mb


## **Problem:** 
when the test ran locally, it resulted in **_OutOfMemory error/ heap space memory error_** at almost 700K line. When encountered with this error, my first thought was that there was memory leak somewhere in my code because I was reading big 50GB file, so there might be leak somewhere during processing. (I wrote the code that reads and processes file line by line, all objects associated with single line processing are available for GC after that line is processed, theoretically there should not be any memory leak). Meanwhile, I was trying to generate file locally, ENV volume was cleared, so I triggered file generation workflow there also. Surprisingly, file was successfully generated on the ENV, this increased confusion and resulted in deductions/questions like :  

1. On ENV there is OpenJDK and locally its Oracle JDK, so JVM differences.  
2. Can persistent volume be behaving differently on ENV and local?  
3. Objects were not Garbage collected **GCed** locally but GCed on ENV..?

## **Exploring the issue:** 
For investigation, I took heap dump of the program using **_jvisualvm_** and analysed the dump using **_JHAT (Java Heap Dump Analysis Tool)_**. Both **jvisualvm** and **jhat** are available in **jdk/bin**. Upon analyzing the heap dump, I saw a long list of objects which were call stack of **_dp.getData()_** function that I mocked. Looking further, I found that mockito was storing invocation history for behavioral testing. In my case this function was called ~100 times in a single line and there were 780K lines, storing all this invocation details in-memory was causing the test to fail giving OOM error.

## **Solution:**  
While initialising mock object, specify **_stubOnly()_** which prevents storing any invocation history.  

```java
ConstantDataProvider dp = mock(ConstantDataProvider.class, withSettings().stubOnly());
```

## References:

* [https://code.google.com/archive/p/mockito/issues/84](https://code.google.com/archive/p/mockito/issues/84)  
  
* [https://stackoverflow.com/questions/17437660/mockito-throws-an-outofmemoryerror-on-a-simple-test](https://stackoverflow.com/questions/17437660/mockito-throws-an-outofmemoryerror-on-a-simple-test)
