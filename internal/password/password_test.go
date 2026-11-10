package password

import "testing"

func TestVerifier(t *testing.T) {
	secret := "учебный длинный пароль"
	first, err := New(secret)
	if err != nil {
		t.Fatal(err)
	}
	second, err := New(secret)
	if err != nil || first == second {
		t.Fatal("salt was not generated independently")
	}
	hash, err := Parse(first)
	if err != nil || !hash.Matches(secret) || hash.Matches(secret+"!") {
		t.Fatal("incorrect verification")
	}
	if _, err := Parse(secret); err == nil {
		t.Fatal("plaintext accepted as a verifier")
	}
	if _, err := New("short"); err == nil {
		t.Fatal("short password accepted")
	}
}
