// Package password implements the local administrator's stored password verifier.
package password

import (
	"crypto/pbkdf2"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"strings"
)

const iterations = 600_000

type Hash struct {
	salt, key []byte
}

func New(secret string) (string, error) {
	if len(secret) < 12 || len(secret) > 256 {
		return "", errors.New("password must contain 12–256 bytes")
	}
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	key, err := pbkdf2.Key(sha256.New, secret, salt, iterations, 32)
	if err != nil {
		return "", err
	}
	return hex.EncodeToString(salt) + ":" + hex.EncodeToString(key), nil
}

func Parse(encoded string) (Hash, error) {
	salt, key, ok := strings.Cut(encoded, ":")
	if !ok || len(salt) != 32 || len(key) != 64 {
		return Hash{}, errors.New("invalid administrator password hash")
	}
	saltBytes, a := hex.DecodeString(salt)
	keyBytes, b := hex.DecodeString(key)
	if a != nil || b != nil {
		return Hash{}, errors.New("invalid administrator password hash")
	}
	return Hash{saltBytes, keyBytes}, nil
}

func (h Hash) Matches(secret string) bool {
	if len(h.key) == 0 || len(secret) < 12 || len(secret) > 256 {
		return false
	}
	key, err := pbkdf2.Key(sha256.New, secret, h.salt, iterations, len(h.key))
	return err == nil && subtle.ConstantTimeCompare(key, h.key) == 1
}
