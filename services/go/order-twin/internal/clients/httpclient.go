package clients

import (
	"net"
	"net/http"
	"time"
)

// sharedTransport is an http.Transport with connection pooling
// configured to match Java OpenFeign's behavior for fair benchmarking.
// Pool settings mirror HikariCP's connection management:
//   - MaxIdleConnsPerHost=50 matches Java's pool ceiling
//   - IdleConnTimeout=30s matches HikariCP's idle-timeout
var sharedTransport = &http.Transport{
	MaxIdleConns:        100,
	MaxIdleConnsPerHost: 50,
	IdleConnTimeout:     30 * time.Second,
	DisableKeepAlives:   false,
	ForceAttemptHTTP2:   false, // Keep HTTP/1.1 to match Java's OpenFeign
	DialContext: (&net.Dialer{
		Timeout:   5 * time.Second,
		KeepAlive: 30 * time.Second,
	}).DialContext,
}

// SharedClient is used for most inter-service calls (5s timeout)
var SharedClient = &http.Client{
	Timeout:   5 * time.Second,
	Transport: sharedTransport,
}

// SharedWarehouseClient is used for warehouse calls which may take longer (30s timeout)
var SharedWarehouseClient = &http.Client{
	Timeout:   30 * time.Second,
	Transport: sharedTransport,
}
