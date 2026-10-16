# Stage 1: Build Go Gin binary
FROM golang:1.27-alpine AS builder

WORKDIR /workspace/apps/api

# Cache Go modules first
COPY apps/api/go.mod apps/api/go.sum ./
RUN go mod download

# Copy source and compile static zero-overhead binary
ARG TARGETARCH=amd64
COPY apps/api/ ./
RUN CGO_ENABLED=0 GOOS=linux GOARCH=${TARGETARCH} go build -ldflags="-s -w" -o /bin/server ./cmd/server

# Stage 2: Distroless nonroot runtime (<15MB total image)
FROM gcr.io/distroless/static-debian12:nonroot

COPY --from=builder /bin/server /server

ENV PORT=8080
ENV GIN_MODE=release
EXPOSE 8080

USER nonroot:nonroot
ENTRYPOINT ["/server"]
