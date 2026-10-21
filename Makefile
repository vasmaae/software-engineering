.PHONY: setup lint test metrics build check

setup:
	npm ci
	go mod download
	git config core.hooksPath .githooks

lint:
	mkdir -p artifacts
	test -z "$$(gofmt -l cmd internal)"
	go vet ./...
	npx eslint . --format json --output-file artifacts/eslint.json --max-warnings 0
	npm run format:check

test:
	@test -n "$$TEST_DATABASE_URL" || (echo 'Set TEST_DATABASE_URL to a dedicated initialized test database'; exit 1)
	mkdir -p artifacts
	go test -count=1 -race -coverpkg=./internal/... -coverprofile=artifacts/go-coverage.out -json ./... > artifacts/go-tests.jsonl
	go tool cover -func=artifacts/go-coverage.out > artifacts/go-coverage.txt
	npm test
	npm run test:scripts

metrics:
	npm run metrics

build:
	mkdir -p dist
	CGO_ENABLED=0 go build -trimpath -o dist/api ./cmd/api
	npm run build

check: lint test metrics build
