---
author: ["Author Claude Opus 4.8 | Prompter Vivek Bhadauria"]
title: "How the BPF Verifier Works"
date: 2026-06-20
tags: [ebpf, linux, bpf, kernel, verifier]
ShowToc: true
---

In a [previous post](/2026/05/bpf-load-c-to-kernel/) we followed
BPF code from C source all the way to a fully-resolved bytecode stream handed to
the kernel. But the kernel does not just run that bytecode. First it has to be
convinced the program is safe. That job belongs to the **verifier**, and it is
the reason you can load your own code into the kernel's hottest paths — every
network packet, every system call — without the risk of crashing the machine.

This post is about how the verifier works. We will start with the simple idea at
its core and then layer in the details that explain why two programs with the
*same logic* can have wildly different fates: one loads instantly, the other is
rejected as "too large."

## The problem the verifier solves

A BPF program runs **inside the kernel**, at a hook point, with kernel
privileges. If it dereferenced a bad pointer or spun in an infinite loop, it
would take the kernel down with it. Ordinary userspace programs are isolated by
the MMU and can crash alone; kernel code has no such safety net.

So the kernel makes a deal: you may load your own code, but only if a gatekeeper
can **prove in advance** that it is safe. That gatekeeper is the verifier. If it
cannot produce the proof, the program never runs — `bpf()` returns an error and
nothing is loaded.

Notice the asymmetry. Wrongly rejecting a safe program is annoying but harmless.
Wrongly accepting an unsafe one is a kernel crash or security hole. So the
verifier is deliberately **conservative**: when it cannot be sure, it says no.

## What "safe" actually means

Concretely, the verifier must guarantee — for **every possible path** through
the program — all of the following:

| Guarantee | What it prevents |
|-----------|------------------|
| The program **terminates** | Infinite loops freezing the kernel |
| No **uninitialized** reads | Leaking kernel memory into your program |
| Every memory access is **in bounds** | Reading/writing outside a map value, the stack, or the packet |
| Helper calls get **correct argument types** | Passing a number where a pointer is required |
| It fits **resource limits** | Using too much stack, or taking too long to verify |

The phrase "every possible path" is doing a lot of work here. Hold onto it — it
is where all the interesting behaviour comes from.

## The core idea: walk the code without running it

How do you prove something about *every* run of a program without actually
running it on every input? You **simulate it abstractly**.

The verifier walks the instructions one by one, but instead of concrete values
it tracks what it *knows* about each register and stack slot. For every register
it keeps a little description:

- **What kind of thing** it holds — a plain number (scalar), a pointer into a
  map value, a pointer to the packet, a pointer to the stack, and so on.
- **For numbers**, the range of values it could be — a minimum and maximum, and
  which bits are known.
- **For pointers**, *which object* it points into and *what offsets* are valid.

As it steps through each instruction, it updates this knowledge. At every memory
access, it checks the pointer's tracked offset against the object's real size.

Here is that state in action. Take a short sequence and watch what the verifier
*knows* after each instruction — not the data, just the type/range/offset it
tracks:

| After instruction | `r0` | `r1` |
|-------------------|------|------|
| `r1 = bpf_map_lookup_elem(...)` | — | map_value_or_null, off 0 |
| `if (r1 == 0) goto out`         | — | **map_value** (non-null), off 0 |
| `r0 = 0`                        | scalar, value `[0,0]` | map_value, off 0 |
| `r0 = *(u32 *)(r1 + 0)`         | scalar, value `[0, 2^32-1]` (unknown) | map_value, off 0 |
| `r1 += 4`                       | scalar, `[0, 2^32-1]` | map_value, **off 4** |

Every check the verifier makes — is this pointer non-null, is this offset in
bounds, is this argument the right type — reads straight off these columns. It
never looks at a single byte of real data.

Let's make "read N bytes at a pointer" concrete. Say `r1` points at the start of
a map value that is **8 bytes** long — so the only legal bytes are positions
`0,1,2,...,7`. A read of *width* W at *offset* O touches bytes `O` through
`O+W-1`, and the verifier's rule is simply: that whole span must stay inside the
object, i.e. **`O + W <= size`**. The verifier knows W from the instruction (a
`u32` load is 4 bytes, a `u64` load is 8) and tracks O as it goes; it never needs
the actual data.

```
r1 = pointer to a map value of size 8        offset O = 0
r1 += 4                                       O = 4
read u32 at r1   (W = 4 bytes)                touches bytes 4,5,6,7
                                              check: O+W = 4+4 = 8 <= 8  -> OK
r1 += 4                                       O = 8
read u32 at r1   (W = 4 bytes)                would touch bytes 8,9,10,11
                                              check: O+W = 8+4 = 12 > 8  -> REJECTED
```

The second read starts at byte 8, but byte 8 is already one past the end (valid
bytes stop at 7). The verifier rejects the *whole program* at this instruction —
it doesn't matter that the first read was fine, or what the map actually
contains. It only tracked the *offset* and compared `offset + width` against the
*size*. That is the whole trick: reason about **ranges and types**, not concrete
values.

(When the offset is not a single known number but a range — say O is somewhere
in `[0, 8]` because it came from a loop counter — the verifier checks the
**worst case**, the largest possible offset, against the size. If the worst case
is out of bounds, it rejects, which is why you often need to mask an index like
`idx & 7` before using it: that tells the verifier the offset can never exceed
7.)

## Branches: where it gets interesting

What happens at an `if`? At load time the verifier does not know which way the
branch will go, so it must account for **both**. It explores one direction now
and saves the other as a "to-do" to come back to later.

Here is the subtle and powerful part: taking a branch **teaches** the verifier
something. Consider a map lookup, which can return a valid pointer *or* null:

```
r0 = bpf_map_lookup_elem(...)    r0 is now "pointer to map value OR null"
if (r0 == 0) goto out            split into two futures:
                                   - the "==0" path: r0 is null
                                   - the fall-through:  r0 is definitely NOT null
... read *r0 ...                 only reached on the non-null path -> safe
```

This is exactly why the familiar `if (!ptr) return;` check before using a map
result is not just good manners — it is what makes the later dereference
*provably* safe. The verifier literally refines what it knows on each side of
the branch.

But branches come at a price. A data-dependent `if` — one where both outcomes
are still possible given what the verifier knows — splits the exploration into
two futures, and those futures can split again. A program with many such branches
has an exploding number of paths to walk. That explosion is the central tension
in the verifier's design — and the reason for everything that follows.

## Loops

Early kernels simply rejected loops; you had to fully unroll them with
`#pragma unroll`. Kernels 5.3 and newer support **bounded loops**.

To handle a loop, the verifier walks the body repeatedly, leaning on the same
state-pruning it uses everywhere else: if an iteration arrives in a state already
proven safe, it stops re-walking. For a simple counter, each pass narrows the
counter's possible range, so after enough passes the exit condition is forced and
the walking ends. (It is not proving a mathematical loop invariant — it is just
exploring iterations until pruning says there is nothing new to check.)

Take a concrete loop:

```c
for (int i = 0; i < 10; i++)
    sum += i;
```

The verifier walks it like this, tracking the value of `i` at the top of each
pass:

```
enter loop      i = 0           0 < 10 true  -> walk body, then i becomes 1
top of loop     i = 1           1 < 10 true  -> walk body, then i becomes 2
top of loop     i = 2           2 < 10 true  -> walk body, then i becomes 3
...
top of loop     i = 9           9 < 10 true  -> walk body, then i becomes 10
top of loop     i = 10          10 < 10 FALSE -> exit the loop
```

The verifier has no shortcut here: it does not *reason* that the loop ends after
ten passes, it *walks until it gets there*. Because the bound `10` is a constant,
`i` is a definite value each pass (`0, 1, ... 10`), so no two visits to the top
of the loop share a state — pruning can't collapse them, and the body is walked
**ten separate times**, once per iteration. It finally stops because it reaches
the state `i = 10`, where `10 < 10` is false.

The cost came from the loop's *bound*, not its source length: those ten walks
have nothing to do with the loop being two lines of source. A two-line loop with
bound 1000 is 1000 walks; fifty lines run once is one walk. Source size tells you
nothing about verifier cost — iteration count (times how well pruning applies)
does. That re-walking is exactly the cost that grows, and the reason the next
idea matters.

## State pruning: the optimization that makes it tractable

If the verifier re-explored every path from scratch, realistic programs would
take effectively forever to verify. The idea that saves it is **state pruning**.

The verifier remembers states it has already cleared as safe. When it arrives at
some instruction in a state that is **equivalent to — or covered by — a state it
already proved safe** *from that same point*, it stops walking; whatever follows
was already shown safe. (The match has to go that way round: an earlier, *more
general* state covers a current, narrower one — never the reverse.) Think of it
as: "I've stood exactly here, knowing this much or less, before. No need to
re-walk the rest."

A small example. Suppose a branch joins back together and then does some shared
work:

```c
if (cond)
    a = 10;
else
    a = 20;
// join point — both paths arrive here
b = lookup_and_check();   // 50 instructions of shared work below
```

The verifier walks the `cond`-true path, reaches the join with `a = 10`, and
verifies the 50 instructions below. Then it comes back for the `cond`-false path
and reaches the same join with `a = 20`.

- If those 50 instructions **never use `a`**, then `a`'s value is irrelevant to
  their safety. The verifier's state at the join (ignoring the dead value)
  matches what it already cleared, so it **prunes**: the 50 instructions are
  walked once, not twice.
- If those 50 instructions **do use `a`**, the two arrivals are genuinely
  different states (`a = 10` vs `a = 20`), they don't match, and the verifier
  must walk all 50 **again** for the second value.

Same code, double the work, purely because a value stayed relevant across the
join. Two consequences fall out of this, and they explain almost everything
about verifier performance:

1. **Pruning only helps when states match.** If the same instruction is reached
   under many *different* states, none of them match, and it gets re-walked once
   per distinct state.
2. **Carrying extra information makes states diverge.** An extra variable still
   "live," a wider possible range — anything that makes two arrivals look
   different defeats the match, so you get less pruning and more walking.

Keep these two points in mind; the dramatic example at the end is entirely a
story about pruning working or not working.

## The cost limits

Because exploration can blow up, the verifier guards itself with hard ceilings.
Cross any of them and the load fails:

| Limit | What it bounds | Value | Kernel symbol |
|-------|----------------|-------|---------------|
| Instruction count | static program **size** | 4096 unpriv. / ~1M priv. | `BPF_MAXINSNS` (`include/uapi/linux/bpf_common.h`) |
| **Complexity** | instructions **processed** while exploring | **1,000,000** | `BPF_COMPLEXITY_LIMIT_INSNS` (`include/linux/bpf.h`) |
| Jump sequence | branch depth on one path | 8192 | `BPF_COMPLEXITY_LIMIT_JMP_SEQ` (`kernel/bpf/verifier.c`) |
| Stack | bytes of stack used | 512 | `MAX_BPF_STACK` (`include/linux/filter.h`) |

(Symbol locations are as of kernel 5.10, where this was measured.) The
complexity check itself lives in `do_check()` in `kernel/bpf/verifier.c`, and the
`processed N insns` summary is printed at the end of `bpf_check()` in the same
file.

A large program can hit any of these, but the one that bites in our example
below is **complexity**. The verifier keeps a counter — `env->insn_processed` in
`kernel/bpf/verifier.c` — and bumps it **once for every instruction it visits**
during exploration. The same instruction reached on two
different paths counts twice. When the counter crosses one million, you get:

```
BPF program is too large. Processed 1000001 insn
```

returned as the error `-E2BIG`. (The number reads `1000001` because it stops the
instant it crosses the limit.) That message is surfaced through the verifier log
buffer, which is what `bpftool prog load ... -d` prints for you.

The crucial thing: this is **not** about how many instructions your program
contains. It is about how many instruction-*visits* the verifier had to make. A
program with a few dozen static instructions can blow this limit if its paths
explode.

## A concrete example: same logic, opposite outcomes

Let's make "cost depends on exploration, not size" tangible. Here is the shape
of a tiny program: an outer loop that, each iteration, calls a helper containing
an inner loop. (The full runnable source, plus compile-and-load instructions, is
in [this gist](https://gist.github.com/viveksb007/f9af66426465cab52b8239963935c568).)

```c
static /* ATTR */ u64 walk(struct value *v) {
    u64 acc = 0;
    for (int j = 0; j < INNER; j++)   // inner loop, reads v
        acc += v->slot[j & MASK];
    return acc;
}

int prog(...) {
    u64 sink = 0;
    for (int i = 0; i < OUTER; i++)   // outer loop, calls walk() each time
        sink ^= walk(v);
    return sink & 1;
}
```

We compile it two ways, changing only whether `walk` is `always_inline` or
`__noinline`. The logic is identical. The verifier outcomes are not:

| Build | Static instructions | Processed insns | Result |
|-------|--------------------:|----------------:|--------|
| `always_inline` | 38 | **1,000,001** | **REJECTED** (E2BIG) |
| `__noinline`    | 43 | 6,742 | LOADED |

Same program. One is rejected for being "too large" at 38 instructions; the
other sails through. The difference is **entirely** about how much the verifier
had to walk.

### Why inline explodes

When `walk` is inlined, its inner loop is stamped directly into the outer loop's
body. Now look at what state reaches the inner loop: the outer loop's counter
`i` is still **live** (the outer loop is not done with it). On each outer
iteration `i` has a different value, so the verifier's state at the inner loop is
*different every time* — and by our pruning rule, different states don't match.
The inner loop gets re-walked from scratch on **every** outer iteration.

The picture, with the inner loop's entry state on each outer pass:

```
INLINE — inner loop stamped in; outer `i` is live in the state
  outer i=0   ->  enter inner loop, state {i=0, ...}   NEW -> walk all INNER
  outer i=1   ->  enter inner loop, state {i=1, ...}   NEW -> walk all INNER
  outer i=2   ->  enter inner loop, state {i=2, ...}   NEW -> walk all INNER
   ...                                                  (i differs every time)
  outer i=279 ->  enter inner loop, state {i=279, ...} NEW -> walk all INNER
                                          \_ no two states match -> no pruning
```

The cost is roughly:

```
processed  ≈  OUTER × INNER × k
```

where `k` is the number of instruction-visits the verifier makes per inner
source-iteration (the index math, the bounds check, the load, the accumulate,
the loop back-edge, plus bookkeeping). Measured on a 5.10 kernel, `k ≈ 13`. With
`OUTER = 280` and `INNER = 300` the raw product is only 84,000 — well under the
limit — but multiplied by `k` it sails past 1,000,000 and the program is
rejected. (The crossover is sharp: at `INNER = 300`, `OUTER = 255` loads with
997,068 processed; `OUTER = 256` tips over to 1,000,001.)

### Why `__noinline` doesn't

When `walk` is a real `__noinline` subprogram, it is reached through a `BPF_CALL`
instruction. A call gives the subprogram a **fresh frame**, and the verifier
checks it against its **arguments** — here, the same map-value pointer state on
every call. The outer loop's counter `i` is *not* part of the subprogram's entry
state. So no matter how many times the outer loop calls it, the subprogram is
entered in the same state and verified essentially **once**. The outer loop then only adds a small
fixed cost per call:

```
NOINLINE — walk() entered via BPF_CALL; entry state is just the arg
  call walk(v)  ->  entry {arg = v-ptr}   NEW   -> verify inner loop ONCE
  call walk(v)  ->  entry {arg = v-ptr}   MATCH -> pruned
  call walk(v)  ->  entry {arg = v-ptr}   MATCH -> pruned
   ...                                      (same entry state every call)
                                          \_ inner loop never re-walked
```

```
processed  ≈  (inner loop verified once)  +  OUTER × small_constant
```

That is why the count drops from over a million to under seven thousand, with no
change to what the program computes.

This is not a contrived demo. The same pattern — a loop-heavy helper that had to
become a `__noinline` subprogram before a real program would stop being rejected
as too complex — is what motivated this whole investigation. The fix changed
*zero* lines of logic; it only changed where the compiler put a function
boundary.

## Putting it together

The verifier is, at heart, one simple idea — **walk the code abstractly,
tracking what you know, and prove safety on every path** — wrapped in the
machinery needed to make that idea fast enough to be practical:

- It tracks **types and value ranges**, not concrete values, and checks every
  memory access and helper call against them.
- It explores **both sides of every branch**, refining what it knows on each
  side (which is why null-checks make pointers safe).
- It handles **bounded loops** by walking until states converge.
- It uses **state pruning** to avoid re-walking equivalent situations — and how
  well that pruning applies often decides whether a program verifies cheaply or
  blows the complexity limit.

So when you write BPF and the verifier rejects something as "too large" even
though the code is short, the question to ask is not "how do I make it smaller?"
but "**what is keeping the verifier from pruning?**" Often the answer is a value
kept live across a loop, or a hot helper that should be a subprogram — small
structural changes that collapse a million instruction-visits down to a few
thousand.
