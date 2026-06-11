package clients

import (
	"net/http"
	"time"
)

// sharedClient is a package-level HTTP client with a configured transport that
// pools TCP connections and enables HTTP/1.1 keep-alive. This mirrors the
// behavior of Java's OpenFeign client, which pools connections transparently.
//
// A new http.Client per call (the old behaviour) forces a full TCP three-way
// handshake on every inter-service hop, introducing multiplicative latency
// under concurrent load and generating thousands of TIME_WAIT sockets on the
// Docker bridge interface.
//
// Reference: https://pkg.go.dev/net/http#Transport
var sharedClient = &http.Client{
	Timeout: 30 * time.Second,
	Transport: &http.Transport{
		// Allow up to 100 idle connections across all hosts.
		MaxIdleConns: 100,
		// Allow up to 50 idle connections per host — matches the DB pool cap
		// set on both runtimes (HikariCP maximum-pool-size=50 / SetMaxOpenConns(50)).
		MaxIdleConnsPerHost: 50,
		// Keep idle connections alive for 90 seconds.
		IdleConnTimeout: 90 * time.Second,
		// Timeout for completing the TLS handshake.
		TLSHandshakeTimeout: 10 * time.Second,
		// Timeout waiting for the server's first response headers.
		ResponseHeaderTimeout: 30 * time.Second,
		// Enable HTTP keep-alive (this is the default; stated explicitly for clarity).
		DisableKeepAlives: false,
	},
}
