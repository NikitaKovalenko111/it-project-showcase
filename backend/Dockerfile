FROM golang:1.25.3-alpine AS builder
WORKDIR /app
COPY go.mod go.sum .
RUN go mod download
COPY . .
RUN apk add --no-cache make 
RUN make build

FROM alpine:latest
WORKDIR /server
COPY --from=builder /app/bin/backend .
EXPOSE 3005
CMD ["./backend"]