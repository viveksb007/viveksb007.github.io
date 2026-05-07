---
author: ["Author Claude Opus 4.6 | Prompter Vivek Bhadauria"]
title: "BPF Loading: From C Source to Kernel"
date: 2026-05-02
tags: [ebpf, linux, bpf, kernel]
ShowToc: true
---

In this post, we are going to learn how BPF code written in C is loaded into the Linux kernel. We will deep dive into everything that happens in the process of turning C source code into a running kernel program.

Before diving into the details, there are some prerequisites. I will briefly touch on each concept so we are all on the same page.

## What is an ELF?

> **Note:** This section introduces ELF concepts in the abstract. If terms like "relocation entries" or "symbol table" feel fuzzy on first read, don't worry — they will click once we inspect a real compiled ELF in the [Inspecting the ELF with readelf](#inspecting-the-elf-with-readelf) section. Come back here as a reference when you need it.

**ELF** stands for Executable and Linkable Format. It is the standard container format for compiled programs on Linux. Think of it as a **book**:

| Book part | ELF equivalent | Purpose |
|-----------|---------------|---------|
| Table of contents | **Section headers** | Lists every section's name, type, and location |
| Chapters | **Sections** | Named chunks of bytes (code, data, etc.) |
| Index | **Symbol table** | Maps names (functions, variables) to locations |
| Errata sheet | **Relocation entries** | "At page X, replace the placeholder with the real value" |

### Sections

An ELF file is divided into **sections** — named chunks of bytes. Each section has a header that records its name, type, size, and position in the file. The section types we care about:

| Type | Meaning |
|------|---------|
| `PROGBITS` | Actual content — code or data |
| `SYMTAB` | A symbol table (name-to-location mappings) |
| `REL` | Relocation entries (patching instructions for the loader) |

### The Symbol Table

The symbol table is an index that maps names to locations within the ELF file. Each entry records:

| Field | Meaning |
|-------|---------|
| **Name** | The symbol's name (e.g., `lookup_conntrack`, `aws_conntrack_map`) |
| **Value** | Byte offset within the section where this symbol starts |
| **Size** | How many bytes the symbol occupies |
| **Ndx** | Which section the symbol lives in (by section index number) |
| **Bind** | LOCAL (private to this file) or GLOBAL (visible externally) |

### Relocation Entries

Relocation entries are the "errata sheet." Each entry says:

> "At byte offset X in the target section, there is an instruction with a placeholder. Replace it using information about symbol Y."

A relocation entry has three key fields:

| Field | Meaning |
|-------|---------|
| **Offset** | Where in the target section the placeholder is (byte offset) |
| **Symbol** | Which symbol provides the value to patch in |
| **Type** | What kind of patching to do |

Two relocation types appear in BPF ELFs:

- **`R_BPF_64_64`** (type 1): Patch a 64-bit immediate value. Used for map file descriptors.
- **`R_BPF_64_32`** (type 0xa): Patch a 32-bit value in a call instruction. Used for BPF function calls.

### Relocatable Objects

The ELF file that `clang` produces is a **relocatable object** — a form with some blanks left unfilled. The compiler doesn't know certain values at compile time:

- It doesn't know what **file descriptor** the kernel will assign to each map (the kernel decides this at load time).
- It doesn't know the **final instruction offset** to each subprogram (because the loader will rearrange and combine sections).

So the compiler writes placeholder values (like 0 or -1) and attaches relocation entries saying: "here is where the blanks are, and here is what information the loader should fill in."

## What is eBPF?

**BPF** (Berkeley Packet Filter), also known as **eBPF** (extended BPF), is a small virtual machine built into the Linux kernel. Think of it as a **plugin system for the kernel**: you write small programs, load them into the kernel, and the kernel runs them at specific hook points — when a network packet arrives, when a system call happens, etc.

BPF programs cannot crash the kernel because they are **verified for safety** before they are allowed to run. The kernel's verifier inspects every instruction to ensure there are no infinite loops, no out-of-bounds memory access, and all function calls target valid destinations.

We will cover just enough BPF to follow the loading process. For a deeper dive into the BPF architecture — instruction set, program types, map types, tail calls, and more — the [Cilium BPF reference guide](https://docs.cilium.io/en/latest/reference-guides/bpf/architecture) is an excellent resource.

### BPF Maps

A **BPF map** is a key-value data store that lives in the kernel. BPF programs use maps to store state, share data with userspace, or communicate between programs. The map is created by the loader *before* the program runs. The kernel assigns a **file descriptor** (FD) to the map, and the loader patches that FD into the program's bytecode so the program knows how to refer to the map.

### Helper Functions

The kernel provides built-in functions that BPF programs can call, called **helper functions**. Each helper has a number — for example, helper #1 is `bpf_map_lookup_elem`. When you see an instruction like `call 1`, it means "call kernel helper #1." These calls don't need relocation because the helper number is known at compile time.

## What is eBPF Bytecode?

BPF programs are not compiled to x86 or ARM machine code. They are compiled to BPF's own instruction set. Example operations are `load, store, add, jump, call` etc.

Each instruction is **8 bytes** with this layout:

```
 Byte:   0        1             2    3       4    5    6    7
       +--------+------+------+-------------+--------------------+
       | opcode | dst  | src  |   offset    |        Imm         |
       | (8bit) |(4bit)|(4bit)|  (16bit)    |    (32bit)         |
       +--------+------+------+-------------+--------------------+
```

- **Opcode**: Which operation to perform.
- **dst / src**: Which registers to use (BPF has 11 registers, r0–r10).
- **Offset**: A small signed number (used in memory and jump instructions).
- **Imm** (immediate): A 32-bit constant embedded in the instruction. This is the field the loader patches for map FDs and call offsets.

Let's decode a concrete example. This instruction from our program stores the IP address `0x0a010164` into register r1:

```
Raw bytes:  b7 01 00 00 64 01 01 0a

 Byte:   0        1             2    3       4    5    6    7
       +--------+------+------+-------------+--------------------+
       |  0xb7  | 0x01        |   0x0000    |    0x0a010164      |
       +--------+------+------+-------------+--------------------+
         |        |      |       |                |
         |        |      src=0  offset=0         Imm = 0x0a010164
         |        dst=r1                          (167,838,052 in decimal)
         opcode = BPF_ALU64 | BPF_MOV | BPF_K
         "move 64-bit immediate into register"

Disassembler output:  r1 = 167838052
```

The opcode `0xb7` means "move a 32-bit immediate constant into a 64-bit register." The destination register is r1 (byte 1 = `0x01`), and the 32-bit immediate in bytes 4–7 is `0x0a010164` (the IP address `10.1.1.100` in network byte order). The offset and src fields are unused and set to 0.

There is one exception to the 8-byte rule: the `ld_imm64` instruction (opcode `0x18`) loads a 64-bit value and takes **16 bytes** (two consecutive 8-byte slots). Why? Because the Imm field is only 32 bits wide — it can't hold a 64-bit value in one slot. So `ld_imm64` uses two slots: the first slot's Imm holds the lower 32 bits, and the second slot's Imm holds the upper 32 bits.

Here is the `ld_imm64` from our program (instruction 7 in `.text`), which is a placeholder for a map file descriptor:

```
Raw bytes:  18 01 00 00 00 00 00 00 00 00 00 00 00 00 00 00
            |---- first 8-byte slot ----|---- second 8-byte slot ---|

First slot (bytes 0-7):
       +--------+------+------+-------------+--------------------+
       |  0x18  | 0x01        |   0x0000    |    0x00000000      |
       +--------+------+------+-------------+--------------------+
         |        |      |                        |
         |        |      src=0                    Imm_lo = 0 (lower 32 bits)
         |        dst=r1
         opcode = ld_imm64

Second slot (bytes 8-15):
       +--------+------+------+-------------+--------------------+
       |  0x00  | 0x00        |   0x0000    |    0x00000000      |
       +--------+------+------+-------------+--------------------+
                                                  |
                                                  Imm_hi = 0 (upper 32 bits)

Full 64-bit value loaded into r1 = (Imm_hi << 32) | Imm_lo = 0
```

Both Imm fields are zero right now — this is the placeholder that the loader will patch with the map's file descriptor. Because `ld_imm64` occupies two instruction slots, the instruction index jumps from 7 to 9 in the disassembly (there is no instruction 8).

The **Imm** field's meaning depends on the opcode:

| Opcode | Imm meaning |
|--------|------------|
| `0x18` (ld_imm64) | The value to load — for maps: the map's file descriptor |
| `0x85` (call) with src_reg=0 | Kernel helper function number (e.g., 1 = `bpf_map_lookup_elem`) |
| `0x85` (call) with src_reg=1 | Relative instruction offset to a BPF subprogram: `target = current + Imm + 1` |

Checkout [BPF Instruction Set Architecture](https://docs.kernel.org/bpf/standardization/instruction-set.html) for more details.

### BPF-to-BPF Function Calls

A BPF program can call another BPF function (a **subprogram**). The call instruction uses a relative offset: "jump forward N instructions from here." The call instruction's `src_reg` field distinguishes the two kinds of calls:

| `src_reg` | Meaning |
|-----------|---------|
| 0 | Kernel helper call — Imm is the helper number |
| 1 | BPF subprogram call (`BPF_PSEUDO_CALL`) — Imm is a relative offset |

Subprogram calls need relocation because the compiler doesn't know the final offset until the loader combines the code sections.

---

With the above information, we are ready to see how C eBPF code is loaded into the Linux kernel. Let's walk through a real example end to end.

## The Example Program

```c
struct bpf_map_def_pvt SEC("maps") aws_conntrack_map = {
    .type = BPF_MAP_TYPE_LRU_HASH,
    .key_size = sizeof(struct conntrack_key),       // 16 bytes
    .value_size = sizeof(struct conntrack_value),    // 4 bytes
    .max_entries = 65536,
    .pinning = PIN_GLOBAL_NS,
};

// noinline forces this into a separate BPF function in the .text section
static __attribute__((noinline)) int lookup_conntrack(__u32 src_ip)
{
    struct conntrack_key key = {};
    key.src_ip = src_ip;
    struct conntrack_value *val;
    val = bpf_map_lookup_elem(&aws_conntrack_map, &key);
    if (val)
        return val->val[0];
    return 0;
}

SEC("tc_cls")
int handle_ingress(struct __sk_buff *skb)
{
    int result = lookup_conntrack(0x0a010164);
    if (result)
        return BPF_OK;
    return BPF_DROP;
}

char _license[] SEC("license") = "GPL";
```

Three things to notice:

1. **`SEC("maps")`** — The map definition is placed in a section called `maps`.
2. **`SEC("tc_cls")`** — The main program is placed in a section called `tc_cls`. The section name tells the loader what program type this is (traffic control classifier).
3. **`__attribute__((noinline))`** — This forces `lookup_conntrack` to be compiled as a separate BPF function. Without this, the compiler would inline it into `handle_ingress` and there would be no subprogram. With `noinline`, the function goes into the `.text` section, and the main program needs a BPF function call to reach it.

## Compiling to BPF ELF

```bash
clang -g -O2 -Wall -fpie -target bpf \
    -c tc.subprog.bpf.c -o tc.subprog.bpf.elf
```

Key flags:

| Flag | Purpose |
|------|---------|
| `-target bpf` | Generate BPF bytecode (not x86/ARM machine code) |
| `-c` | Compile only — produce a **relocatable object**, not a linked executable |
| `-O2` | Optimize (the BPF verifier rejects unoptimized code) |
| `-g` | Include debug info (BTF, DWARF) for better verifier error messages |

The output is a **relocatable ELF object**. "Relocatable" means it contains placeholders that need to be filled in at load time (map file descriptors, function call offsets).

## Inspecting the ELF with readelf

Let's examine what clang produced.

### ELF Header

```bash
$ readelf -h tc.subprog.bpf.elf
```
```
ELF Header:
  Class:                             ELF64
  Data:                              2's complement, little endian
  Type:                              REL (Relocatable file)
  Machine:                           Linux BPF
```

- **Type: REL** — This is a relocatable object, not an executable. It has unresolved references that the loader must fix up.
- **Machine: Linux BPF** — The bytecode targets the kernel's BPF virtual machine.

### Section Headers

```bash
$ readelf -S tc.subprog.bpf.elf
```
```
  [Nr] Name              Type             Size     Flags
  [ 2] .text             PROGBITS         00000070  AX        <- subprogram code
  [ 3] .rel.text         REL              00000010            <- relocations for .text
  [ 4] tc_cls            PROGBITS         00000048  AX        <- main program code
  [ 5] .reltc_cls        REL              00000010            <- relocations for tc_cls
  [ 6] maps              PROGBITS         0000001c  WA        <- map definitions
  [ 7] license           PROGBITS         00000004  WA        <- license string
  [25] .symtab           SYMTAB           00000b10            <- symbol table
```

The sections that matter for loading:

| Section | What's in it |
|---------|-------------|
| `.text` | BPF bytecode for the subprogram (`lookup_conntrack`). 0x70 = 112 bytes = 14 instructions |
| `tc_cls` | BPF bytecode for the main program (`handle_ingress`). 0x48 = 72 bytes = 9 instructions |
| `.rel.text` | Relocation entries for `.text` — tells the loader what to patch in `.text` |
| `.reltc_cls` | Relocation entries for `tc_cls` — tells the loader what to patch in `tc_cls` |
| `maps` | Raw bytes defining the BPF map (type, key size, value size, etc.) |
| `license` | The license string ("GPL") — kernel requires this for GPL-only helpers |
| `.symtab` | Symbol table — maps names to section offsets |

**Why are there two code sections?** The main program is in `tc_cls` (named by the `SEC("tc_cls")` annotation). The subprogram is in `.text` (the default section for code without a SEC annotation — `noinline` static functions go here). The loader needs to combine them before loading.

Notice the naming convention for relocation sections: `.rel` + the name of the section they apply to. `.rel.text` contains patching instructions for `.text`. `.reltc_cls` contains patching instructions for `tc_cls`.

### Code Sections

#### .text — the subprogram (`lookup_conntrack`)

```bash
$ llvm-objdump -d --section=.text tc.subprog.bpf.elf
```
```
0000000000000000 <lookup_conntrack>:
       0:	b7 01 00 00 64 01 01 0a	r1 = 167838052
       1:	7b 1a f0 ff 00 00 00 00	*(u64 *)(r10 - 16) = r1
       2:	b7 06 00 00 00 00 00 00	r6 = 0
       3:	63 6a f8 ff 00 00 00 00	*(u32 *)(r10 - 8) = r6
       4:	63 6a fc ff 00 00 00 00	*(u32 *)(r10 - 4) = r6
       5:	bf a2 00 00 00 00 00 00	r2 = r10
       6:	07 02 00 00 f0 ff ff ff	r2 += -16
       7:	18 01 00 00 00 00 00 00 00 00 00 00 00 00 00 00	r1 = 0 ll
       9:	85 00 00 00 01 00 00 00	call 1
      10:	15 00 01 00 00 00 00 00	if r0 == 0 goto +1 <LBB1_2>
      11:	71 06 00 00 00 00 00 00	r6 = *(u8 *)(r0 + 0)

0000000000000060 <LBB1_2>:
      12:	bf 60 00 00 00 00 00 00	r0 = r6
      13:	95 00 00 00 00 00 00 00	exit
```

Two instructions to focus on:

- **Instruction 7** (`18 01 00 00 00 00 00 00 00 00 00 00 00 00 00 00`): This is `ld_imm64` — it loads a 64-bit value into register r1. The value is **0** right now because the compiler doesn't know the map's file descriptor yet. Notice it takes 16 bytes (two instruction slots), so the next instruction index jumps from 7 to 9. The `.rel.text` relocation will tell the loader to patch this with the actual FD.

- **Instruction 9** (`85 00 00 00 01 00 00 00`): This calls kernel helper function #1 (`bpf_map_lookup_elem`). The `00` in the second byte means `src_reg=0` — this is a **kernel helper call**, not a BPF-to-BPF function call. No relocation needed.

#### tc_cls — the main program (`handle_ingress`)

```bash
$ llvm-objdump -d --section=tc_cls tc.subprog.bpf.elf
```
```
0000000000000000 <handle_ingress>:
       0:	85 10 00 00 ff ff ff ff	call -1
       1:	bf 01 00 00 00 00 00 00	r1 = r0
       2:	67 01 00 00 20 00 00 00	r1 <<= 32
       3:	77 01 00 00 20 00 00 00	r1 >>= 32
       4:	b7 00 00 00 01 00 00 00	r0 = 1
       5:	15 01 01 00 00 00 00 00	if r1 == 0 goto +1 <LBB0_2>
       6:	b7 00 00 00 00 00 00 00	r0 = 0

0000000000000038 <LBB0_2>:
       7:	67 00 00 00 01 00 00 00	r0 <<= 1
       8:	95 00 00 00 00 00 00 00	exit
```

**Instruction 0** (`85 10 00 00 ff ff ff ff`): This is the `call` to `lookup_conntrack`. Let's decode it:

```
85 = opcode: BPF_JMP | BPF_CALL
10 = dst_reg=0, src_reg=1  ->  src_reg=1 means BPF_PSEUDO_CALL (a BPF function call,
                               not a kernel helper)
ff ff ff ff = Imm = -1      ->  PLACEHOLDER -- the compiler doesn't know the final
                               offset to lookup_conntrack yet
```

The `.reltc_cls` relocation will tell the loader to compute the correct Imm value.

### Maps Section

```bash
$ llvm-objdump -s --section=maps tc.subprog.bpf.elf
```
```
Contents of section maps:
 0000 09000000 10000000 04000000 00000100  ................
 0010 00000000 02000000 00000000           ............
```

This is the raw `bpf_map_def_pvt` struct, in little-endian. Reading it field by field (each field is 4 bytes):

| Offset | Bytes (hex) | Value | Field |
|--------|------------|-------|-------|
| 0x00 | `09 00 00 00` | 9 | type = `BPF_MAP_TYPE_LRU_HASH` |
| 0x04 | `10 00 00 00` | 16 | key_size = `sizeof(conntrack_key)` |
| 0x08 | `04 00 00 00` | 4 | value_size = `sizeof(conntrack_value)` |
| 0x0C | `00 00 01 00` | 65536 | max_entries |
| 0x10 | `00 00 00 00` | 0 | map_flags |
| 0x14 | `02 00 00 00` | 2 | pinning = `PIN_GLOBAL_NS` |
| 0x18 | `00 00 00 00` | 0 | inner_map_fd |

### Symbol Table

```bash
$ readelf -s tc.subprog.bpf.elf
```

The interesting symbols (trimmed from the full output):

```
   Num:    Value          Size Type    Bind   Vis      Ndx Name
   108: 0000000000000000   112 FUNC    LOCAL  DEFAULT    2 lookup_conntrack
   109: 0000000000000000     0 SECTION LOCAL  DEFAULT    2                <- .text section symbol
   110: 0000000000000000     0 SECTION LOCAL  DEFAULT    4                <- tc_cls section symbol
   115: 0000000000000000     4 OBJECT  GLOBAL DEFAULT    7 _license
   116: 0000000000000000    28 OBJECT  GLOBAL DEFAULT    6 aws_conntrack_map
   117: 0000000000000000    72 FUNC    GLOBAL DEFAULT    4 handle_ingress
```

| Symbol | Value | Size | Section (Ndx) | Meaning |
|--------|-------|------|---------------|---------|
| `lookup_conntrack` | 0x00 | 112 | 2 (`.text`) | Subprogram at offset 0 in `.text`, 112 bytes (14 insns) |
| `handle_ingress` | 0x00 | 72 | 4 (`tc_cls`) | Main program at offset 0 in `tc_cls`, 72 bytes (9 insns) |
| `aws_conntrack_map` | 0x00 | 28 | 6 (`maps`) | Map definition at offset 0 in `maps` section |

- **Value** = offset within the section.
- **Ndx** = which section the symbol belongs to.
- `handle_ingress` is GLOBAL (it's the program entry point). `lookup_conntrack` is LOCAL (it's a `static` function).

### Relocation Sections

```bash
$ readelf -r tc.subprog.bpf.elf
```

```
Relocation section '.rel.text' at offset 0x2268 contains 1 entry:
  Offset          Info           Type           Sym. Value    Sym. Name
  000000000038  007400000001     1              0000000000    aws_conntrack_map

Relocation section '.reltc_cls' at offset 0x2278 contains 1 entry:
  Offset          Info           Type           Sym. Value    Sym. Name
  000000000000  006d0000000a     a              0000000000    .text
```

#### `.rel.text` — relocation for the map reference in `lookup_conntrack`

- Offset `0x38` = byte 56 in the `.text` section. That's instruction 7 (56 / 8 = 7). Looking at the disassembly, insn 7 is the `ld_imm64` with the map placeholder.
- Symbol = `aws_conntrack_map` — the map whose FD should be patched in.
- Type = 1 (`R_BPF_64_64`) — a 64-bit immediate relocation.

#### `.reltc_cls` — relocation for the function call in `handle_ingress`

- Offset `0x00` = byte 0 in the `tc_cls` section. That's instruction 0 — the `call -1` placeholder.
- Symbol = `.text` — the target is the `.text` section (where `lookup_conntrack` lives).
- Type = `0xa` (`R_BPF_64_32`) — a 32-bit relocation for BPF call instructions.

## What Clang Did — and What It Left for the Loader

At this point, clang has done a lot of work:

**What clang produced:**
- BPF bytecode for both functions, organized into separate ELF sections
- A raw `maps` section containing the map definition as bytes
- A symbol table mapping names to locations
- A license section

**What clang could NOT resolve (left as placeholders):**
- **Map file descriptors** — the compiler has no idea what FD number the kernel will assign when the map is created. So insn 7 in `.text` has `Imm = 0` as a placeholder.
- **Subprogram call offsets** — the compiler doesn't know where `lookup_conntrack` will end up in the final combined bytecode. So insn 0 in `tc_cls` has `Imm = -1` as a placeholder.

This is the fundamental reason relocatable objects exist: the compiler does its half of the work (translating C to bytecode), and the loader does the other half (filling in runtime values).

## What the eBPF Loader Does

The loader takes the compiled ELF file and turns it into something the kernel can execute. Let's walk through each step. The pseudocode below is based on a real loader ([aws-ebpf-sdk-go](https://github.com/aws/aws-ebpf-sdk-go)).

### Step 1: Parse Sections

The loader iterates over all ELF sections and categorizes them:

```
for each section in elf_file:
    if section.name == "license":
        license = section.data                    // "GPL"

    else if section.name == "maps":
        map_section = section                     // raw map definitions

    else if section.type == PROGBITS and section.name == ".text":
        text_section = section                    // subprogram bytecode

    else if section.type == PROGBITS:
        prog_sections[section.index] = section    // program sections like "tc_cls"

    else if section.type == REL:
        // section.info = index of the section these relocations apply to
        relo_sections[section.info] = section
```

After this step:

```
"license"    ->  license = "GPL"
"maps"       ->  map_section (raw map definitions)
".text"      ->  text_section (subprogram bytecode)
"tc_cls"     ->  prog_sections[4] (main program bytecode)
".rel.text"  ->  relo_sections[2] (relocations targeting section index 2 = .text)
".reltc_cls" ->  relo_sections[4] (relocations targeting section index 4 = tc_cls)
```

### Step 2: Parse and Create Maps

The loader reads the `maps` section, interpreting each 28-byte chunk as a map definition:

```
for each 28-byte chunk in map_section.data:
    map_def = read_fields(chunk):
        type       = read_u32_le(bytes  0..3)    // 9 = BPF_MAP_TYPE_LRU_HASH
        key_size   = read_u32_le(bytes  4..7)    // 16
        value_size = read_u32_le(bytes  8..11)   // 4
        max_entries= read_u32_le(bytes 12..15)   // 65536
        flags      = read_u32_le(bytes 16..19)   // 0
        pinning    = read_u32_le(bytes 20..23)   // 2 = PIN_GLOBAL_NS
        inner_fd   = read_u32_le(bytes 24..27)   // 0
```

```
maps section bytes:  09000000 10000000 04000000 00000100 00000000 02000000 00000000
                     |--type--||--key--||--val--||entries||--flags||--pin--||--inner|
Parsed:              type=9    key=16   val=4    max=64K  flags=0  pin=2    inner=0
```

It then creates the map via the `bpf()` syscall:

```
map_fd = bpf_syscall(BPF_MAP_CREATE,
                     map_type    = 9,       // BPF_MAP_TYPE_LRU_HASH
                     key_size    = 16,
                     value_size  = 4,
                     max_entries = 65536)

// kernel returns a file descriptor, e.g., map_fd = 5
loaded_maps["aws_conntrack_map"] = map_fd
```

### Step 3: Process .text Relocations (Patch Map References in Subprograms)

Before combining sections, the loader patches map references inside `.text`.

It reads each `.rel.text` relocation entry:

```
Offset=0x38, Symbol=aws_conntrack_map
```

It looks at byte 0x38 in `.text`, finds the `ld_imm64` instruction, and patches it:

```
for each relocation in relo_sections[text_section.index]:
    offset = relocation.offset               // 0x38 = byte 56 = instruction 7
    map_name = relocation.symbol.name        // "aws_conntrack_map"
    map_fd = loaded_maps[map_name]           // 5

    // Patch the ld_imm64 instruction at this offset
    text_data[offset].src_reg = 1            // 1 = "this Imm is a map FD"
    text_data[offset].imm     = map_fd       // 5
```

```
BEFORE (raw from ELF):
  insn 7:  18 01 00 00  00 00 00 00   <- Imm = 0 (placeholder)
           00 00 00 00  00 00 00 00

AFTER (patched by loader):
  insn 7:  18 11 00 00  05 00 00 00   <- Imm = 5 (map FD), src_reg = 1
           00 00 00 00  00 00 00 00
```

The `src_reg=1` tells the kernel "this Imm is a map file descriptor, not a raw number."

### Step 4: Combine Sections and Apply Program Relocations

Now the loader combines `tc_cls` and `.text` into one contiguous byte stream:

```
combined_data = tc_cls_data + text_data       // concatenate the two sections
```

```
BEFORE (two separate sections):

  tc_cls section (72 bytes, 9 insns):     .text section (112 bytes, 14 insns):
  +--------------------------------+      +--------------------------------+
  | insn 0: call -1  (PLACEHOLDER) |      | insn 0: r1 = 0x0a010164       |
  | insn 1: r1 = r0                |      | ...                            |
  | ...                            |      | insn 7: r1 = MAP_FD (patched)  |
  | insn 8: exit                   |      | ...                            |
  +--------------------------------+      | insn 13: exit                  |
                                          +--------------------------------+

AFTER (combined into one buffer):

  +---- tc_cls (insns 0-8) ----------+---- .text (insns 9-22) ---------------+
  | insn 0:  call -1 (PLACEHOLDER)   | insn  9: r1 = 0x0a010164             |
  | insn 1:  r1 = r0                 | ...                                   |
  | ...                              | insn 16: r1 = MAP_FD (patched)        |
  | insn 8:  exit                    | ...                                   |
  |                                  | insn 22: exit                         |
  +----------------------------------+---------------------------------------+
```

Then it processes `.reltc_cls`:

```
Offset=0x00, Symbol=.text, Symbol.Value=0
```

This targets insn 0 in `tc_cls` — the `call -1` placeholder. The loader computes:

```
for each relocation in relo_sections[tc_cls.index]:
    if instruction_at(relocation.offset) is BPF_CALL:
        // Compute where the target function landed in combined_data
        target_offset  = tc_cls_size + symbol.value     // 72 + 0 = 72 bytes
        target_insn    = target_offset / 8              // 72 / 8 = 9
        call_insn      = relocation.offset / 8          // 0 / 8  = 0

        // BPF call semantics: target = PC + Imm + 1, so Imm = target - PC - 1
        combined_data[relocation.offset].imm = target_insn - call_insn - 1
                                             = 9 - 0 - 1
                                             = 8
```

Why `- 1`? Because BPF call semantics are: `target = PC + Imm + 1`. So from insn 0: `target = 0 + 8 + 1 = 9`. Correct — `lookup_conntrack` is now at insn 9.

The instruction is patched:

```
BEFORE:  85 10 00 00  ff ff ff ff   <- call Imm=-1 (placeholder)
AFTER:   85 10 00 00  08 00 00 00   <- call Imm=8  (-> insn 9 = lookup_conntrack)
```

### Step 5: Load into Kernel

The loader sends the combined, fully-patched bytecode to the kernel via the `bpf()` syscall:

```
prog_fd = bpf_syscall(BPF_PROG_LOAD,
                      prog_type = BPF_PROG_TYPE_SCHED_CLS,  // from "tc_cls" section name
                      insn_cnt  = 23,                        // 9 + 14 instructions
                      insns     = combined_data,
                      license   = "GPL")
```

The kernel's BPF verifier then:

1. Checks every instruction is valid
2. Verifies the `call Imm=8` actually points to a valid function boundary
3. Verifies map FD 5 is a real, valid map
4. Checks for infinite loops, out-of-bounds memory access, etc.

If verification passes, the kernel returns a program FD. The loader then pins it to the BPF filesystem (`/sys/fs/bpf/`) so it persists beyond the loader process's lifetime.

## Putting It All Together

### What clang produces (the raw ELF)

```
tc_cls section:
  insn 0: 85 10 00 00 ff ff ff ff   call ???           <- unresolved, Imm=-1

.text section:
  insn 7: 18 01 00 00 00 00 00 00   r1 = ???           <- unresolved, Imm=0
          00 00 00 00 00 00 00 00

Relocation entries:
  .rel.text:   "At .text+0x38, patch with aws_conntrack_map FD"
  .reltc_cls:  "At tc_cls+0x00, patch with call to .text+0"
```

### What the kernel receives (after the loader processes it)

```
Combined bytecode (23 instructions):

  insn  0: 85 10 00 00 08 00 00 00   call +8            <- resolved: target=insn 9
  insn  1: bf 01 00 00 00 00 00 00   r1 = r0
  insn  2: 67 01 00 00 20 00 00 00   r1 <<= 32
  insn  3: 77 01 00 00 20 00 00 00   r1 >>= 32
  insn  4: b7 00 00 00 01 00 00 00   r0 = 1
  insn  5: 15 01 01 00 00 00 00 00   if r1 == 0 goto +1
  insn  6: b7 00 00 00 00 00 00 00   r0 = 0
  insn  7: 67 00 00 00 01 00 00 00   r0 <<= 1
  insn  8: 95 00 00 00 00 00 00 00   exit
  --- .text starts here (appended) ---
  insn  9: b7 01 00 00 64 01 01 0a   r1 = 0x0a010164
  insn 10: 7b 1a f0 ff 00 00 00 00   *(u64 *)(r10-16) = r1
  insn 11: b7 06 00 00 00 00 00 00   r6 = 0
  insn 12: 63 6a f8 ff 00 00 00 00   *(u32 *)(r10-8) = r6
  insn 13: 63 6a fc ff 00 00 00 00   *(u32 *)(r10-4) = r6
  insn 14: bf a2 00 00 00 00 00 00   r2 = r10
  insn 15: 07 02 00 00 f0 ff ff ff   r2 += -16
  insn 16: 18 11 00 00 05 00 00 00   r1 = MAP_FD(5)    <- resolved: map FD=5
           00 00 00 00 00 00 00 00
  insn 18: 85 00 00 00 01 00 00 00   call bpf_map_lookup_elem
  insn 19: 15 00 01 00 00 00 00 00   if r0 == 0 goto +1
  insn 20: 71 06 00 00 00 00 00 00   r6 = *(u8 *)(r0+0)
  insn 21: bf 60 00 00 00 00 00 00   r0 = r6
  insn 22: 95 00 00 00 00 00 00 00   exit
```

The loader's job is to bridge the gap between what the compiler can produce at compile time and what the kernel expects at load time. The compiler handles the C-to-bytecode translation but must leave placeholders for runtime values. The loader fills in those placeholders — map file descriptors and function call offsets — and delivers a single, fully-resolved bytecode stream to the kernel for verification and execution.
