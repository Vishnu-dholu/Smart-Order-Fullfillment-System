# ----------------------------------
# Stage 1: Build the Go Binary
# ----------------------------------
FROM golang:1.25-alpine AS builder
FROM golang:1.22-alpine AS builder

RUN apk add --no-cache git

WORKDIR /app

COPY go.mod ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o microservice ./cmd/main.go

# ----------------------------------
# Stage 2: Final Runtime Image
# ----------------------------------
FROM alpine:latest

RUN apk add --no-cache ca-certificates

WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /app/microservice /app/microservice

RUN chmod +x /app/microservice && chown -R appuser:appgroup /app

USER appuser:appgroup

EXPOSE 9082

CMD ["/app/microservice"]

