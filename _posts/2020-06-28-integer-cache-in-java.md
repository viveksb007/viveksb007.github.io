---
layout: post
title: "Integer Cache in Java"
date: 2020-06-28
tags: [IntegerCache, Java]
comments: true
---

Before starting with the post, try to find the output for below code snippet:

```java
Integer a = 100;
Integer b = 100;
System.out.println(a == b);

Integer c = 1000;
Integer d = 1000;
System.out.println(c == d);
```

Note the answer somewhere, we will come back to it after looking at some concepts which will help in answering this.

## Auto-boxing and Auto-unboxing in Java

`Integer i = 2` doesn't make sense as `i` is an object reference and you are assigning it a literal. But this works because of auto-boxing in Java.

During compilation its converted to `Integer i = Integer.valueOf(2)`.

Let's look at unboxing now,

```java
Integer i = new Integer(2);
int a = i;
```

See in above code snippet, object reference `i` is assigned to the literal `a`, here unboxing is done. `i`'s integer value is assigned to `a`. Compiled code snippet looks like below.

```java
Integer i = new Integer(2);
int a = i.intValue();
```

This covers auto-boxing and auto-unboxing, similar techniques are extended to other primitives like `long`, `double`, etc.

## Integer Cache

Integer class keeps a cache of Integer objects within some range. Cache class is `IntegerCache` which is a `static` member of `Integer` class. Let's decompile and have a look at `Integer.valueOf(int i)` implementation.

```java
public static Integer valueOf(int i) {
    if (i >= IntegerCache.low && i <= IntegerCache.high)
        return IntegerCache.cache[i + (-IntegerCache.low)];
    return new Integer(i);
}
```

From above, we can say that if integer `i` is in range `[IntegerCache.low, IntegerCache.high]`, then the Integer object is returned from the cache otherwise a `new Integer` object is created.

Default values of **low** and **high** are [-128,127].

Below is `IntegerCache` class definition. We can override the cache size to be more or less by setting the `java.lang.Integer.IntegerCache.high` parameter.

```java
private static class IntegerCache {
    static final int low = -128;
    static final int high;
    static final Integer cache[];

    static {
        // high value may be configured by property
        int h = 127;
        String integerCacheHighPropValue =
            sun.misc.VM.getSavedProperty("java.lang.Integer.IntegerCache.high");
        if (integerCacheHighPropValue != null) {
            try {
                int i = parseInt(integerCacheHighPropValue);
                i = Math.max(i, 127);
                // Maximum array size is Integer.MAX_VALUE
                h = Math.min(i, Integer.MAX_VALUE - (-low) -1);
            } catch( NumberFormatException nfe) {
                // If the property cannot be parsed into an int, ignore it.
            }
        }
        high = h;

        cache = new Integer[(high - low) + 1];
        int j = low;
        for(int k = 0; k < cache.length; k++)
            cache[k] = new Integer(j++);

        // range [-128, 127] must be interned (JLS7 5.1.7)
        assert IntegerCache.high >= 127;
    }

    private IntegerCache() {}
}
```

## Conclusion

Now that you know auto-boxing, auto-unboxing and IntegerCache, you should be able to tell what is the output for the code snippet that we saw in the beginning of the post. 

> Answer is **_true_** and **_false_**.

### NOTE: the output would vary if you change the IntegerCache size explicitly.

## How I stumbled upon this

I was solving [this](https://leetcode.com/problems/check-if-array-pairs-are-divisible-by-k) leetcode problem. And wrote below code to solve it

```java
public boolean canArrange(int[] arr, int k) {
    int n = arr.length;
    if(n%2!=0) return false;
    Map<Integer,Integer> map = new HashMap<>();
    for(int i=0;i<n;i++) {
        int rem = (arr[i]%k+k)%k;
        map.put(rem,map.getOrDefault(rem,0)+1);
    }
    for(int i=0;i<n;i++) {
        int rem = (arr[i]%k+k)%k;
        if(rem == 0) {
            if(map.get(rem)%2 !=0) return false;
        } else if(map.get(rem) != map.get(k-rem)) return false; // buggy line
    }
    return true;
}
```

I am doing `Integer` comparison using `!=`, this works fine if the value of the integer is in the cache range i.e [-128,127], because then both LHS and RHS would point to the same object from the cache. Changing it to `!map.get(rem).equals(map.get(k-rem))` fixed the issue. `Integer` comparison should be done with `compareTo()` method or use unboxed values like `integer.intValue()`.

## References
* [https://dzone.com/articles/java-integer-cache-why-integervalueof127-integerva](https://dzone.com/articles/java-integer-cache-why-integervalueof127-integerva){:target="_blank"}