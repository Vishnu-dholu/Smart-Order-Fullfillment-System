# IEEE Review Report
**Date:** June 2026
**Paper:** A Comparative Performance Analysis of Java Spring Boot and Go Gin Microservices After HTTP Connection Pool Equalization (V2)

## Overall Verdict
**MAJOR REVISION REQUIRED**

The latest benchmark data (multi_20260624_112045, averaged across run_1 and run_2) invalidates several key claims in the current V2 draft. The V2 draft contains metrics that appear to belong to an older or partial dataset. All data MUST be updated to reflect the most recent empirical evidence to maintain academic integrity.

---

## Required Corrections

### 1. Abstract & Introduction (Outdated Throughput & Error Metrics)
- **Current Text (V2):** Claims Java throughput is 30.74 req/s vs Go's 28.10 req/s, closing the gap to 1.09x. Claims Java had 2 errors vs Go 0.
- **Latest Data:** Java throughput is 28.89 req/s vs Go's 27.67 req/s, making the gap 1.04x (statistically tied). Java recorded 8 errors on average across runs (Run 1 and Run 2 averaged).
- **Suggested Replacement:** "the throughput gap collapses from 2.48x to 1.04x (Java 28.89 vs Go 27.67 req/s). Go now achieves 43% lower P95 tail latency (5,847 ms vs 10,243 ms) and zero HTTP errors versus Java's 8."

### 2. Section III.A: Write-Heavy Workload (Order Creation) Table I
- **Current Table I:** Uses 64,551 (Java) and 59,070 (Go) total requests.
- **Latest Data:** Java processed 60,689 total requests (avg), Go processed 58,153 (avg).
- **Correction:** Rebuild Table I using the aggregate dataset:
  - **Java:** Total 60,689, Avg 2,791 ms, Med 903 ms, P90 8,645 ms, P95 10,243 ms, Max 15,182 ms, Throughput 28.89 req/s, HTTP Errors 8.
  - **Go:** Total 58,153, Avg 2,944 ms, Med 3,229 ms, P90 4,938 ms, P95 5,847 ms, Max 21,979 ms, Throughput 27.67 req/s, HTTP Errors 0.

### 3. Section III.B: Read-Heavy Workload (Inventory Lookup) Table II
- **Current Table II:** Avg latency is 1.458 ms for Java and 1.032 ms for Go.
- **Latest Data:** Java avg 1.34 ms, Go avg 0.99 ms. Java P95 is 2.77 ms, Go P95 is 2.45 ms.
- **Correction:** Update Table II and discussion (Section III.B) to reflect Go's 26% lower average latency (0.99 ms vs 1.34 ms).

### 4. Section III.C: Resource Utilization Table III
- **Current Table III:**
  - Java RSS Avg: 267.9 MB
  - Go RSS Avg: 35.3 MB
  - Java CPU Max: 27.4%
  - Go CPU Max: 12.1%
  - Java GC Max: 1.673 ms/s
  - Go GC Max: 0.445 ms/s
- **Latest Data:**
  - Java RSS Avg: 272.73 MB
  - Go RSS Avg: 33.51 MB (Ratio: 8.1x)
  - Java CPU Max: 52.86%
  - Go CPU Max: 16.93%
  - Java GC Max: 98.8 ms/s (0.0988)
  - Go GC Max: 0.8 ms/s (0.0008)
- **Correction:** Rebuild Table III. The GC pause rate difference is even more dramatic than previously stated (123x higher maximum peak, although average is much lower). The CPU spikes for Java reached 52%, further underscoring GC/JIT overhead.

### 5. Section IV.A: Revised Architectural Conclusions
- **Current Text:** "Java leads by only 9.4% (30.74 vs 28.10 req/s)"
- **Latest Data:** Java leads by only 4.4% (28.89 vs 27.67 req/s).
- **Correction:** Revise the text to emphasize that the systems are fundamentally tied on throughput. The 4.4% difference falls within the standard deviation of a micro-benchmark and should not be considered a decisive victory for Java.

### 6. Section IV.D: Threats to Validity
- **Current Text:** Does not mention K6 pacing limiting read throughput.
- **Correction:** Add a 5th point to threats: "(5) K6 Pacing limit: The read-heavy inventory workload was capped by the `sleep(1)` statement in the K6 script, meaning both runtimes achieved ~108 req/s due to client-side bounding, preventing measurement of true max read capacity."

## Conclusion
The structural narrative of the paper (Go wins on memory/tail-latency, Java slightly wins on JIT median throughput) holds true. However, the exact metrics must be replaced with the aggregate data from the latest rigorous benchmark runs.
