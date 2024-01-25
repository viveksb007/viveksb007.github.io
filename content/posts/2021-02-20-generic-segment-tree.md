---
author: ["Vivek Bhadauria"]
title: "Generic Segment Tree"
date: 2021-02-20
tags: [Segment Tree, Data structure]
ShowToc: false
---

In this post, we are going to create a Generic Segment Tree. Before creating a Generic Segment Tree, we will try to solve a basic segment tree problem and try to find what part of our code is problem specific and abstract it out i.e there are some things which are common in any segment tree problem like creating the tree, querying the tree, etc. 

We will try to identify the piece of logic which is specific to our problem. Lets take the example of the "range sum problem". 

## Problem
We are given an array of integers, we get 2 types of queries
- SUM X Y —> here “X” and “Y” are valid indexes of array, we need to return sum of values of array from index [X,Y] (both inclusive)
- UPDATE X Y —> here “X” is the "index” of array and “Y” is "updated value" of the array at index “X”

GFG reference of problem - https://www.geeksforgeeks.org/segment-tree-set-1-sum-of-given-range/

Give it a try. If you understood the segment tree solution then we can go ahead and find abstraction in that solution.

From here on, I will refer to the segment tree as tree.
 
First task is to create a tree with the given array, all leaf nodes of the tree are array elements. All the non-leaf nodes are some result using its left and right child. 
Think of this like deciding the node value based on left and right node values. We abstract this merging decision as **“Merge Function”** which takes 2 nodes and returns some values based on it. Below is the definition of our Merge Function.

```java
import java.util.function.BiFunction;

public interface MergeFunction<A, B, C> extends BiFunction<A, B, C> {

   default C merge(A a, B b) {
       return apply(a, b);
   }

}
```

For range sum problem, the createTreeUtil() method looks like below:

```java
private int createTreeUtil(int index, int start, int end, Integer[] arr) {
   if (start == end) {
       tree[index] = arr[start];
       return tree[index];
   }
   int mid = (start + end) / 2;
   int l = createTreeUtil(2 * index + 1, start, mid, arr);
   int r = createTreeUtil(2 * index + 2, mid + 1, end, arr);
   tree[index] = l + r; // merging logic
   return tree[index];
}
```

Lets replace merging logic with our defined merge function - 

```java
private int createTreeUtil(int index, int start, int end, Integer[] arr) {
   if (start == end) {
       tree[index] = arr[start];
       return tree[index];
   }
   int mid = (start + end) / 2;
   int l = createTreeUtil(2 * index + 1, start, mid, arr);
   int r = createTreeUtil(2 * index + 2, mid + 1, end, arr);
   tree[index] = mergeFunction.merge(l, r);
   return tree[index];
}
```

For range sum problem, we can define a sum function like below - 

```java
public class SumFunction implements MergeFunction<Integer, Integer, Integer> {
   @Override
   public Integer apply(Integer a, Integer b) {
       if (a == null) return b;
       if (b == null) return a;
       return a + b;
   }
}
```

Similarly, **“update”** and **“find”** logic for a specific problem can be abstracted out. Final code would look something like below :

{{< gist viveksb007 a6d56c4a564842c4f27c8cfc5c47343e >}}

In the second test, I passed a **MinFunction()** to segment tree as the merging logic. Try to write MinFunction on your own.

```java
public class MinFunction implements MergeFunction<Integer, Integer, Integer> {

   @Override
   public Integer apply(Integer a, Integer b) {
       if (a == null) return b;
       if (b == null) return a;
       return Math.min(a, b);
   }
}
```

All the above codes can be found at : 
- https://github.com/viveksb007/DS_Algo/tree/master/src/main/java/com/viveksb007/ds/segt
