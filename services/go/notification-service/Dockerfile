# ----------------------------------
# Stage 1: Build the Go Binary
# ----------------------------------
FROM golang:1.25-alpine AS builder

# Install build dependencies
RUN apk add --no-cache git

WORKDIR /app

# Step 1: Download dependencies (Optimized for Docker Cache)
COPY go.mod go.sum ./
RUN go mod download

# Step 2: Copy the source code
COPY . .

# Step 3: Compile a static binary
# -ldflags="-w -s" reduces binary size for better performance analysis
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o microservice ./cmd/main.go

# ----------------------------------
# Stage 2: Final Runtime Image
# ----------------------------------
FROM alpine:latest

# Security: Add CA certificates for potential HTTPS calls
RUN apk add --no-cache ca-certificates

WORKDIR /app

# Create a non-root user for security best practices
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy the binary from the builder
COPY --from=builder /app/microservice /app/microservice

# Ensure the binary is executable
RUN chmod +x /app/microservice

# Set ownership to the non-root user
RUN chown -R appuser:appgroup /app

USER appuser:appgroup

EXPOSE 8086

CMD ["/app/microservice"]
