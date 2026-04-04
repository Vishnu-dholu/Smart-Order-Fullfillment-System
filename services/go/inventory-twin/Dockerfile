# ----------------------------------
# Stage 1: Build the Go Binary
# ----------------------------------
FROM golang:1.25-alpine AS builder

# Install build dependencies
RUN apk add --no-cache git

WORKDIR /app

# Download dependencies (Optimized for Docker Cache)
COPY go.mod go.sum ./
RUN go mod download

# Copy the source code
COPY . .

# Compile a static binary
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o inventory-twin ./cmd/main.go

# ----------------------------------
# Stage 2: Final Runtime Image
# ----------------------------------
FROM alpine:latest

# Security: Add CA certificates for HTTPS calls to Neon DB
RUN apk add --no-cache ca-certificates

WORKDIR /app

# Create a non-root user for security best practices
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy the binary from the builder
COPY --from=builder /app/inventory-twin /app/inventory-twin

# Ensure the binary is executable
RUN chmod +x /app/inventory-twin

# Set ownership to the non-root user
RUN chown -R appuser:appgroup /app

USER appuser:appgroup

EXPOSE 9082

CMD ["/app/inventory-twin"]
