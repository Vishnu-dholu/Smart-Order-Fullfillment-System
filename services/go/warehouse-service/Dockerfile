# syntax=docker/dockerfile:1.7
FROM golang:1.25.0-alpine3.21 AS build
WORKDIR /src

COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download

COPY . .
RUN --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -trimpath -buildvcs=false -mod=readonly -ldflags="-s -w" -o /out/microservice ./cmd/main.go

FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app

COPY --from=build /out/microservice /app/microservice

USER nonroot:nonroot
EXPOSE 8084
ENTRYPOINT ["/app/microservice"]
