---
author: ["Vivek Bhadauria"]
title: "Streams in Java"
date: 2020-06-12
tags: [Streams, Java]
ShowToc: false
cover:
  image: /img/streams_in_java.png
  alt: "Streams in JAVA"
#   caption: "Streams in JAVA"
---

In this post, we are going to discuss about:

* what streams are in context of CS 
* their support in Java
* lazy evaluation in streams
* how to create finite and infinite streams
* how streams along with functions help in writing declarative code

Stream by definition is a sequence of data which can be finite or infinite.

> **Wikipedia: Stream is a sequence of data elements made available overtime. A Stream can be thought of as items on conveyer belt being processed one at a time rather than in batches.**

From this point, we will talk about streams in context with Java.

## Operations on Stream

All operations on stream can be categorised into two types:
* **Intermediate operation:** these operations are performed on a source stream and return another stream. Examples of such functions:
    * _filter()_
    * _map()_
    * _flatMap()_
    * _mapToInt()_
    * _mapToLong()_
    * _sorted()_
* **Terminal operation:** these operations are performed on a source stream and may produce a result or a side effect. Examples of such functions:
    * _collect()_
    * _count()_
    * _forEach()_
    * _findFirst()_
    * _findAny()_
    * _min()_

> NOTE: Functions like _forEach()_ don't return a result but do something for each element, like printing each element. This is side effect.


## Lazy Evaluation
Lazy evalutaion means doing something only when its needed. Like when you search something on Amazon and you scroll completely down, things like **_Best Seller_**, **_browsing history_** can be seen. This might vary for your account. But the things that you see at bottom of page were loaded when you scrolled down. That's lazy loading. Not everyone goes to complete bottom of page. Thus it's not very efficient to loading everything eagerly. 

Streams are lazily evaluated because intermediate operation are not executed until a terminal operation is invoked on them. As we talked above, intermediate operations act on source stream and return another stream, the returned stream doesn't have evaluated elements. For example consider the case below:

```java
List<Integer> list = Arrays.asList(1, 2, 3, 34, 5);
Stream<Integer> intStream = list.stream();
Stream<Integer> filteredStream = intStream.filter(x -> x % 2 != 0);
Stream<Integer> mappedStream = filteredStream.map(x -> {
    System.out.println(x);
    return 2 * x;
});
System.out.println("Before terminal operation called"); // 1
System.out.println("Count " + mappedStream.count()); // 2
```

### Code comments
* `intStream` is stream created from `list` collection
* `filteredStream` is stream which will have only odd integers, source of this stream is `intStream`
* `mappedStream` is stream which multiplies all its elements by a factor of 2, source of this stream is `filteredStream`

### Output of above code
> Before terminal operation called
1
3
5
Count 3

From above output order, we can say that the stream was evaluated after **count (_terminal operation_)** was called on `mappedStream`. That's all lazy evaluation is, In a nutshell evaluation doesn't happen until and unless any terminal operation is invoked on the stream.

## Finite Streams
Finite streams are the streams whose source is some collection. Source collection can be modified before the terminal operation is invoked. If there is any change in source collection after the terminal operation is invoked, you will get `ConcurrentModificationException`. See some finite stream examples below:

```java
Stream<Integer> stream = Stream.of(1,2,3,4);

List<Integer> list = Arrays.asList(1,2,2,3,4,4,5);
stream = list.stream();

Map<String,String> map = someMap();
Stream<Map.Entry<String,String>> entryStream = map.entrySet().stream();
```

## Infinite Streams
Streams whose source is some `Supplier` or stream is created with `iterate` method.

```java
Supplier<Integer> supplier = () -> {
    Random random = new Random();
    try {
        Thread.sleep(1000);
    } catch (InterruptedException e) {
        e.printStackTrace();
    }
    return random.nextInt(10);
};
Stream<Integer> infiniteRandomStream = Stream.generate(supplier);

Stream<Integer> infiniteOrderedStream = Stream.iterate(Integer.MIN_VALUE, (i) -> i + 1);
infiniteOrderedStream.forEach(System.out::println); // this will print all Integer from MIN_VALUE to MAX_VALUE again and again

```

`infiniteRandomStream` will wait for **1 sec**, print a random number and repeat this infinitely.
`infiniteOrderedStream` will print **Integer.MIN_VALUE** to **Integer.MAX_VALUE** values infinitely.


# Analyzing difference between Loop and Stream

From here, this post diverges to usage of stream and functions together to acheive composability, readability, etc.

Lets write a function that iterates on a list of Integer and creates a new list that has only odd numbers from the previous list. We will add more functionality incrementally.

### Loop code
```java
List<Integer> miscLoopFunction(List<Integer> sourceList) {
    List<Integer> resList = new ArrayList<>();
    for (int i : sourceList) {
        if (i % 2 != 0) {
            resList.add(i);
        }
    }
    return resList;
}
```

### Stream code
```java
List<Integer> miscStreamFunction(List<Integer> sourceList) {
    return sourceList.stream()
                     .filter(x -> x % 2 != 0)
                     .collect(Collectors.toList());
}
```

Now we want to multiply all numbers in new list by a factor of 3.

### Loop code
```java
List<Integer> miscLoopFunction(List<Integer> sourceList) {
    List<Integer> resList = new ArrayList<>();
    for (int i : sourceList) {
        if (i % 2 != 0) {
            resList.add(i * 3);
        }
    }
    return resList;
}
```

### Stream code
```java
List<Integer> miscStreamFunction(List<Integer> sourceList) {
    return sourceList.stream()
                     .filter(x -> x % 2 != 0)
                     .map(x -> x * 3)
                     .collect(Collectors.toList());
}
```

Now we want only those numbers which are perfect square.

### Loop code
```java
List<Integer> miscLoopFunction(List<Integer> sourceList) {
    List<Integer> resList = new ArrayList<>();
    for (int i : sourceList) {
        if (i % 2 != 0) {
            int temp = i * 3;
            if (Math.floor(Math.sqrt(temp)) == Math.sqrt(temp)) {
                resList.add(temp);
            }
        }
    }
    return resList;
}
```

### Stream code
```java
List<Integer> miscStreamFunction(List<Integer> sourceList) {
    return sourceList.stream()
            .filter(x -> x % 2 != 0)
            .map(x -> x * 3)
            .filter(x -> Math.floor(Math.sqrt(x)) == Math.sqrt(x))
            .collect(Collectors.toList());
}
```

We will evaluate above code snippets on some parameters like readability, testability, extensibility and performace.

* **Readability:** No doubt, code written using stream is more readable. Some might say otherwise, but the only reason for that can be they have mostly worked on loops and never wrote code in this style.
* **Testability:** Writing the test for any of the above functions will tell us that output is not expected but won't help much in detecting which segment of code is not working as intended. Lets refactor the stream snippet.

Taking out the Filter and Map logic to another class.

{{< gist viveksb007 8f36f30c4e58d280aad3b9068aa19a3c OddFilterIn.java >}}

{{< gist viveksb007 8f36f30c4e58d280aad3b9068aa19a3c MultiplyBy3.java >}}

{{< gist viveksb007 8f36f30c4e58d280aad3b9068aa19a3c IsPerfectSquare.java >}}

Now we can easily test any intermediate logic. Below is example of testing `IsPerfectSquare` class logic.

{{< gist viveksb007 8f36f30c4e58d280aad3b9068aa19a3c IsPerfectSquareTest.java >}}

Similarly, we can write tests for `OddFilterIn` and `MultiplyBy3`. See `miscStreamFunction()` after refactoring, there is not much effort in understanding what the code is doing:

```java
    List<Integer> miscStreamFunction(List<Integer> sourceList) {
        return sourceList.stream()
                .filter(new OddFilterIn())
                .map(new MultiplyBy3())
                .filter(new IsPerfectSquare()).collect(Collectors.toList());
    }
```
* **Extensibility:** Now that we have tested each logic with its own test, we can add other functionality with confidence and if `miscStreamFunction()` doesn't return required result, we can deduce that other parts are working as intented, so whatever is added now caused the bug.

* **Performance:** Performance testing in java is almost never reliable as GC works side by side. Have a look at code below:
```java
private void complexityCheck() {
    List<Integer> list = new ArrayList<>();
    Random random = new Random();
    int n = (int) Math.pow(10, 7);
    for (int i = 0; i < n; i++) {
        list.add(random.nextInt(n));
    }

    long startTime = 0, endTime = 0;

    startTime = System.currentTimeMillis();
    List<Integer> resList = list.stream().filter(x -> x % 2 != 0).map(x -> 2 * x).collect(Collectors.toList());
    endTime = System.currentTimeMillis();
    System.out.println("Result size " + resList.size());
    System.out.println("Stream timing " + (endTime - startTime) + " ms");

    startTime = System.currentTimeMillis();
    List<Integer> resultList = new ArrayList<>();
    for (Integer integer : list) {
        if (integer % 2 == 0) continue;
        resultList.add(integer * 2);
    }
    endTime = System.currentTimeMillis();
    System.out.println("Result size " + resultList.size());
    System.out.println("Loop timing " + (endTime - startTime) + " ms");
    
    System.out.println(resultList.size());
    System.out.println(resList.size());
}
```

First I am testing stream working time, then loop working time. See below output: 

> **Iteration 1**
Result size 4999974
Stream timing 2793 ms
Result size 4999974
Loop timing 511 ms
4999974
4999974

> **Iteration 2**
Result size 5000114
Stream timing 2872 ms
Result size 5000114
Loop timing 527 ms
5000114
5000114

Now I swapped the stream and loop code snippet, i.e first I am finding loop working time then stream working time. Below are the results:

> **Iteration 1**
Result size 5000147
Loop timing 2566 ms
Result size 5000147
Stream timing 585 ms
5000147
5000147

> **Iteration 2**
Result size 4999978
Loop timing 2496 ms
Result size 4999978
Stream timing 568 ms
4999978
4999978

So we can't say anything conclusively here. If we see from the BigO perspective, both have same time complexity, its the constant factor that differs like operations inside loop cost less than a data element going through the intermediate operations pipeline.

## Conclusion:
We discussed about streams and some examples codes showing their usage. And how they can be used to achieve composability. On Performance testing front we couldn't say anything conclusively. I was looking into [Epsilon Garbage collector](https://blogs.oracle.com/javamagazine/epsilon-the-jdks-do-nothing-garbage-collector) that does only memory allocation work and does no garbage collection. So if you are testing something, you should know its runtime when there is no garbage collection, else you don't know how much time did GC took from the total time your code ran. So going ahead, will try to use Epsilon GC for any performance testing stuff.

> Note: If something seems inaccurate/wrong, please feel free to comment. Will be happy to update the post. 

## References:
* [https://www.baeldung.com/java-inifinite-streams](https://www.baeldung.com/java-inifinite-streams)
* [https://en.wikipedia.org/wiki/Stream_(computing)](https://en.wikipedia.org/wiki/Stream_(computing))
* [https://howtodoinjava.com/java8/generate-finite-infinite-stream/](https://howtodoinjava.com/java8/generate-finite-infinite-stream/)

