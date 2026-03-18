# ----------------------------------
# Stage 1: Build the Go Binary
# ----------------------------------
FROM golang:1.25-alpine AS builder

WORKDIR /app

# Download dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy the source code
COPY . .

# Compile a static binary
RUN CGO_ENABLED=0 GOOS=linux go build -o /app/microservice ./cmd/main.go

# ----------------------------------
# Stage 2: Run the Application
# ----------------------------------
FROM alpine:latest

WORKDIR /app

# Create a non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser:appgroup

# Copy the compiled binary from the builder stage
COPY --from=builder /app/microservice .

EXPOSE 8085

CMD ["./microservice"]
