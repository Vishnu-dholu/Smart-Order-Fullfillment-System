# 22 — Results Interpretation

---

## Technical Interpretation

To defend these performance results in an interview, you must explain the underlying runtime architectures that caused the observed differences.

---

## 1. Latency & Throughput: JIT vs AOT Compilation

### The Latency Profile

```text
Response Latency
  ▲
  │   █ (Java Startup / Warmup spike)
  │   █   █
  │   █   █   ┌─────────────────────────── Java Spring (JIT optimized)
  │   █   █   │
  │   █   █   ▼
  │  ╔════════════════════════════════════ Go Gin (AOT compiled flat baseline)
  │  ║
  └────────────────────────────────────────► Time (35-minute test)
```

### Go: Ahead-Of-Time (AOT) Compilation

- Go code compiles directly to architecture-specific machine code before execution.
- **Result:** Predictable, flat latency from the first request. No warmup spike.

### Java: Just-In-Time (JIT) Compilation

- The JVM starts by executing code in an interpreter (slower).
- As code runs, the JVM profiles execution. Once a method becomes "hot" (typically $\ge 10,000$ invocations), the HotSpot JIT compiler compiles the bytecode into optimized machine code.
- **Result:** A significant latency spike during the 5-minute warmup phase, followed by a decrease in latency during the sustain phase, eventually matching Go's latency profile.

---

## 2. Memory Footprint: JVM Heap vs Go Runtime

### Java Memory Management

The JVM runs on virtual memory allocation. The operating system allocates virtual address space to the JVM, which is divided into memory regions:

```text
┌────────────────────────────────────────────────────────┐
│ JVM Resident Set Size (RSS Memory)                     │
│ ┌──────────────────────────────────┐ ┌───────────────┐ │
│ │ Java Heap Space                  │ │ Non-Heap      │ │
│ │ (Eden, Survivor, Old Gen)        │ │ Metaspace     │ │
│ │ -XX:MaxRAMPercentage=70.0        │ │ Thread Stacks │ │
│ └──────────────────────────────────┘ └───────────────┘ │
└────────────────────────────────────────────────────────┘
```

- **Heap Space:** Managed by the JVM Garbage Collector.
- **Non-Heap Space:** Stores class metadata (Metaspace), thread stacks ($1$MB per platform thread), JIT compiled code, and native memory buffers.
- **Result:** Java requires a minimum RSS baseline of $\approx 350$MB to run Spring Boot, even before handling requests.

### Go Memory Management

- Go compiles to a single, static binary with no external VM.
- Go's runtime executes memory allocation using a custom system based on TCMalloc (Thread-Caching Malloc).
- Memory is requested from the OS in large spans and split into small size classes.
- **Result:** Go operates with a lightweight RSS footprint of $\approx 45$MB under active load.

---

## 3. Concurrency: Platform Threads vs Goroutines

The benchmark evaluated performance at 200 concurrent users, exposing differences in how each runtime handles concurrency:

### Tomcat Thread-Per-Request (Java)

- Spring Boot uses Tomcat's default blocking connector.
- Each HTTP request occupies one OS thread from Tomcat's thread pool.
- OS threads are mapped $1:1$ to kernel threads.
- **Context Switching Cost:** When threads block on downstream HTTP or DB queries, the OS kernel must pause the thread, save CPU registers to memory, select another thread, and restore its registers. Under 200 VUs, thread context switching consumes significant CPU time.

### Go Goroutines (Go)

- Go Gin uses Go's runtime scheduler to multiplex goroutines onto a small pool of OS threads.
- When a goroutine blocks on a network call or database query, the Go runtime detaches the goroutine and assigns another active goroutine to the thread.
- **Context Switching Cost:** The switch occurs in user space within the Go runtime, requiring only a few register writes. This enables Go to handle concurrency with lower CPU overhead.

---

## 4. Garbage Collection: G1GC vs Go Concurrent GC

GC activity explains differences in latency consistency and CPU usage:

### Java G1GC (Garbage-First Garbage Collector)

- Divides the heap into equal-sized regions and performs generational garbage collection (Eden, Survivor, Tenured).
- **Stop-The-World (STW):** G1GC pauses application threads during compaction to prevent memory fragmentation.
- **Result:** These pause cycles cause latency spikes, visible as high tail latency (P99 latency of $10.24$s for Java writes). Our phase analysis shows the G1GC pause rate hitting 98.8 ms/s (meaning nearly 10% of real-time is spent paused) during the peak sustain phase.

### Go Tri-Color Concurrent Collector

- Go uses a concurrent, mark-and-sweep collector based on a tri-color algorithm (White, Grey, Black).
- **Concurrency:** The GC runs concurrently with application goroutines.
- **STW Phases:** Go performs brief STW pauses ($\le 1$ millisecond) to write-barrier synchronization and stack rescans.
- **Result:** More frequent, shorter GC cycles that prevent latency spikes, resulting in a lower P99 tail latency ($5.85$s for Go writes). During the sustain phase, Go's GC pause rate was 0.8 ms/s — 123x lower than Java.

---

## Interview Questions — Results Interpretation

**Easy:**

1. **What is JIT compilation?**
   → Just-In-Time compilation compiles JVM bytecode into machine code at runtime as the application executes.

2. **Why does Go use less memory than Java?**
   → Go compiles to a native binary without a virtual machine, avoiding class-loading, JVM runtime metadata, and large thread stack allocations.

**Medium:**
3. **How does Go's garbage collector achieve sub-millisecond pauses compared to Java's G1GC?**
   → Go's collector runs concurrently with application execution using a write barrier. Java's G1GC must pause application threads (Stop-The-World) to compact heap memory.

1. **Why did Java show higher CPU utilization ($98\%$) than Go ($82\%$) during write-heavy tests?**
   → Due to JVM thread context switching overhead from Tomcat's thread-per-request model and G1GC pause coordination.

**Hard:**
5. **How does HikariCP saturation and Tomcat's thread pool explain the 8 HTTP errors?**
   → Tomcat's thread pool defaults to 200. When all 200 threads block on downstream HTTP or DB queries, the DB pool (50) saturates. Incoming requests queue up. During the sustain phase, HikariCP pending connections spiked to 150. Tomcat threads (peaking at 754) blocked while waiting for connections. Once the 30-second timeout was exceeded, the 8 requests failed, leading to HTTP 500 errors. Go avoided this because goroutines yielded OS threads, preventing catastrophic thread starvation.

1. **What is memory fragmentation, and how does Go's lack of compaction affect long-running processes?**
   → Memory fragmentation occurs when freed memory is scattered, leaving no single block large enough for new allocations. G1GC compacts memory to prevent this. Go does not compact memory; it relies on TCMalloc-style size allocation to minimize fragmentation, though memory fragmentation can still lead to virtual memory bloat over time.
