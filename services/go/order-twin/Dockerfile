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
# -ldflags="-w -s" removes debugging information to reduce binary size
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o order-twin ./cmd/main.go

# ----------------------------------
# Stage 2: Final Runtime Image
# ----------------------------------
FROM alpine:latest

# Security: Add CA certificates for HTTPS calls to other services or Neon DB
RUN apk add --no-cache ca-certificates

WORKDIR /app

# Create a non-root user for security best practices
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy the binary from the builder
COPY --from=builder /app/order-twin /app/order-twin

# Ensure the binary is executable
RUN chmod +x /app/order-twin

# Set ownership to the non-root user
RUN chown -R appuser:appgroup /app

USER appuser:appgroup

# Match the port defined in your Spring Boot application.properties
EXPOSE 8083

CMD ["/app/order-twin"]
