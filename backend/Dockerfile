FROM golang:1.25-alpine AS builder

WORKDIR /src

RUN apk add --no-cache ca-certificates tzdata

COPY go.mod go.sum ./
RUN go mod download

COPY . .

# TARGETOS/TARGETARCH are provided automatically by BuildKit (matching the build
# host by default, or an explicit `docker build --platform`). This builds a
# native binary on arm64 (Apple silicon) and amd64 alike instead of hardcoding
# amd64. If the legacy (non-BuildKit) builder is used they're empty and Go falls
# back to the host's defaults, which is still correct.
ARG TARGETOS
ARG TARGETARCH
RUN CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH} go build -o /out/apportal-backend ./cmd/server

FROM alpine:3.21

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

COPY --from=builder /out/apportal-backend /app/apportal-backend

EXPOSE 8080

CMD ["/app/apportal-backend"]
