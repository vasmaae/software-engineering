package main

import (
	"bufio"
	"fmt"
	"log"
	"os"

	"github.com/vasmaae/software-engineering/internal/password"
)

func main() {
	input := bufio.NewScanner(os.Stdin)
	if !input.Scan() {
		log.Fatal("read the password from standard input")
	}
	hash, err := password.New(input.Text())
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(hash)
}
