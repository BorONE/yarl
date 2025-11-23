FROM golang AS build
COPY . /backend
WORKDIR /backend
RUN GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -o /build/server cmd/server/main.go

FROM ubuntu as runner
COPY --from=build /build/server ./server
EXPOSE 9000
ENTRYPOINT ./server
