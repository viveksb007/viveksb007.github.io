---
title: "Kubernetes Workqueue and Concurrent Reconciling"
date: 2026-03-10
draft: false
---

Kubernetes controllers support concurrent reconciliation via `MaxConcurrentReconciles`. Multiple workers can process different resources in parallel, but the workqueue guarantees a single resource is never processed by two workers at the same time.

## Workqueue Internals

The [client-go workqueue](https://github.com/kubernetes/client-go/blob/a57d0056dbf1d48baaf3cee876c123bea745591f/util/workqueue/queue.go#L65) uses three data structures:

- **`queue`** - ordered list of items waiting to be processed
- **`dirty` set** - all items that need processing (used for deduplication)
- **`processing` set** - items currently being worked on by a worker

```
┌─────────────────────────────────────────────────┐
│                   Workqueue                      │
│                                                  │
│  dirty set: tracks items needing reconciliation  │
│  processing set: tracks items being reconciled   │
│  queue: ordered list for workers to pick from    │
│                                                  │
└─────────────────────────────────────────────────┘
```

## Adding an Item While It's Being Processed

Yes, you can add an item to the queue while it's being processed. The workqueue handles it:

1. Item gets added to the `dirty` set (marked as needing reconciliation)
2. Item is **not** added to the `queue` because it's already in the `processing` set
3. When the worker finishes and calls `Done()`, the queue checks the `dirty` set
4. If the item is in `dirty`, it gets added back to the `queue` for another round

```
Worker processing resource A
        │
        │  Event: resource A changed again
        │  ├─> Added to dirty set: YES
        │  └─> Added to queue: NO (already in processing set)
        │
        ▼
Worker calls Done(A)
        │
        ├─> Removed from processing set
        ├─> Check: is A in dirty set?
        │   └─> YES: add A back to queue
        │
        ▼
Next available worker picks up A
```

## Deduplication

If the same item changes multiple times while being processed, it still only appears once in the `dirty` set. After the current processing finishes, it gets reconciled exactly once more, not once per event.

This works because reconciliation is **level-based** - it reads the current state from the apiserver or local cache, rather than reacting to each individual event.

From the client-go docs:

```
* Stingy: a single item will not be processed multiple times concurrently,
    and if an item is added multiple times before it can be processed, it
    will only be processed once.
* Multiple consumers and producers. In particular, it is allowed for an
    item to be reenqueued while it is being processed.
```

## Quick Reference

| Scenario | Added to `dirty`? | Added to `queue`? | When reconciled? |
|---|---|---|---|
| Item not in `dirty` or `processing` | Yes | Yes | Next available worker |
| Item already in `dirty`, not `processing` | No (deduplicated) | Already queued | Next available worker |
| Item in `processing` | Yes | No | After current `Done()` call |

## Code Pointers

- [Queue.Add](https://github.com/kubernetes/client-go/blob/a57d0056dbf1d48baaf3cee876c123bea745591f/util/workqueue/queue.go#L108) - adding items with dirty/processing checks
- [Queue.Get](https://github.com/kubernetes/client-go/blob/a57d0056dbf1d48baaf3cee876c123bea745591f/util/workqueue/queue.go#L141) - worker picks next item, moves to processing set
- [Queue.Done](https://github.com/kubernetes/client-go/blob/a57d0056dbf1d48baaf3cee876c123bea745591f/util/workqueue/queue.go#L165) - marks item complete, re-queues if dirty

## Reference

- [Kubernetes Controller Tutorial - Concurrent Reconciling](https://github.com/gianlucam76/kubernetes-controller-tutorial/blob/main/docs/concurrent_reconciling.md)
